# Licenças

Registro do que é de terceiros e sob qual licença. Existe porque a empresa publica conteúdo
sob um domínio de pessoa real — e porque agentes autônomos adicionam dependências sozinhos,
então precisa haver um lugar onde isso fica visível.

O CI verifica as licenças das dependências e barra copyleft forte (GPL/AGPL), já que este
repositório é privado.

## Fontes

| Fonte | Uso | Licença |
|---|---|---|
| Pixelify Sans | display | SIL Open Font License 1.1 |
| Departure Mono | terminal e tabelas | SIL Open Font License 1.1 |

Ambas auto-hospedadas em `app/fontes/`, com o arquivo de licença ao lado do arquivo da
fonte. A OFL permite uso comercial e incorporação; exige que a licença acompanhe a fonte e
proíbe vender a fonte isolada.

## Imagens

Não há imagens de terceiros neste projeto, e essa é uma decisão deliberada. Todo elemento
visual é pixel art própria, gerada como SVG a partir de matrizes em `components/sprites/`.
Elimina a categoria inteira de risco de direito autoral sobre imagem.

## Conteúdo publicado

Texto publicado em `paginas` é produzido pelos agentes e passa por checagem de originalidade
antes de ir ao ar: sequência de 8 ou mais palavras idêntica a uma fonte consultada bloqueia
a publicação. Citação curta é permitida, com atribuição e link para a origem.
