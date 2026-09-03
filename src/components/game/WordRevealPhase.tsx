import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { AppText } from '@/components/ui/Text'
import { Button } from '@/components/ui/Button'
import { PhaseShell } from '@/components/shared/PhaseShell'
import { PlayerGrid } from '@/components/shared/PlayerGrid'
import { HoldToReveal } from '@/components/shared/HoldToReveal'
import { WaitingPill } from '@/components/shared/WaitingPill'
import { confirmWordSeen } from '@/lib/game/actions'
import { agree, countOf } from '@/lib/plural'
import { toDisplayError } from '@/lib/game/errors'
import { space } from '@/theme/tokens'
import type { PhaseProps } from '@/components/game/types'
import type { PlayerCard } from '@/lib/types'

type WordRevealPhaseProps = PhaseProps & {
  card: PlayerCard | null
}

export function WordRevealPhase({ room, players, me, card }: WordRevealPhaseProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const seenIds = new Set(players.filter((p) => p.has_seen_card).map((p) => p.id))
  const alivePlayers = players.filter((p) => p.is_alive)
  const pending = alivePlayers.filter((p) => !p.has_seen_card).length

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      await confirmWordSeen(room.id)
    } catch (err) {
      setError(toDisplayError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <PhaseShell
      eyebrow={`Partida ${room.games_played + 1}`}
      title="Sua palavra secreta"
      subtitle="Segure o card por 2 segundos. Ao soltar, ele esconde na hora."
      aside={
        <View>
          <View style={styles.asideHeader}>
            <AppText variant="title" weight="semibold">
              Quem já viu
            </AppText>
            <AppText variant="body" tone="muted" tabular accessibilityLiveRegion="polite">
              {seenIds.size} de {alivePlayers.length}
            </AppText>
          </View>
          <PlayerGrid
            players={players}
            hostPlayerId={room.host_player_id}
            myPlayerId={me.id}
            readyIds={seenIds}
            readyLabel="viu"
          />
        </View>
      }
      action={
        me.has_seen_card ? (
          <WaitingPill
            label={
              pending > 0
                ? `${agree(pending, 'Falta', 'Faltam')} ${countOf(pending, 'jogador', 'jogadores')} ver o card`
                : 'Começando…'
            }
          />
        ) : (
          <View style={styles.actionColumn}>
            {error ? (
              <AppText variant="label" tone="danger" weight="medium" accessibilityRole="alert">
                {error}
              </AppText>
            ) : null}
            <Button
              label="Já vi minha palavra"
              // Sem card ainda, não há o que confirmar — desabilitado evita
              // que o jogador confirme antes de o segredo sequer chegar.
              // O `haptic` default do Button ('press') já cobre o pedido de
              // gamificação desta fase; nada mais vibra aqui.
              onPress={() => void confirm()}
              disabled={busy || !card}
              busy={busy}
              size="lg"
            />
          </View>
        )
      }
    >
      {/* O gesto de segurar já vibra sozinho — é o `HoldToReveal` "carregando"
          o segredo (soft a cada ~25%, thud na revelação). Não acrescente
          vibração nem animação de destaque por cima disso nesta fase: quem
          está segurando o card tem o segredo na tela, e um efeito chamativo
          faria a mesa inteira olhar para o aparelho dele no pior momento
          possível — bem quando ele não quer chamar atenção. */}
      <HoldToReveal style={styles.holdCard}>
        {card?.is_impostor ? (
          <>
            <AppText variant="display" tone="danger" weight="bold" align="center">
              VOCÊ É O IMPOSTOR 👀
            </AppText>
            <AppText variant="body" tone="muted" align="center">
              Você não sabe a palavra. Blefe, escute as dicas dos outros e não se
              entregue.
            </AppText>
          </>
        ) : (
          <>
            <AppText variant="display" tone="primary" weight="bold" align="center">
              {card?.word_text}
            </AppText>
            <AppText variant="body" tone="muted" align="center">
              Um dos jogadores não recebeu esta palavra. Dê dicas sem entregar de
              graça.
            </AppText>
          </>
        )}
      </HoldToReveal>
    </PhaseShell>
  )
}

const styles = StyleSheet.create({
  holdCard: {
    marginBottom: space[6],
  },
  asideHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: space[3],
  },
  actionColumn: {
    gap: space[2],
  },
})
