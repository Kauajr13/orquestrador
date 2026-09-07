import { afterEach, describe, expect, it } from "vitest";
import { provedoresPara } from "@/lib/ai/provedor";

/**
 * A fila de provedores é o que permite trabalhar de graça enquanto der e pagar
 * só o excedente: o gratuito cobre o dia normal, e o pago existe para a empresa
 * não parar quando ele esgota a cota.
 *
 * A ordem importa, e é por isso que estes testes existem: se o pago vier antes
 * do gratuito, a empresa passa a gastar dinheiro sem necessidade e ninguém
 * percebe — o sistema continua funcionando, só que cobrando.
 */
const original = { ...process.env };

afterEach(() => {
  for (const k of Object.keys(process.env)) {
    if (k.startsWith("LLM_")) delete process.env[k];
  }
  Object.assign(process.env, original);
});

function limpar() {
  for (const k of Object.keys(process.env)) {
    if (k.startsWith("LLM_")) delete process.env[k];
  }
}

describe("fila de provedores", () => {
  it("respeita a ordem: o gratuito antes do pago", () => {
    limpar();
    process.env.LLM_1_URL = "https://api.groq.com/openai/v1";
    process.env.LLM_1_KEY = "gsk_teste";
    process.env.LLM_1_MODELOS_CARO = "openai/gpt-oss-120b";
    process.env.LLM_2_URL = "https://api.deepseek.com/v1";
    process.env.LLM_2_KEY = "sk_teste";
    process.env.LLM_2_MODELOS_CARO = "deepseek-chat";

    const fila = provedoresPara("caro");

    expect(fila).toHaveLength(2);
    expect(fila[0].modelo).toBe("openai/gpt-oss-120b");
    expect(fila[1].modelo).toBe("deepseek-chat");
  });

  it("soma os modelos de cada provedor na fila", () => {
    limpar();
    process.env.LLM_1_URL = "https://api.groq.com/openai/v1";
    process.env.LLM_1_KEY = "gsk_teste";
    process.env.LLM_1_MODELOS_CARO = "modelo-a,modelo-b";
    process.env.LLM_2_URL = "https://api.deepseek.com/v1";
    process.env.LLM_2_KEY = "sk_teste";
    process.env.LLM_2_MODELOS_CARO = "modelo-c";

    expect(provedoresPara("caro").map((p) => p.modelo)).toEqual([
      "modelo-a",
      "modelo-b",
      "modelo-c",
    ]);
  });

  it("cai para os modelos caros quando o provedor não define baratos", () => {
    limpar();
    process.env.LLM_1_URL = "https://api.groq.com/openai/v1";
    process.env.LLM_1_KEY = "gsk_teste";
    process.env.LLM_1_MODELOS_CARO = "grande";

    expect(provedoresPara("barato").map((p) => p.modelo)).toEqual(["grande"]);
  });

  it("ignora provedor sem chave em vez de quebrar a fila", () => {
    limpar();
    process.env.LLM_1_URL = "https://api.groq.com/openai/v1";
    process.env.LLM_1_KEY = "";
    process.env.LLM_1_MODELOS_CARO = "grátis";
    process.env.LLM_2_URL = "https://api.deepseek.com/v1";
    process.env.LLM_2_KEY = "sk_teste";
    process.env.LLM_2_MODELOS_CARO = "pago";

    expect(provedoresPara("caro").map((p) => p.modelo)).toEqual(["pago"]);
  });

  it("aceita a configuração antiga de provedor único", () => {
    limpar();
    process.env.LLM_BASE_URL = "https://api.groq.com/openai/v1";
    process.env.LLM_API_KEY = "gsk_teste";
    process.env.LLM_MODELO_CARO = "antigo-a,antigo-b";

    expect(provedoresPara("caro").map((p) => p.modelo)).toEqual(["antigo-a", "antigo-b"]);
  });

  it("sem nada configurado, falha dizendo o que falta", () => {
    limpar();
    expect(() => provedoresPara("caro")).toThrow(/LLM_1_URL/);
  });
});
