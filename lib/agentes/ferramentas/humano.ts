import type { Ferramenta } from "./tipos";

/**
 * O único caminho até o chefe.
 *
 * Existe porque há coisas que nenhum agente pode fazer: abrir CNPJ, passar por
 * KYC, comprar, assinar contrato, registrar marca. Não é limitação técnica — é
 * que essas coisas exigem uma pessoa jurídica ou física de verdade.
 *
 * A mensagem entra numa fila e sai em horário comercial. O Kauã pediu para ser
 * chamado durante o dia, e um pedido às 3h da manhã não fica melhor por chegar
 * mais cedo.
 */
export const pedirProvidencia: Ferramenta = {
  nome: "pedir_providencia",
  descricao:
    "Pede ao Kauã algo que só uma pessoa real pode fazer (CNPJ, compra, assinatura, contrato, aprovação de texto legal). Chega no Telegram dele em horário comercial.",
  parametros: {
    type: "object",
    properties: {
      assunto: { type: "string", description: "Uma linha dizendo o que você precisa" },
      detalhe: {
        type: "string",
        description:
          "O contexto: por que precisa, o que já foi feito, e o que fica travado sem isso",
      },
      urgencia: {
        type: "string",
        enum: ["normal", "critica"],
        description:
          "critica só para o que trava a empresa inteira, como credencial vencida. Fura o horário comercial.",
      },
    },
    required: ["assunto", "detalhe"],
  },

  async executar(args, ctx) {
    const assunto = String(args.assunto ?? "").trim();
    const detalhe = String(args.detalhe ?? "").trim();
    if (!assunto) throw new Error("assunto vazio");

    const urgencia = args.urgencia === "critica" ? "critica" : "normal";

    const { error } = await ctx.supabase.from("notificacoes").insert({
      texto: `${ctx.agente.nome} precisa de você\n\n${assunto}\n\n${detalhe}`,
      urgencia,
      tarefa_id: ctx.tarefa?.id ?? null,
    });

    if (error) throw new Error(error.message);

    await ctx.registrar("warn", `${ctx.agente.nome} pediu providência: ${assunto}`);

    return urgencia === "critica"
      ? "Pedido enviado agora, por ser crítico. Siga trabalhando no que não depende disso."
      : "Pedido na fila; sai no próximo horário comercial. Siga trabalhando no que não depende disso.";
  },
};
