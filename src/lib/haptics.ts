import * as Haptics from 'expo-haptics'
import { Platform } from 'react-native'

/**
 * Vibração — a camada que o web não tinha.
 *
 * O jogo é passado de mão em mão numa mesa de bar: a tela está longe, o barulho
 * é alto, e quem está com o celular olha para as outras pessoas, não para o
 * aparelho. A vibração é o canal que sempre chega — é ela que diz "chegou sua
 * vez" sem a mesa inteira ouvir.
 *
 * A API é POR INTENÇÃO, não por primitiva: os componentes chamam
 * `haptics.suspense()`, nunca `Haptics.impactAsync(Heavy)`. Isso mantém o
 * vocabulário do jogo num lugar só — mudar o "peso" de um evento é mudar uma
 * linha aqui, não caçar chamadas por dez telas.
 *
 * Toda função é fire-and-forget e engole o próprio erro. Vibração é enfeite:
 * aparelho sem motor (simulador, tablet, Android com haptics desligado no
 * sistema) devolve rejeição, e um `await` sem `catch` derrubaria a ação de jogo
 * junto. Nada aqui pode fazer um voto falhar.
 */

/** Aparelho sem motor de vibração: no simulador iOS as chamadas rejeitam. */
const SUPPORTED = Platform.OS === 'ios' || Platform.OS === 'android'

function fire(run: () => Promise<void>) {
  if (!SUPPORTED) return
  void run().catch(() => {
    // Sem motor, sem permissão, ou desligado no sistema. Segue o jogo.
  })
}

export const haptics = {
  /** Toque em qualquer alvo secundário. O "clique" do app. */
  tap() {
    fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light))
  },

  /** Seleção mudou: aba trocada, suspeito marcado, opção escolhida. */
  select() {
    fire(() => Haptics.selectionAsync())
  },

  /** Ação primária confirmada: criar sala, iniciar partida, enviar dica. */
  press() {
    fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium))
  },

  /** Algo pesado aconteceu: card revelado, jogador eliminado. */
  thud() {
    fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy))
  },

  /** Deu certo: dica aceita, voto registrado, palavra adivinhada. */
  success() {
    fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success))
  },

  /** Aviso sem falha: prazo entrando no fim, aviso de palavra vulgar. */
  warn() {
    fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning))
  },

  /** Deu errado: erro de regra, expulsão, tempo esgotado sem resposta. */
  error() {
    fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error))
  },

  /**
   * Pulso curto e rígido, para tique de contagem.
   *
   * `Rigid` e não `Light`: numa sequência de segundos, o pulso rígido é seco e
   * some, enquanto o leve "borra" e vira zumbido.
   */
  tick() {
    fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid))
  },

  /** Pulso macio, para revelação progressiva (o hold do card secreto). */
  soft() {
    fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft))
  },

  /**
   * Sequência de suspense — três pulsos crescentes.
   *
   * Usada no drumroll da apuração e ao virar o card do impostor. Os atrasos são
   * `setTimeout` soltos de propósito: encadear com `await` prenderia quem chamou
   * por ~400ms, e nenhuma tela pode esperar por vibração.
   */
  suspense() {
    if (!SUPPORTED) return
    fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light))
    setTimeout(
      () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
      140,
    )
    setTimeout(
      () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
      320,
    )
  },

  /**
   * Fanfarra de vitória — sucesso seguido de dois pulsos.
   *
   * Só no desfecho da partida. Vibração longa em qualquer outro momento vira
   * incômodo, não festa.
   */
  fanfare() {
    if (!SUPPORTED) return
    fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success))
    setTimeout(
      () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
      180,
    )
    setTimeout(
      () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
      340,
    )
  },

  /** Derrota — dois pulsos graves e espaçados. */
  defeat() {
    if (!SUPPORTED) return
    fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error))
    setTimeout(
      () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
      260,
    )
  },
}

export type Haptic = keyof typeof haptics
