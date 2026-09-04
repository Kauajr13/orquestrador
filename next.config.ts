import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O Next 16 reescreve AGENTS.md e CLAUDE.md na raiz a cada `dev`. Aqui esses
  // dois arquivos são instrução nossa — o AGENTS.md é o que os agentes leem pra
  // se autocodar —, então deixar ligado apagaria justamente o que importa.
  agentRules: false,
  experimental: {
    // Regra fixa dos projetos do Kauã. Sob Turbopack a flag é ignorada e o boot
    // imprime "⨯ webpackBuildWorker" — aviso de chave desconhecida, não erro.
    // Fica aqui pro dia em que o build cair pro webpack.
    webpackBuildWorker: false,
  },
};

export default nextConfig;
