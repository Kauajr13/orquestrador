/**
 * Mascaramento de dado pessoal. Regra 4 da constituição.
 *
 * O provedor de LLM é serviço no exterior. Quem entrou numa lista de espera
 * consentiu em receber notícia da empresa — não em ter o e-mail enviado para
 * um modelo hospedado fora do país. A LGPD chama isso de finalidade, e a
 * finalidade aqui não cobre aquilo.
 *
 * O mascaramento é feito de forma a manter o dado útil para análise: dá para
 * contar quantos leads são do mesmo domínio, ou de qual DDD, sem saber quem é.
 */

const EMAIL = /([\w.+-]+)@([\w-]+(?:\.[\w-]+)+)/g;
// Celular e fixo brasileiros, com ou sem DDI, DDD, espaço, traço e parênteses.
const TELEFONE = /(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?\d{4,5}[-\s]?\d{4}/g;
const CPF = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;

export function mascararPII(texto: string): string {
  return texto
    .replace(EMAIL, (_, usuario: string, dominio: string) => {
      const inicial = usuario.slice(0, 1);
      return `${inicial}${"*".repeat(Math.max(usuario.length - 1, 3))}@${dominio}`;
    })
    .replace(CPF, "***.***.***-**")
    .replace(TELEFONE, (achado) => {
      const digitos = achado.replace(/\D/g, "");
      // Guarda o DDD, que é informação de mercado, e some com o resto.
      const ddd = digitos.length >= 10 ? digitos.slice(-11, -9) || digitos.slice(0, 2) : "";
      return ddd ? `(${ddd}) *****-****` : "*****-****";
    });
}

/**
 * Aplica o mascaramento em qualquer estrutura vinda do banco, recursivamente.
 * É o que `consultar_banco` usa antes de devolver linhas para um agente: mais
 * seguro do que confiar que quem escreveu a query lembrou de excluir a coluna.
 */
export function mascararProfundo<T>(valor: T): T {
  if (typeof valor === "string") return mascararPII(valor) as T;
  if (Array.isArray(valor)) return valor.map(mascararProfundo) as T;
  if (valor && typeof valor === "object") {
    const saida: Record<string, unknown> = {};
    for (const [chave, v] of Object.entries(valor)) saida[chave] = mascararProfundo(v);
    return saida as T;
  }
  return valor;
}
