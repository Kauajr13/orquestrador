import { describe, expect, it } from "vitest";
import { ProvedorCompat } from "@/lib/ai/openai-compat";

/**
 * O gpt-oss organiza o próprio raciocínio em canais e às vezes vaza o marcador
 * dentro da chamada de ferramenta. Vimos chegar `ler_arquivo<|channel|>commentary`
 * — nome que não bate com ferramenta nenhuma, fazendo o provedor recusar a
 * requisição inteira. O agente perdia o passo por formatação do modelo.
 *
 * Testado pela porta da frente: uma resposta de API forjada, com o vazamento
 * dentro, tem que sair limpa do outro lado.
 */
function provedorFalso(respostaDaApi: unknown) {
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(respostaDaApi), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;

  const provedor = new ProvedorCompat({
    nome: "teste",
    baseUrl: "https://exemplo.invalido/v1",
    apiKey: "chave",
    modelo: "modelo-de-teste",
    precoEntrada: 0,
    precoSaida: 0,
  });

  return { provedor, restaurar: () => (globalThis.fetch = original) };
}

describe("nome de ferramenta vindo do modelo", () => {
  it("corta o marcador de canal vazado pelo modelo", async () => {
    const { provedor, restaurar } = provedorFalso({
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              {
                id: "1",
                type: "function",
                function: {
                  name: "ler_arquivo<|channel|>commentary",
                  arguments: '{"caminho":"app/page.tsx"}',
                },
              },
            ],
          },
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    });

    try {
      const r = await provedor.conversar([{ role: "user", content: "oi" }]);
      expect(r.chamadas[0].function.name).toBe("ler_arquivo");
      // Os argumentos não podem ser tocados: só o nome estava sujo.
      expect(r.chamadas[0].function.arguments).toBe('{"caminho":"app/page.tsx"}');
    } finally {
      restaurar();
    }
  });

  it("não mexe em nome que já está limpo", async () => {
    const { provedor, restaurar } = provedorFalso({
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              { id: "1", type: "function", function: { name: "buscar_web", arguments: "{}" } },
            ],
          },
        },
      ],
      usage: {},
    });

    try {
      const r = await provedor.conversar([{ role: "user", content: "oi" }]);
      expect(r.chamadas[0].function.name).toBe("buscar_web");
    } finally {
      restaurar();
    }
  });
});
