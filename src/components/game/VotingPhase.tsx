import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { SkipForward } from 'lucide-react-native'
import { AppText } from '@/components/ui/Text'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PhaseShell } from '@/components/shared/PhaseShell'
import { PlayerAvatar } from '@/components/shared/PlayerAvatar'
import { WaitingPill } from '@/components/shared/WaitingPill'
import { castVote } from '@/lib/game/actions'
import { toDisplayError } from '@/lib/game/errors'
import { haptics } from '@/lib/haptics'
import { alpha, colors } from '@/theme/colors'
import { motion, radius, space } from '@/theme/tokens'
import type { Player } from '@/lib/types'
import type { PhaseProps } from '@/components/game/types'

/**
 * Sentinela para "Pular Votação", que no banco é `target_player_id = NULL`.
 *
 * O tipo é `string | null` e não `string | typeof SKIP | null`: `typeof SKIP` é
 * o literal `'SKIP'`, que na união com `string` colapsa para `string` — a
 * intenção não sobreviveria ao compilador, e a assinatura mentiria sobre estar
 * garantindo algo. Quem distingue a sentinela é a comparação em `confirm()`, e o
 * risco real (um id de jogador igual a `'SKIP'`) não existe: `players.id` é uuid.
 */
const SKIP = 'SKIP'
type Selection = string | null

