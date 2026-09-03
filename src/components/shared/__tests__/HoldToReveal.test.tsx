import { act, fireEvent, render } from '@testing-library/react-native'
import { AppState, Text } from 'react-native'
import type { AppStateStatus } from 'react-native'
import { HoldToReveal } from '@/components/shared/HoldToReveal'

const SECRET = 'Hospital'

/**
 * Assinatura de retorno de `AppState.addEventListener` derivada da própria
 * função (em vez de importar `EventSubscription` de `react-native`): o pacote
 * carrega DOIS `.d.ts` divergentes para esse tipo (um gerado a partir do Flow,
 * outro legado ao lado do `.js`), e o legado exige campos internos
 * (`eventType`, `key`, `subscriber`) que não fazem sentido aqui. `ReturnType`
 * pega o que o TS realmente resolve para `AppState.addEventListener` neste
 * projeto, sem apostar em qual dos dois `.d.ts` vence.
 */
type AppStateSubscription = ReturnType<typeof AppState.addEventListener>

/**
 * Substitui `AppState.addEventListener` por um espião que guarda o callback em
 * vez de registrar de verdade — é assim que o teste consegue disparar uma
 * mudança de estado do app (`background`) sem depender de nenhum evento nativo
 * de verdade, que não existe no Jest.
 */
function spyOnAppStateChange() {
  const listeners: ((status: AppStateStatus) => void)[] = []

  jest.spyOn(AppState, 'addEventListener').mockImplementation(((
    type: string,
    handler: (status: AppStateStatus) => void,
  ): AppStateSubscription => {
    if (type === 'change') listeners.push(handler)
    return { remove: jest.fn() } as AppStateSubscription
  }) as typeof AppState.addEventListener)

  return (status: AppStateStatus) => {
    act(() => {
      listeners.forEach((handler) => handler(status))
    })
  }
}

function renderCard(holdMs = 2000, onReveal?: () => void) {
  return render(
    <HoldToReveal holdMs={holdMs} onReveal={onReveal}>
      <Text>{SECRET}</Text>
    </HoldToReveal>,
  )
}

/** Avança o cronômetro fixo (`TICK_MS`) do componente dentro de `act`, para o setState do intervalo já ter sido processado antes da asserção. */
function hold(ms: number) {
  act(() => {
    jest.advanceTimersByTime(ms)
  })
}

/**
 * O que importa provar aqui (regra 8 do AGENTS.md): o segredo NUNCA existe na
 * árvore de componentes fora da janela exata em que o dedo está pressionado E
 * o prazo já venceu. Não testamos estilo (opacidade, blur) — testamos
 * presença/ausência real do texto, que é a única prova de que não é
 * "escondido por CSS".
 */
describe('HoldToReveal (regra 8 do AGENTS.md — card secreto)', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it('não coloca o segredo na árvore antes de qualquer toque', () => {
    const { queryByText } = renderCard()
    expect(queryByText(SECRET)).toBeNull()
  })

  it('mantém o segredo fora da árvore durante a pressão, antes do prazo', () => {
    const { getByTestId, queryByText } = renderCard(2000)
    fireEvent(getByTestId('hold-to-reveal'), 'pressIn')

    hold(1960)
    expect(queryByText(SECRET)).toBeNull()
  })

  it('revela o segredo exatamente ao completar o prazo de pressão', () => {
    const { getByTestId, getByText } = renderCard(2000)
    fireEvent(getByTestId('hold-to-reveal'), 'pressIn')

    hold(2000)
    expect(getByText(SECRET)).toBeTruthy()
  })

  it('remove o segredo da árvore ao soltar o dedo', () => {
    const { getByTestId, getByText, queryByText } = renderCard(2000)
    const card = getByTestId('hold-to-reveal')

    fireEvent(card, 'pressIn')
    hold(2000)
    expect(getByText(SECRET)).toBeTruthy()

    fireEvent(card, 'pressOut')
    expect(queryByText(SECRET)).toBeNull()
  })

  it('remove o segredo quando a pressão é interrompida antes do prazo (dedo escorregando para fora, ou o sistema interrompendo o toque)', () => {
    // No RN, `onPressOut` é o mesmo callback que o `Pressable` chama tanto ao
    // soltar dentro da área quanto quando o responder é terminado por fora
    // (dedo saindo do retângulo de toque, ou uma interrupção do sistema como
    // ligação entrando) — não existem dois caminhos distintos para simular.
    const { getByTestId, queryByText } = renderCard(2000)
    const card = getByTestId('hold-to-reveal')

    fireEvent(card, 'pressIn')
    hold(500)
    fireEvent(card, 'pressOut')

    hold(2000)
    expect(queryByText(SECRET)).toBeNull()
  })

  it('zera o progresso ao soltar, exigindo o prazo completo de novo', () => {
    const { getByTestId, getByText, queryByText } = renderCard(2000)
    const card = getByTestId('hold-to-reveal')

    // Quase revelou, mas soltou.
    fireEvent(card, 'pressIn')
    hold(1800)
    fireEvent(card, 'pressOut')

    // Segurar só o tempo que faltava não pode revelar.
    fireEvent(card, 'pressIn')
    hold(400)
    expect(queryByText(SECRET)).toBeNull()

    hold(1600)
    expect(getByText(SECRET)).toBeTruthy()
  })

  it('não avança o progresso sem nenhuma pressão', () => {
    const { queryByText } = renderCard(2000)
    hold(5000)
    expect(queryByText(SECRET)).toBeNull()
  })

  it('chama onReveal uma única vez ao revelar, mesmo continuando pressionado', () => {
    const onReveal = jest.fn()
    // Múltiplo exato do passo interno (`TICK_MS`), como os demais números
    // deste arquivo — 500 não seria um múltiplo de 40 e o tique que cruza o
    // prazo só ocorre em t=520, deixando `hold(500)` um tique curto.
    const { getByTestId } = renderCard(480, onReveal)
    const card = getByTestId('hold-to-reveal')

    fireEvent(card, 'pressIn')
    hold(480)
    expect(onReveal).toHaveBeenCalledTimes(1)

    hold(300)
    expect(onReveal).toHaveBeenCalledTimes(1)
  })

  /**
   * Regressão: gesto de app switcher (ou botão de bloqueio) com o dedo AINDA
   * na tela. O SO não cancela o toque — não existe `onPressOut` nesse caso —
   * então, sem o listener de `AppState`, o segredo continuava montado
   * exatamente quando o SO tira o snapshot do app para o multitarefa, e ia
   * para o preview do celular. `HoldToReveal` amarra o esconder também ao
   * ciclo de vida do app, não só ao toque.
   */
  it('remove o segredo da árvore quando o app vai para segundo plano com o dedo ainda na tela', () => {
    const emitAppState = spyOnAppStateChange()
    const { getByTestId, getByText, queryByText } = renderCard(2000)
    const card = getByTestId('hold-to-reveal')

    fireEvent(card, 'pressIn')
    hold(2000)
    expect(getByText(SECRET)).toBeTruthy()

    // Sem soltar o dedo: só o app saindo para segundo plano.
    emitAppState('background')

    expect(queryByText(SECRET)).toBeNull()
  })
})
