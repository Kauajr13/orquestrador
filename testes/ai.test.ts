import { describe, expect, it } from "vitest";
import { AIErro } from "@/lib/ai/tipos";

/**
 * O caso que motivou isto aconteceu de verdade: o prompt do Dev foi atualizado
 * no banco citando `ler_arquivo` antes de o código com a ferramenta chegar em
 * produção. O modelo tentou chamá-la, o provedor recusou a requisição inteira
 * com 400, e a tentativa se perdeu — por um engano que o agente corrigiria
 * sozinho se soubesse quais ferramentas tem.
 */
describe("erro de ferramenta inexistente", () => {
  it("reconhece o erro e extrai o nome da ferramenta", () => {
    const erro = new AIErro(
      `groq HTTP 400: {"error":{"message":"Tool call validation failed: tool call validation failed: attempted to call tool 'ler_arquivo' which was not in request.tools","type":"invalid_request_error"}}`,
      400,
      "groq",
    );

    expect(erro.ferramentaInexistente).toBe("ler_arquivo");
  });

  it("não confunde com outros erros 400", () => {
    const erro = new AIErro("groq HTTP 400: payload inválido", 400, "groq");
    expect(erro.ferramentaInexistente).toBeNull();
  });

  it("não confunde com limite de taxa", () => {
    const erro = new AIErro("groq HTTP 429: rate limit", 429, "groq");
    expect(erro.ferramentaInexistente).toBeNull();
    expect(erro.valeRepetir).toBe(true);
  });
});