export function VotingPhase({ room, players, me }: PhaseProps) {
  const [selected, setSelected] = useState<Selection>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const alive = players.filter((player) => player.is_alive)
  const suspects = alive.filter((player) => player.id !== me.id)
  const votedCount = room.votes_cast

  function selectSuspect(playerId: string) {
    haptics.select()
    setSelected((prev) => (prev === playerId ? null : playerId))
  }

  function toggleSkip() {
    haptics.select()
    setSelected((prev) => (prev === SKIP ? null : SKIP))
  }

  async function confirm() {
    if (!selected) return
    setBusy(true)
    setError(null)
    try {
      await castVote(room.id, selected === SKIP ? null : selected)
      // Voto registrado: a mudança de tela vem do banco (`me.has_voted` via
      // Realtime), este pulso só confirma na hora que o voto "grudou".
      haptics.success()
    } catch (err) {
      setError(toDisplayError(err))
      setBusy(false)
    }
  }

  // Já votei: nada mais a fazer neste ciclo. `has_voted` vem do banco, então
  // reabrir o app cai aqui em vez de oferecer votar de novo.
  if (me.has_voted) {
    return (
      <PhaseShell
        eyebrow={`Votação ${room.voting_cycle}`}
        title="Voto registrado"
        subtitle="Ninguém vê em quem você votou. A apuração começa quando o último votar."
        action={<WaitingPill label={`${votedCount} de ${alive.length} já votaram`} />}
      >
        <Card style={styles.votedCard}>
          <View style={styles.votedAvatars}>
            {alive.map((player) => (
              <VotedAvatar key={player.id} player={player} />
            ))}
          </View>
          <AppText variant="caption" tone="muted" align="center" style={styles.votedCaption}>
            Os avatares acesos já votaram. Os apagados a mesa ainda espera.
          </AppText>
        </Card>
      </PhaseShell>
    )
  }

  return (
    <PhaseShell
      eyebrow={`Votação ${room.voting_cycle}`}
      title="Quem é o impostor?"
      subtitle="Toque em um suspeito. Se a mesa não se decidiu, pule e joguem mais uma rodada."
      action={
        <View style={styles.actionColumn}>
          {error && (
            <AppText tone="danger" weight="medium" accessibilityLiveRegion="polite">
              {error}
            </AppText>
          )}
          <Button
            label={selected === SKIP ? 'Confirmar: pular votação' : 'Confirmar voto'}
            onPress={() => void confirm()}
            disabled={!selected || busy}
            busy={busy}
            size="lg"
          />
          <AppText
            variant="caption"
            tone="muted"
            align="center"
            // Muda sozinho conforme a mesa vota, sem toque nenhum desta pessoa:
            // sem live region o leitor de tela nunca conta que o número andou.
            accessibilityLiveRegion="polite"
          >
            {votedCount} de {alive.length} já votaram
          </AppText>
        </View>
      }
    >
      <View style={styles.suspectList}>
        {suspects.map((player) => (
          <SuspectRow
            key={player.id}
            player={player}
            selected={selected === player.id}
            onPress={() => selectSuspect(player.id)}
          />
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: selected === SKIP }}
        accessibilityLabel="Pular votação"
        testID="skip-vote"
        onPress={toggleSkip}
        style={[
          styles.skipRow,
          selected === SKIP ? styles.skipRowSelected : styles.skipRowIdle,
        ]}
      >
        <SkipForward size={18} color={selected === SKIP ? colors.foreground : colors.mutedForeground} />
        <AppText
          variant="label"
          weight="semibold"
          tone={selected === SKIP ? 'default' : 'muted'}
        >
          Pular votação
        </AppText>
      </Pressable>
    </PhaseShell>
  )
}

/** Uma linha de suspeito, com o carimbo de acusação (IMP-23) ao ser marcada. */
function SuspectRow({
  player,
  selected,
  onPress,
}: {
  player: Player
  selected: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={player.name}
      testID={`suspect-${player.id}`}
      onPress={onPress}
      style={[styles.suspectRow, selected ? styles.suspectRowSelected : styles.suspectRowIdle]}
    >
      <PlayerAvatar player={player} size="lg" />
      <AppText variant="subtitle" weight="semibold" numberOfLines={1} style={styles.suspectName}>
        {player.name}
      </AppText>
      {selected && <SuspectStamp />}
    </Pressable>
  )
}

/**
 * Carimbo de suspeito (IMP-23) — a animação assinatura desta fase.
 *
 * Monta do zero a cada seleção (o pai só o renderiza quando `selected` é
 * verdadeiro), então o efeito de entrada roda sempre: entra grande e torto
 * (`scale: 2.4, rotate: -24`) e assenta batendo em `scale: 1, rotate: -12`.
 * O `thud` dispara no instante em que a mola pousa, não no toque — é o carimbo
 * "batendo" na tela, não o dedo tocando o suspeito.
 */
function SuspectStamp() {
  // Começa grande e torto (o carimbo "no ar") e assenta no valor final — o
  // `useSharedValue` guarda o estado entre os frames, o que um `withSpring`
  // solto dentro de `useAnimatedStyle` não faria de forma confiável.
  const scale = useSharedValue(2.4)
  const rotate = useSharedValue(-24)

  useEffect(() => {
    scale.value = withSpring(1, motion.springSnappy, (finished) => {
      // O `thud` é o carimbo BATENDO na tela, não o dedo tocando o suspeito —
      // por isso dispara quando a mola termina de assentar, via `runOnJS`
      // (o callback de animação roda na UI thread).
      if (finished) runOnJS(haptics.thud)()
    })
    rotate.value = withSpring(-12, motion.springSnappy)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- roda uma vez por montagem (o pai monta este componente do zero a cada seleção)
  }, [])

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${rotate.value}deg` }],
  }))

  return (
    <Animated.View style={[styles.stamp, style]} pointerEvents="none">
      <AppText variant="label" weight="black" tone="danger" style={styles.stampText}>
        SUSPEITO
      </AppText>
    </Animated.View>
  )
}

/** Avatar da tela "voto registrado": aceso para quem já votou, apagado para quem falta. */
function VotedAvatar({ player }: { player: Player }) {
  const style = useAnimatedStyle(() => ({
    opacity: withTiming(player.has_voted ? 1 : 0.25, { duration: motion.base }),
  }))

  return (
    <Animated.View style={style}>
      <PlayerAvatar player={player} size="md" />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  actionColumn: {
    gap: space[2],
  },
  suspectList: {
    gap: space[2],
    marginBottom: space[3],
  },
  suspectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    borderRadius: radius['2xl'],
    borderWidth: 2,
    padding: space[4],
    overflow: 'hidden',
  },
  suspectRowIdle: {
    backgroundColor: colors.card,
    borderColor: alpha.transparent,
  },
  suspectRowSelected: {
    backgroundColor: alpha.danger15,
    borderColor: colors.destructive,
  },
  suspectName: {
    flex: 1,
    minWidth: 0,
  },
  stamp: {
    position: 'absolute',
    right: space[3],
    borderWidth: 4,
    borderColor: colors.destructive,
    borderRadius: radius.md,
    paddingHorizontal: space[2],
    paddingVertical: space[1],
  },
  stampText: {
    letterSpacing: 2,
  },
  skipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    borderRadius: radius['2xl'],
    borderWidth: 2,
    borderStyle: 'dashed',
    padding: space[4],
  },
  skipRowIdle: {
    borderColor: colors.border,
    backgroundColor: alpha.transparent,
  },
  skipRowSelected: {
    borderColor: colors.primary,
    backgroundColor: alpha.primary10,
  },
  votedCard: {
    alignItems: 'center',
    gap: space[4],
  },
  votedAvatars: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
  },
  votedCaption: {
    maxWidth: '80%',
  },
})
