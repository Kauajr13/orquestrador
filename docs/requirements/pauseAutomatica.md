# Requisitos da Função `pauseAutomatica`

A função `pauseAutomatica` tem como objetivo controlar fluxos automáticos em ciclos de execução, evitando que um processo continue a executar indefinidamente quando não houver progresso. Ela pode ser usada por módulos que executam *ticks* ou *iterações* e precisam de uma política de pausa automática quando a operação não avança.

## 1. Gatilho de Pausa

O gatilho que aciona a pausa deve ser **consecutiveTicksSemProgresso**:

- **consecutiveTicksSemProgresso**: contador de ticks consecutivos em que a operação não reportou progresso (`progress: false`). Quando o número de ticks consecutivos alcança **`maxTicksSemProgresso`**, a pausa automática é disparada.

- **maxTicksSemProgresso**: parâmetro de configuração (ex.: 5 ticks). Este valor pode ser passado como argumento para a função ou definido em arquivo de configuração.

## 2. Duração da Pausa

A duração da pausa pode ser especificada de duas maneiras:

1. **tempoEmMs** – tempo em milissegundos que o fluxo ficará suspenso.
2. **numeroDeIteracoes** – quantidade de iterações que o fluxo deve esperar antes de re‑iniciar.

A escolha depende do contexto em que a função será usada:
- Em processos **I/O‑intensivos** (ex.: chamadas de API), use `tempoEmMs`.
- Em loops **CPU‑intensivos**, use `numeroDeIteracoes`.

## 3. Interface da Função

```ts
/**
 * Pausa o fluxo automático quando há X ticks consecutivos sem progresso.
 *
 * @param options
 * @property maxTicksSemProgresso Número máximo de ticks consecutivos sem progresso antes de pausar.
 * @property pausaEmMs (opcional) Duração da pausa em milissegundos. Se omitido, a função usa `numeroDeIteracoes`.
 * @property numeroDeIteracoes (opcional) Número de iterações de espera quando `pausaEmMs` não for fornecido.
 * @property getProgress Função síncrona que retorna `true` se houve progresso no tick atual.
 * @returns Promise<void> que resolve após a pausa ser concluída.
 */
export async function pauseAutomatica(options: {
    maxTicksSemProgresso: number;
    pausaEmMs?: number;
    numeroDeIteracoes?: number;
    getProgress: () => boolean;
}): Promise<void>;
```

- `getProgress` é responsável por verificar se o tick atual trouxe alguma mudança significativa. A função interna do módulo chamará `pauseAutomatica` passando a verificação de progresso.

## 4. Exemplos de Uso

### Exemplo 1 – Pausa baseada em tempo (milissegundos)

```ts
import { pauseAutomatica } from '@/lib/pauses';

async function processTick() {
    const progresso = await executarAlgoritmo();
    await pauseAutomatica({
        maxTicksSemProgresso: 5,
        pausaEmMs: 2000,
        getProgress: () => progresso,
    });
}
```

Neste caso, se `executarAlgoritmo` não indicar progresso em 5 ticks consecutivos, a execução será suspensa por 2 segundos antes de continuar.

### Exemplo 2 – Pausa baseada em iterações

```ts
import { pauseAutomatica } from '@/lib/pauses';

async function processTick() {
    const progresso = await fazerRequisicao();
    await pauseAutomatica({
        maxTicksSemProgresso: 3,
        numeroDeIteracoes: 4,
        getProgress: () => progresso,
    });
}
```

Aqui, após 3 ticks sem progresso, o fluxo esperará 4 iterações antes de re‑tentar.

## 5. Observações

- A função deve ser **idempotente**: chamadas subsequentes com o mesmo estado não devem acumular tempos de pausa.
- Se ambos `pausaEmMs` e `numeroDeIteracoes` forem omitidos, a função deve lançar um erro de configuração.
- O contador de ticks consecutivos deve ser mantido **externamente** (por exemplo, dentro do módulo que chama `pauseAutomatica`) para que cada instância de fluxo tenha seu próprio contador.
- A função deve ser escrita de forma a não bloquear o **event loop**. Para `tempoEmMs` utilize `setTimeout` dentro de `Promise`. Para `numeroDeIteracoes` simplesmente retorne a promessa sem esperar.

## 6. Integração com Outros Módulos

- Módulos que implementam *retrospectiva semanal* ou *processamento de fila* podem integrar `pauseAutomatica` para garantir que não ultrapassem o limite de 40 passos por execução.
- O `retrospectiva-semanal` pode usar `pauseAutomatica` para pausar a coleta de dados quando detectar ausência de novos registros.

---

**Nota**: Esta documentação serve como referência para desenvolvedores e para validar a implementação futura da função `pauseAutomatica`.
