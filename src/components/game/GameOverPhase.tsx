import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { PartyPopper, RotateCcw, Skull } from 'lucide-react-native'
import { AppText } from '@/components/ui/Text'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PhaseShell } from '@/components/shared/PhaseShell'
import { PlayerAvatar } from '@/components/shared/PlayerAvatar'
import { WaitingPill } from '@/components/shared/WaitingPill'
import { Confetti } from '@/components/shared/Confetti'
import { playAgain } from '@/lib/game/actions'
import { countOf } from '@/lib/plural'
import { toDisplayError } from '@/lib/game/errors'
import { haptics } from '@/lib/haptics'
import { colors } from '@/theme/colors'
import { motion, radius, space } from '@/theme/tokens'
import { OUTCOME_LABELS, type VoteTally } from '@/lib/types'
import type { PhaseProps } from '@/components/game/types'

const DRUMROLL_SECONDS = 5

/** `w-48` (12rem = 192px) do web, composto só de tokens de espaço. */
const DRUMROLL_BAR_WIDTH = space[20] + space[16] + space[12]

export function GameOverPhase({ room, players, me, isHost }: PhaseProps) {
  const [secondsLeft, setSecondsLeft] = useState(DRUMROLL_SECONDS)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const insets = useSafeAreaInsets()

  const revealed = secondsLeft <= 0

  /**
   * Drumroll (IMP-24), com contagem visível 5 → 0.
   *
   * Roda uma vez por partida: o componente é montado do zero quando
   * `rooms.status` entra em GAME_OVER. Cadeia de `setTimeout` em vez de
   * `setInterval` — o `setState` fica no callback (não no corpo do efeito) e a
   * contagem se encerra sozinha ao chegar em zero.
   *
   * Puro suspense: nada aqui decide resultado. O placar já está gravado no
   * banco antes desta tela aparecer.
   */
  useEffect(() => {
    if (secondsLeft <= 0) return
    const id = setTimeout(() => {
      const next = secondsLeft - 1
      // Um tique por segundo, e NADA no instante em que revela: a vibração da
      // revelação é a fanfarra (ou a derrota) do efeito abaixo, que dispara no
      // mesmo commit. Somar um `suspense()` aqui punha 6 pulsos sobrepostos em
      // 340ms, e o momento mais dramático do jogo virava um zumbido único.
      if (next > 0) haptics.tick()
      setSecondsLeft(next)
    }, 1000)
    return () => clearTimeout(id)
  }, [secondsLeft])

  const impostor = players.find((player) => player.id === room.revealed_impostor_id)
  const eliminated = players.find((player) => player.id === room.eliminated_player_id)
  const tally = room.last_vote_tally as VoteTally | null
  const impostorWon = room.outcome === 'IMPOSTOR_WIN' || room.outcome === 'IMPOSTOR_STEAL'
  const iAmImpostor = impostor?.id === me.id
  const iWon = iAmImpostor === impostorWon

  // Fanfarra ou derrota no instante exato da revelação — nunca a cada render:
  // o efeito só reage à transição de `revealed` para verdadeiro.
  useEffect(() => {
    if (!revealed) return
    if (iWon) {
      haptics.fanfare()
    } else {
      haptics.defeat()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `iWon` vem do placar já gravado no banco; não muda durante esta fase.
  }, [revealed])

  const scoreboard = [...players].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))

  async function again() {
    setBusy(true)
    setError(null)
    try {
      await playAgain(room.id)
    } catch (err) {
      setError(toDisplayError(err))
      setBusy(false)
    }
  }

  if (!revealed) {
    return (
      <View
        style={[
          styles.drumrollScreen,
          { paddingTop: insets.top + space[8], paddingBottom: insets.bottom + space[8] },
        ]}
      >
        <PulsingSkull />

        <View style={styles.drumrollHeading}>
          <AppText variant="title" weight="bold" align="center">
            Apurando os votos…
          </AppText>
          <AppText variant="body" tone="muted" align="center">
            {eliminated ? `A mesa escolheu ${eliminated.name}.` : 'Contando.'}
          </AppText>
        </View>

        {/* `key` no número: cada segundo entra com um pulso próprio em vez de o
            texto trocar sem aviso. */}
        <DrumrollNumber key={secondsLeft} value={secondsLeft} />

        <DrumrollProgress secondsLeft={secondsLeft} />
      </View>
    )
  }

  return (
    <>
      <PhaseShell
        eyebrow={`Partida ${room.games_played}`}
        title={room.outcome ? OUTCOME_LABELS[room.outcome] : 'Fim de jogo'}
        subtitle={iWon ? 'Você marcou pontos nesta rodada.' : 'Não foi dessa vez.'}
        aside={
          <>
            {tally && (
              <View style={styles.asideBlock}>
                <AppText variant="label" weight="semibold" style={styles.asideHeading}>
                  Votação final
                </AppText>
                <View style={styles.rowList}>
                  {players
                    .filter((player) => (tally.players[player.id] ?? 0) > 0)
                    .sort((a, b) => (tally.players[b.id] ?? 0) - (tally.players[a.id] ?? 0))
                    .map((player) => {
                      const votes = tally.players[player.id] ?? 0
                      return (
                        <View key={player.id} style={styles.tallyRow}>
                          <PlayerAvatar player={player} size="sm" />
                          <AppText
                            variant="label"
                            weight="medium"
                            numberOfLines={1}
                            style={styles.rowName}
                          >
                            {player.name}
                          </AppText>
                          <AppText variant="label" tone="muted" tabular>
                            {countOf(votes, 'voto', 'votos')}
                          </AppText>
                        </View>
                      )
                    })}
                  {tally.skip > 0 && (
                    <View style={styles.skipTallyRow}>
                      <AppText variant="label" tone="muted" style={styles.rowName}>
                        Pular votação
                      </AppText>
                      <AppText variant="label" tone="muted" tabular>
                        {countOf(tally.skip, 'voto', 'votos')}
                      </AppText>
                    </View>
                  )}
                </View>
              </View>
            )}

            <AppText variant="label" weight="semibold" style={styles.asideHeading}>
              Placar da sala
            </AppText>
            <View style={styles.rowList}>
              {scoreboard.map((player, index) => (
                <View key={player.id} style={styles.tallyRow}>
                  <AppText variant="label" weight="bold" tone="muted" tabular style={styles.rank}>
                    {index + 1}
                  </AppText>
                  <PlayerAvatar player={player} size="sm" />
                  <AppText variant="label" weight="medium" numberOfLines={1} style={styles.rowName}>
                    {player.name}
                    {player.id === me.id && (
                      <AppText variant="label" tone="muted"> (você)</AppText>
                    )}
                  </AppText>
                  <AppText variant="label" weight="bold" tabular>
                    {player.score}
                  </AppText>
                </View>
              ))}
            </View>
          </>
        }
        // O botão de novo jogo aparece em QUALQUER desfecho — vitória dos
        // verdadeiros, do impostor ou roubo na Última Chance. Ninguém sai da
        // sala: muda a palavra e o impostor é sorteado de novo. (IMP-19)
        action={
          isHost ? (
            <View style={styles.actionColumn}>
              {error && (
                <AppText tone="danger" weight="medium" accessibilityLiveRegion="polite">
                  {error}
                </AppText>
              )}
              <Button
                label="Novo jogo"
                onPress={() => void again()}
                disabled={busy}
                busy={busy}
                icon={RotateCcw}
                size="lg"
              />
              <AppText variant="caption" tone="muted" align="center">
                Mesma sala e mesmo placar. Nova palavra e novo sorteio de impostor.
              </AppText>
            </View>
          ) : (
            <WaitingPill label="O host pode começar um novo jogo" />
          )
        }
      >
        <Card
          tone={impostorWon ? 'danger' : 'primary'}
          glow
          style={styles.outcomeCard}
        >
          <View style={styles.outcomeHeading}>
            {impostorWon ? (
              <Skull size={24} color={colors.destructive} />
            ) : (
              <PartyPopper size={24} color={colors.primary} />
            )}
            <AppText variant="eyebrow" tone="muted">
              O impostor era
            </AppText>
          </View>

          {impostor && (
            <View style={styles.impostorBlock}>
              <PlayerAvatar player={impostor} size="lg" />
              <AppText variant="title" weight="bold">
                {impostor.name}
              </AppText>
            </View>
          )}

          <View style={styles.wordBlock}>
            <AppText variant="eyebrow" tone="muted">
              A palavra era
            </AppText>
            <AppText variant="display" tone="primary" weight="bold" align="center">
              {room.revealed_word}
            </AppText>
          </View>

          {room.outcome === 'IMPOSTOR_STEAL' && (
            <AppText tone="danger" weight="medium" align="center" style={styles.stealText}>
              O impostor foi descoberto, mas acertou a palavra na Última Chance e
              roubou a vitória.
            </AppText>
          )}
        </Card>
      </PhaseShell>

      {/*
        Confete DEPOIS do `PhaseShell`, não antes.

        Irmãos em React Native pintam na ordem em que aparecem: renderizado
        primeiro, o confete ficava atrás da tela inteira — que é opaca — e
        simplesmente não aparecia. Só depois é que ele cai por cima do resultado,
        que é onde a festa tem que estar.

        Só solta para quem venceu — perder não ganha festa.
      */}
      <Confetti active={iWon} tone="primary" />
    </>
  )
}

