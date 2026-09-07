import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { conversar } from "@/lib/ai";
import { AIErro } from "@/lib/ai/tipos";

/**
 * Um provedor sem cota tem que ser PULADO, nunca fatal.
 *
 * Este teste existe por um caso concreto, em 07/09/2026: a chave do Cerebras
 * entrou na fila autenticando normalmente — `GET /models` respondia 200 e
 * listava os três modelos —, mas toda inferência voltava 402 "payment required"
 * porque a conta não tinha cota liberada.
 *
 * Como 402 é 4xx, a cascata o tratava como erro nosso e o lançava na hora. O
 * efeito era perverso: adicionar um provedor gratuito à fila deixava a empresa
 * PIOR do que não ter provedor nenhum, porque derrubava o tick inteiro em vez
 * de seguir para o próximo. É o tipo de regressão que passa despercebida,
 * porque só aparece quando a fila realmente cai para o segundo provedor.
 */

const original = { ...process.env };

function limpar() {
  for (const k of Object.keys(process.env)) {
    if (k.startsWith("LLM_")) delete process.env[k];
  }
}

/** Resposta de sucesso mínima, no formato que a API de chat devolve. */
function ok(conteudo: string) {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content: conteudo }, finish_reason: "stop" }],
      usage: { prompt_tokens: 10, completion_tokens: 2 },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function recusa(status: number, corpo: string) {
  return new Response(corpo, { status });
}

beforeEach(() => {
  limpar();
  process.env.LLM_1_URL = "https://api.cerebras.ai/v1";
  process.env.LLM_1_KEY = "csk_teste";
  process.env.LLM_1_MODELOS_CARO = "gpt-oss-120b";
  process.env.LLM_2_URL = "https://api.groq.com/openai/v1";
  process.env.LLM_2_KEY = "gsk_teste";
  process.env.LLM_2_MODELOS_CARO = "openai/gpt-oss-120b";
});

afterEach(() => {
  vi.restoreAllMocks();
  limpar();
  Object.assign(process.env, original);
});

describe("cascata entre provedores", () => {
  it("pula o provedor que responde 402 e segue para o próximo", async () => {
    const chamadas: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (entrada) => {
      const url = String(entrada);
      chamadas.push(url);
      if (url.includes("cerebras")) {
        return recusa(
          402,
          `{"message":"Payment required to access this resource. Visit your billing tab.","code":"payment_required"}`,
        );
      }
      return ok("segui no próximo da fila");
    });

    const r = await conversar([{ role: "user", content: "oi" }]);

    expect(r.conteudo).toBe("segui no próximo da fila");
    expect(chamadas.some((u) => u.includes("cerebras"))).toBe(true);
    expect(chamadas.some((u) => u.includes("groq"))).toBe(true);
  });

  it("não insiste no mesmo provedor depois de um 402", async () => {
    let tentativasNoCerebras = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (entrada) => {
      if (String(entrada).includes("cerebras")) {
        tentativasNoCerebras += 1;
        return recusa(402, `{"code":"payment_required"}`);
      }
      return ok("ok");
    });

    await conversar([{ role: "user", content: "oi" }]);

    // Repetir uma conta sem cota só queima o orçamento de tempo do tick: são
    // 60 segundos no total, e cada tentativa perdida é um passo a menos.
    expect(tentativasNoCerebras).toBe(1);
  });

  it("quando a fila inteira fica sem cota, o erro sobe como 402", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      recusa(402, `{"code":"payment_required"}`),
    );

    // O runner reconhece este status e encerra o tick guardando a conversa, em
    // vez de perder o passo. Se algum dia isto virar outro status, o tratamento
    // no runner precisa acompanhar.
    await expect(conversar([{ role: "user", content: "oi" }])).rejects.toMatchObject({
      status: 402,
    });
  });

  it("continua pulando por cota esgotada e por teto de tokens", async () => {
    for (const status of [429, 413]) {
      vi.restoreAllMocks();
      vi.spyOn(globalThis, "fetch").mockImplementation(async (entrada) =>
        String(entrada).includes("cerebras") ? recusa(status, "{}") : ok("proximo"),
      );

      const r = await conversar([{ role: "user", content: "oi" }]);
      expect(r.conteudo).toBe("proximo");
    }
  });

  it("erro que é culpa nossa continua sendo fatal", async () => {
    // 401 é chave errada: trocar de provedor não conserta, e mascarar isso
    // faria a empresa trabalhar sem ninguém notar que a configuração quebrou.
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => recusa(401, "chave inválida"));

    await expect(conversar([{ role: "user", content: "oi" }])).rejects.toBeInstanceOf(AIErro);
  });
});
