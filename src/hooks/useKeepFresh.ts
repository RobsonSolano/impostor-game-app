import { useEffect, useRef, useState } from 'react'
import { AppState, type AppStateStatus } from 'react-native'

/** Intervalo do backstop. Uma linha de `rooms` é minúscula; o custo é irrelevante. */
const POLL_MS = 8_000

/**
 * Sinal de "hora de ressincronizar", como rede de segurança contra evento de
 * Realtime perdido.
 *
 * ORIGEM (partida real travada no web, sala TQAK): o jogo começou, os três
 * confirmaram o card, o banco moveu a sala para DISCUSSION e sorteou a ordem — e
 * nenhum aparelho saiu da tela do card. Ninguém foi chamado para escrever, e o
 * prazo ficou vencido para sempre porque nenhum cliente estava na tela que
 * dispara `expire_clue_turn`. Dois dos jogadores estavam parados havia 15
 * minutos, com a tela bloqueada e o WebSocket morto.
 *
 * O app dependia SÓ de Realtime depois da carga inicial, então um evento perdido
 * congelava a tela sem saída.
 *
 * **No celular isso é pior que no web, não melhor.** No navegador, uma aba em
 * segundo plano continua viva; num celular o SO suspende o processo inteiro, e o
 * jogo é justamente passado de mão em mão — o aparelho fica minutos na mesa com
 * a tela apagada, que é exatamente a condição do travamento.
 *
 * Dois gatilhos (a versão web tem três; ver abaixo por que aqui são dois):
 *
 * 1. **Voltar para `active`** — aparelho desbloqueado, app retomado do
 *    segundo plano. É o caso exato do travamento, e o mais barato: ressincroniza
 *    no instante em que a pessoa olha a tela.
 * 2. **Sondagem periódica enquanto ativo** — o caso cruel do socket zumbi, que
 *    não reporta erro nenhum e simplesmente para de entregar. Sem isto, o
 *    gatilho 1 nunca chega a disparar num aparelho que ficou o tempo todo aceso.
 *
 * O terceiro gatilho do web (`online`, rede voltando) **não tem equivalente sem
 * dependência nova**: detectar rede em RN exige `@react-native-community/netinfo`.
 * Ficou de fora de propósito — a sondagem de 8s cobre o mesmo caso com atraso de
 * no máximo 8 segundos, e não vale um módulo nativo a mais no jogo por isso.
 *
 * Só sonda com o app em primeiro plano: sondar suspenso não funcionaria (o SO
 * congela os timers) e gastaria bateria para atualizar uma tela que ninguém está
 * olhando — e o gatilho 1 cobre a volta.
 *
 * Devolve um contador em vez de receber a função de recarga porque um Effect
 * Event não pode ser passado para outro hook. Quem chama reage à mudança do
 * contador com o próprio efeito.
 */
export function useKeepFresh(enabled: boolean): number {
  const [tick, setTick] = useState(0)

  /**
   * Último estado de `AppState` observado.
   *
   * Sem esta comparação, transições que NÃO são uma volta ao primeiro plano
   * (`active` → `inactive` no iOS ao arrastar a central de controle, por
   * exemplo) também contariam, e o app faria fetch ao TOCAR a tela.
   */
  const lastState = useRef<AppStateStatus>(AppState.currentState)

  useEffect(() => {
    if (!enabled) return

    const bump = () => setTick((n) => n + 1)

    const subscription = AppState.addEventListener('change', (next) => {
      const voltou = lastState.current !== 'active' && next === 'active'
      lastState.current = next
      if (voltou) bump()
    })

    const id = setInterval(() => {
      // Guarda para o caso de o SO deixar um tique escapar na transição: com o
      // app fora do primeiro plano, ressincronizar não serve para nada.
      if (AppState.currentState === 'active') bump()
    }, POLL_MS)

    return () => {
      subscription.remove()
      clearInterval(id)
    }
  }, [enabled])

  return tick
}
