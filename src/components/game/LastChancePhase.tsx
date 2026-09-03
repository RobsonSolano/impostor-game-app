import { useCallback, useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { Hourglass } from 'lucide-react-native'
import { AppText } from '@/components/ui/Text'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { PhaseShell } from '@/components/shared/PhaseShell'
import { PlayerAvatar } from '@/components/shared/PlayerAvatar'
import { Countdown } from '@/components/shared/Countdown'
import { WaitingPill } from '@/components/shared/WaitingPill'
import { expireLastChance, submitGuess } from '@/lib/game/actions'
import { toDisplayError } from '@/lib/game/errors'
import { haptics } from '@/lib/haptics'
import { alpha, colors } from '@/theme/colors'
import { motion, radius, space } from '@/theme/tokens'
import type { PhaseProps } from '@/components/game/types'
import type { PlayerCard } from '@/lib/types'

/**
 * Espelha `interval '5 seconds'` em `resolve_voting`. Quem manda no prazo é o
 * banco (`rooms.guess_deadline`); isto só desenha a contagem.
 */
const TOTAL_MS = 5_000

type LastChancePhaseProps = PhaseProps & {
  card: PlayerCard | null
}

/** Última Chance do Impostor (IMP-15 a IMP-17). */
export function LastChancePhase({ room, players, me, card }: LastChancePhaseProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const expireRequested = useRef(false)

  const amImpostor = card?.is_impostor ?? false
  const options = card?.last_chance_options ?? []
  const eliminated = players.find((player) => player.id === room.eliminated_player_id)

  // A mesa toda sente que o jogo virou: dispara uma vez ao entrar nesta fase,
  // não a cada render (o efeito com deps vazias garante isso).
  useEffect(() => {
    haptics.suspense()
  }, [])

  /**
   * Postgres não dispara nada sozinho: quem finaliza é um cliente cujo timer
   * zerou. A função é idempotente no banco, então todos chamando é inofensivo —
   * o `ref` só evita repetir a chamada deste aparelho.
   */
  const handleExpire = useCallback(() => {
    if (expireRequested.current) return
    expireRequested.current = true
    void expireLastChance(room.id).catch(() => {
      // Outro cliente chegou primeiro. O Realtime traz o resultado.
    })
  }, [room.id])

  async function guess(word: string) {
    if (busy) return
    haptics.press()
    setBusy(true)
    setError(null)
    try {
      await submitGuess(room.id, word)
    } catch (err) {
      setError(toDisplayError(err))
      setBusy(false)
    }
  }

  // `key` no prazo: prazo novo precisa de instância nova do contador.
  const countdown = (
    <Countdown
      key={room.guess_deadline}
      deadline={room.guess_deadline}
      totalMs={TOTAL_MS}
      onExpire={handleExpire}
      tone="violet"
    />
  )

  if (!amImpostor) {
    return (
      <PhaseShell
        eyebrow="Última Chance"
        title={`${eliminated?.name ?? 'O suspeito'} era o impostor!`}
        // Sem "ele/ela": o app não sabe o gênero de ninguém na mesa.
        subtitle="São 5 segundos para adivinhar a palavra e roubar a vitória de vocês."
        action={<WaitingPill label="Aguardando o palpite" icon={Hourglass} />}
      >
        <Card tone="violet" style={styles.waitingCard}>
          {eliminated && <PlayerAvatar player={eliminated} size="lg" />}
          {countdown}
          <AppText variant="caption" tone="muted" align="center" style={styles.waitingCaption}>
            Se acertar, a vitória é do impostor. Se errar ou o tempo acabar, vocês
            ganham.
          </AppText>
        </Card>
      </PhaseShell>
    )
  }

  return (
    <PhaseShell
      eyebrow="Última Chance"
      title="Você foi descoberto!"
      subtitle="Acerte a palavra e a vitória é sua. Uma tentativa, 5 segundos."
      action={
        error ? (
          <AppText tone="danger" weight="medium" align="center" accessibilityLiveRegion="polite">
            {error}
          </AppText>
        ) : (
          <AppText variant="caption" tone="muted" align="center">
            {me.name}, escolha rápido — sem confirmação.
          </AppText>
        )
      }
    >
      <Card tone="violet" glow style={styles.countdownCard}>
        {countdown}
      </Card>

      {options.length === 0 ? (
        <View style={styles.loadingRow}>
          <Spinner size={16} />
          <AppText variant="caption" tone="muted">
            Carregando as opções…
          </AppText>
        </View>
      ) : (
        <View style={styles.optionList}>
          {options.map((word) => (
            <GuessOption key={word} word={word} disabled={busy} onPress={() => void guess(word)} />
          ))}
        </View>
      )}
    </PhaseShell>
  )
}

/**
 * Uma opção de palpite. Tocar já envia — sem confirmação, o prazo é de 5
 * segundos. O `scale` no toque é o único feedback antes do envio.
 */
function GuessOption({
  word,
  disabled,
  onPress,
}: {
  word: string
  disabled: boolean
  onPress: () => void
}) {
  const scale = useSharedValue(1)
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  return (
    <Animated.View style={style}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={word}
        testID={`guess-${word}`}
        disabled={disabled}
        onPressIn={() => {
          scale.value = withSpring(0.97, motion.springSnappy)
        }}
        onPressOut={() => {
          scale.value = withSpring(1, motion.springSnappy)
        }}
        onPress={onPress}
        style={[styles.option, disabled && styles.optionDisabled]}
      >
        <AppText variant="subtitle" weight="semibold">
          {word}
        </AppText>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  waitingCard: {
    alignItems: 'center',
    gap: space[6],
  },
  waitingCaption: {
    maxWidth: '80%',
  },
  countdownCard: {
    marginBottom: space[5],
    alignItems: 'center',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    paddingVertical: space[8],
  },
  optionList: {
    gap: space[2],
  },
  option: {
    minHeight: space[16],
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius['2xl'],
    borderWidth: 2,
    borderColor: alpha.transparent,
    backgroundColor: colors.card,
    padding: space[4],
  },
  optionDisabled: {
    opacity: 0.5,
  },
})
