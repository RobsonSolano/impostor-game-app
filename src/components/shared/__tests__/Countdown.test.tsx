import { act, render } from '@testing-library/react-native'
import { Countdown } from '@/components/shared/Countdown'

/**
 * Passo pequeno de avanço do relógio falso, cada um dentro do seu próprio
 * `act()` assíncrono.
 *
 * Por quê não um `advanceTimersByTime(ms)` só, de uma vez: o `Countdown`
 * reagenda o próximo `setTimeout` dentro de um `useEffect` disparado pelo
 * `setState` do tique anterior (é a cadeia descrita no comentário do próprio
 * componente). Avançar tudo de uma vez move o relógio falso ANTES do React
 * ter a chance de rodar esse efeito e agendar o PRÓXIMO `setTimeout` — então
 * só o primeiro elo da cadeia chega a disparar, e o resto do tempo passa em
 * branco (confirmado depurando: um `advanceTimersByTime(350)` só rendia UM
 * tique de 100ms, nunca os três esperados). Avançar em passos pequenos, cada
 * um dentro do seu próprio `act`, dá ao React a chance de reagendar antes do
 * próximo pedaço de tempo passar — igual ao que acontece de verdade num
 * aparelho, onde cada 100ms decorre em wall-clock antes do próximo, nunca
 * todos de uma vez numa única instrução síncrona.
 */
const STEP_MS = 25

async function tick(ms: number) {
  const steps = Math.ceil(ms / STEP_MS)
  for (let i = 0; i < steps; i++) {
     
    await act(async () => {
      await jest.advanceTimersByTimeAsync(STEP_MS)
    })
  }
}

/**
 * O que importa provar (contrato em `.specs/CONTRACTS.md`): `onExpire` dispara
 * exatamente uma vez quando o prazo vence, nunca antes, e o número exibido
 * nunca ultrapassa `totalMs` mesmo com um `deadline` "no futuro" — o caso de
 * um celular com o relógio adiantado, que não é raro. Não testamos a barra/anel
 * (estilo), só o comportamento do prazo.
 */
describe('Countdown (contrato: onExpire único, restante limitado a totalMs)', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('não chama onExpire antes do prazo vencer', async () => {
    const onExpire = jest.fn()
    const deadline = new Date(Date.now() + 5000).toISOString()

    render(<Countdown key={deadline} deadline={deadline} totalMs={5000} onExpire={onExpire} />)

    await tick(2000)
    expect(onExpire).not.toHaveBeenCalled()
  })

  it('chama onExpire exatamente uma vez quando o prazo vence', async () => {
    const onExpire = jest.fn()
    const deadline = new Date(Date.now() + 300).toISOString()

    render(<Countdown key={deadline} deadline={deadline} totalMs={300} onExpire={onExpire} />)

    await tick(300)
    expect(onExpire).toHaveBeenCalledTimes(1)

    // Continuar o relógio correndo (re-renders, timers residuais) não pode
    // disparar de novo.
    await tick(1000)
    expect(onExpire).toHaveBeenCalledTimes(1)
  })

  it('limita o restante a totalMs quando o relógio do aparelho está adiantado', () => {
    const onExpire = jest.fn()
    // Prazo "no futuro" muito além de `totalMs`: um celular com a hora errada,
    // adiantada, faria `deadline - Date.now()` estourar o valor cheio.
    const farFutureDeadline = new Date(Date.now() + 999_999).toISOString()

    const { getByLabelText } = render(
      <Countdown
        key={farFutureDeadline}
        deadline={farFutureDeadline}
        totalMs={10_000}
        onExpire={onExpire}
      />,
    )

    // O restante inicial tem que ser limitado a `totalMs` (10s), nunca ao
    // valor bruto do cálculo (quase 1000s).
    expect(getByLabelText('10 segundos restantes')).toBeTruthy()
  })

  it('conta os segundos exibidos para baixo conforme o tempo passa', async () => {
    const onExpire = jest.fn()
    const deadline = new Date(Date.now() + 5000).toISOString()

    const { getByLabelText } = render(
      <Countdown key={deadline} deadline={deadline} totalMs={5000} onExpire={onExpire} />,
    )

    expect(getByLabelText('5 segundos restantes')).toBeTruthy()

    await tick(2000)
    expect(getByLabelText('3 segundos restantes')).toBeTruthy()
  })
})
