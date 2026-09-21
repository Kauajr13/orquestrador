export async function executarRetrospectivaSemanal(): Promise<void> {
  try {
    // 1. Coleta de dados da semana passada
    const retros = await consultar_banco({
      tabela: "retrospectivas",
    });

    // 2. Filtra entradas da semana passada (últimos 7 dias)
    const agora = new Date();
    const dataInicio = new Date(agora);
    dataInicio.setDate(agora.getDate() - 7);
    const dados = retros.filter((r: any) => {
      const data = new Date(r.data ?? r.created_at ?? r.createdAt ?? r.created);
      return data >= dataInicio && data <= agora;
    });

    // 3. Compila resumo
    const total = dados.length;
    const concluídos = dados.filter((d: any) => d.concluido === true || d.concluido === "true").length;
    const bloqueios = dados.filter((d: any) => d.bloqueio && d.bloqueio.trim() !== "").length;
    const lições = dados.filter((d: any) => d.leiçao || d.lesson || d.learned || d.lesson || d.leições || d.lesson).length;

    console.log(`Resumo Retrospectiva: ${total} itens, ${concluídos} concluídos, ${bloqueios} bloqueios, ${lições} lições.`);
    console.log("Retrospectiva semanal concluída");
  } catch (error) {
    console.error("Erro ao executar retrospectiva semanal:", error);
    throw error;
  }
}