/** Crânio pulsando durante a apuração — puro suspense, sem informação nova. */
function PulsingSkull() {
  const scale = useSharedValue(1)
  const rotate = useSharedValue(0)

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.18, { duration: 300, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 300, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
    )
    rotate.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 200 }),
        withTiming(6, { duration: 200 }),
        withTiming(0, { duration: 200 }),
      ),
      -1,
    )
  }, [scale, rotate])

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${rotate.value}deg` }],
  }))

  return (
    <Animated.View style={style}>
      <Card tone="violet" glow style={styles.skullCard}>
        <Skull size={56} color={colors.violet} />
      </Card>
    </Animated.View>
  )
}

/** O número da contagem, com um pulso de entrada próprio a cada segundo novo. */
function DrumrollNumber({ value }: { value: number }) {
  const scale = useSharedValue(1.6)
  const opacity = useSharedValue(0.3)

  useEffect(() => {
    scale.value = withTiming(1, { duration: motion.base })
    opacity.value = withTiming(1, { duration: motion.base })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- roda uma vez por montagem (o pai remonta via `key={value}`)
  }, [])

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }))

  return (
    <Animated.View style={style}>
      <AppText
        variant="display"
        tone="violet"
        weight="black"
        tabular
        accessibilityLiveRegion="polite"
        accessibilityLabel={`Resultado em ${value} segundos`}
      >
        {value}
      </AppText>
    </Animated.View>
  )
}

/** Barra regressiva sob o número — reforço visual do mesmo prazo. */
function DrumrollProgress({ secondsLeft }: { secondsLeft: number }) {
  const progress = useSharedValue(1)

  useEffect(() => {
    progress.value = withTiming(secondsLeft / DRUMROLL_SECONDS, {
      duration: 900,
      easing: Easing.linear,
    })
  }, [secondsLeft, progress])

  const style = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }))

  return (
    <View style={styles.progressTrack}>
      <Animated.View style={[styles.progressFill, style]} />
    </View>
  )
}

const styles = StyleSheet.create({
  drumrollScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[8],
    paddingHorizontal: space[6],
  },
  skullCard: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  drumrollHeading: {
    gap: space[2],
  },
  progressTrack: {
    width: DRUMROLL_BAR_WIDTH,
    height: space[2],
    borderRadius: radius.full,
    backgroundColor: colors.muted,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.violet,
  },
  outcomeCard: {
    alignItems: 'center',
    gap: space[4],
    marginBottom: space[5],
  },
  outcomeHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  impostorBlock: {
    alignItems: 'center',
    gap: space[2],
  },
  wordBlock: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: space[4],
    alignItems: 'center',
    gap: space[1],
  },
  stealText: {
    maxWidth: '85%',
  },
  actionColumn: {
    gap: space[2],
  },
  asideBlock: {
    marginBottom: space[5],
  },
  asideHeading: {
    marginBottom: space[2],
  },
  rowList: {
    gap: space[1.5],
  },
  tallyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
  },
  skipTallyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    borderRadius: radius.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
  },
  rowName: {
    flex: 1,
    minWidth: 0,
  },
  rank: {
    width: space[5],
  },
})
