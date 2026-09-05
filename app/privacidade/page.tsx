export const metadata = {
  title: "Privacidade e termos",
  description: "Como esta empresa trata dados pessoais.",
};

/**
 * Rascunho. Precisa ser lido e aprovado por uma pessoa antes de a empresa
 * começar a coletar qualquer e-mail — e revisado por advogado antes de entrar
 * dinheiro de terceiro. Nenhum agente pode editar esta página: ela é código,
 * não linha na tabela `paginas`.
 */
export default function Privacidade() {
  return (
    <div className="flex-1 max-w-2xl w-full mx-auto px-5 py-10 space-y-6">
      <header>
        <h1 className="text-2xl leading-tight">Privacidade e termos</h1>
        <p className="text-xs text-ambar mt-2">
          Rascunho aguardando revisão humana. Não colete dados enquanto esta
          nota estiver aqui.
        </p>
      </header>

      <section className="space-y-3 text-sm leading-relaxed text-suave">
        <h2 className="text-base text-texto">Quem somos</h2>
        <p>
          Este site é operado por uma pessoa física, e o conteúdo é produzido por
          agentes de inteligência artificial sob supervisão dela. O contato para
          qualquer assunto relacionado a dados é o e-mail informado no fim desta
          página.
        </p>

        <h2 className="text-base text-texto pt-3">Que dados coletamos</h2>
        <p>
          Apenas o endereço de e-mail que você mesmo informa, quando escolhe
          entrar em uma lista de espera. Não coletamos nome, telefone, documento,
          localização nem dados de navegação para publicidade.
        </p>

        <h2 className="text-base text-texto pt-3">Por que coletamos</h2>
        <p>
          Para avisar você quando o produto que despertou seu interesse existir.
          A base legal é o seu consentimento, dado no momento do cadastro. Nós
          guardamos a data, o endereço de IP e a versão deste texto que estava no
          ar quando você aceitou.
        </p>

        <h2 className="text-base text-texto pt-3">Com quem compartilhamos</h2>
        <p>
          Com ninguém. Seu e-mail fica em um banco de dados hospedado no Brasil e
          não é enviado a serviços de inteligência artificial: antes de qualquer
          informação passar por um modelo, os dados pessoais são mascarados.
        </p>

        <h2 className="text-base text-texto pt-3">Por quanto tempo</h2>
        <p>
          Até você pedir a remoção, ou até dois anos depois do último contato —
          o que vier primeiro.
        </p>

        <h2 className="text-base text-texto pt-3">Seus direitos</h2>
        <p>
          A Lei Geral de Proteção de Dados garante a você confirmar se tratamos
          seus dados, acessá-los, corrigi-los, pedir a eliminação e revogar o
          consentimento. Para exercer qualquer um deles, escreva para o contato
          abaixo; respondemos em até 15 dias.
        </p>

        <h2 className="text-base text-texto pt-3">Conteúdo gerado por IA</h2>
        <p>
          As páginas deste site são escritas por agentes de inteligência
          artificial. Afirmações com números ou atribuídas a terceiros vêm com a
          fonte citada. Se encontrar um erro, avise — corrigimos e registramos a
          correção.
        </p>

        <h2 className="text-base text-texto pt-3">Contato</h2>
        <p className="text-apagado">
          [preencher com o e-mail de contato antes de publicar]
        </p>
      </section>
    </div>
  );
}
