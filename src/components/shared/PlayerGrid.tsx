import { StyleSheet, View } from 'react-native'
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated'
import { Crown, Check } from 'lucide-react-native'
import { PlayerAvatar } from '@/components/shared/PlayerAvatar'
import { AppText } from '@/components/ui/Text'
import type { Player } from '@/lib/types'
import { countOf } from '@/lib/plural'
import { colors, alpha } from '@/theme/colors'
import { radius, space } from '@/theme/tokens'

type PlayerGridProps = {
  players: Player[]
  hostPlayerId?: string | null
  myPlayerId?: string | null
  /** Ids com marca de "pronto" (viu o card, já votou...). */
  readyIds?: Set<string>
  readyLabel?: string
  showScore?: boolean
}

/**
 * Roster da mesa.
 *
 * O web tinha três layouts (coluna no celular/desktop, linha com wrap no
 * tablet); aqui só existe celular, então é sempre uma coluna — nome inteiro
 * sempre legível, sem truncar para caber lado a lado.
 *
 * Jogador novo entra com `FadeInDown` e os vizinhos abrem espaço com
 * `LinearTransition` em vez de pular direto para a posição final — a mesa
 * vendo alguém chegar é metade da graça do lobby (ver AGENTS.md).
 */
export function PlayerGrid({
  players,
  hostPlayerId,
  myPlayerId,
  readyIds,
  readyLabel = 'pronto',
  showScore = false,
}: PlayerGridProps) {
  return (
    <View style={styles.list}>
      {players.map((player) => {
        const isReady = readyIds?.has(player.id) ?? false
        const isMe = player.id === myPlayerId

        return (
          <Animated.View
            key={player.id}
            entering={FadeInDown.springify().damping(18)}
            layout={LinearTransition}
            style={[
              styles.row,
              isMe && styles.rowMe,
              !player.is_alive && styles.rowDead,
            ]}
          >
            <PlayerAvatar player={player} size="md" />

            <View style={styles.info}>
              <View style={styles.nameLine}>
                <AppText variant="label" weight="semibold" numberOfLines={1} style={styles.name}>
                  {player.name}
                </AppText>
                {isMe && (
                  <AppText variant="caption" tone="muted">
                    {' '}(você)
                  </AppText>
                )}
              </View>
              {showScore && (
                <AppText variant="caption" tone="muted" tabular>
                  {countOf(player.score, 'ponto', 'pontos')}
                </AppText>
              )}
            </View>

            {player.id === hostPlayerId && (
              <Crown size={16} color={colors.warn} accessibilityLabel="Host" />
            )}

            {isReady && (
              <View style={styles.readyBadge}>
                <Check size={16} color={colors.primary} />
                <AppText variant="caption" tone="primary" weight="semibold">
                  {readyLabel}
                </AppText>
              </View>
            )}
          </Animated.View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  list: {
    flexDirection: 'column',
    gap: space[2],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[3],
  },
  rowMe: {
    borderColor: alpha.primary40,
  },
  rowDead: {
    opacity: 0.4,
  },
  info: {
    flex: 1,
    minWidth: 0,
    gap: space[1],
  },
  nameLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
  },
  name: {
    flexShrink: 1,
  },
  readyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    flexShrink: 0,
  },
})
