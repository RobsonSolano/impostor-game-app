import { useEffect, useRef, useState } from 'react'
import { Platform, Pressable, Share, StyleSheet, View } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import * as Clipboard from 'expo-clipboard'
import { Check, Share2 } from 'lucide-react-native'

import { AppText } from '@/components/ui/Text'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PhaseShell } from '@/components/shared/PhaseShell'
import { PlayerGrid } from '@/components/shared/PlayerGrid'
import { WaitingPill } from '@/components/shared/WaitingPill'
import { startGame } from '@/lib/game/actions'
import { agree, countOf } from '@/lib/plural'
import { toDisplayError } from '@/lib/game/errors'
import { haptics } from '@/lib/haptics'
import { colors } from '@/theme/colors'
import { motion, space, tracking } from '@/theme/tokens'
import type { PhaseProps } from '@/components/game/types'

/**
 * Espelho do guard de `start_game` no banco, que levanta `IM005` com menos de 3
 * jogadores vivos. A autoridade é lá; isto existe só para o host não gastar um
 * toque para receber um erro que o app já sabia — e para o botão poder dizer
 * quantos faltam.
 */
const MIN_PLAYERS = 3

export function LobbyPhase({ room, players, me, isHost }: PhaseProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const scale = useSharedValue(1)

  /**
   * O aviso "Copiado" se apaga sozinho em 2s, e o timer precisa morrer com o
   * componente: sair do lobby dentro dessa janela (o host encerrando, por
   * exemplo) agendaria `setState` em componente desmontado.
   */
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current)
    }
  }, [])

  const missing = Math.max(0, MIN_PLAYERS - players.length)

  const codeCardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  async function share() {
    // Não existe URL de sala pública como no web (não há página para abrir
    // fora do app) — a mensagem carrega só o código, que é o que a mesa
    // precisa para digitar em "Entrar na sala".
    const message = `Entra na minha sala do Jogo do Impostor. Código: ${room.code}`

    // `Share.share` abre a folha nativa (WhatsApp direto) nos dois SOs — ao
    // contrário do web, que precisa checar `navigator.share` porque nem todo
    // navegador tem. Aqui o clipboard só entra como plano B para quando a
    // folha realmente falhar, não quando o usuário cancela: cancelar resolve
    // a promise normalmente (ou, no Android, nem sinaliza cancelamento), não
    // lança — então o catch abaixo nunca dispara por causa de um cancelamento.
    try {
      const result = await Share.share({ message })
      // Só vibra quando dá para AFIRMAR que compartilhou. No iOS,
      // `sharedAction` significa isso de verdade. No Android, a folha responde
      // `sharedAction` mesmo quando a pessoa só fechou — então lá a vibração de
      // sucesso seria mentira, e é melhor não vibrar do que comemorar sozinho.
      if (Platform.OS === 'ios' && result.action === Share.sharedAction) {
        haptics.success()
      }
    } catch {
      try {
        await Clipboard.setStringAsync(message)
        setCopied(true)
        haptics.success()
        if (copiedTimer.current) clearTimeout(copiedTimer.current)
        copiedTimer.current = setTimeout(() => setCopied(false), 2000)
      } catch {
        // Sem folha nativa e sem clipboard: nada a fazer. Vibração e feedback
        // visual são enfeite — não podem travar o lobby.
      }
    }
  }

  async function start() {
    setBusy(true)
    setError(null)
    try {
      await startGame(room.id)
    } catch (err) {
      setError(toDisplayError(err))
      haptics.error()
    } finally {
      setBusy(false)
    }
  }

  return (
    <PhaseShell
      eyebrow="Lobby"
      title="Sala aberta"
      subtitle="Compartilhe o código. A partida começa quando o host quiser."
      aside={
        <View>
          <View style={styles.asideHeader}>
            <AppText variant="title" weight="semibold">
              Na mesa
            </AppText>
            <AppText variant="body" tone="muted" tabular accessibilityLiveRegion="polite">
              {countOf(players.length, 'jogador', 'jogadores')}
            </AppText>
          </View>
          <PlayerGrid
            players={players}
            hostPlayerId={room.host_player_id}
            myPlayerId={me.id}
            showScore={room.games_played > 0}
          />
        </View>
      }
      action={
        isHost ? (
          <View style={styles.actionColumn}>
            {error ? (
              <AppText variant="label" tone="danger" weight="medium" accessibilityRole="alert">
                {error}
              </AppText>
            ) : null}
            <Button
              label={
                missing > 0
                  ? // O verbo concorda com a contagem: "Falta 1 jogador", e não
                    // "Faltam 1 jogador" (que é o que está no web, e está errado).
                    `${agree(missing, 'Falta', 'Faltam')} ${countOf(missing, 'jogador', 'jogadores')}`
                  : 'Iniciar partida'
              }
              // Vibra sozinho via `haptic` default do Button ('press') — é o
              // "haptics.press() ao iniciar a partida" pedido, sem duplicar.
              onPress={() => void start()}
              disabled={missing > 0 || busy}
              busy={busy}
              size="lg"
              accessibilityLabel={
                missing > 0
                  ? `${agree(missing, 'Falta', 'Faltam')} ${countOf(missing, 'jogador', 'jogadores')} para iniciar a partida`
                  : 'Iniciar partida'
              }
            />
          </View>
        ) : (
          <WaitingPill label="Aguardando o host iniciar" />
        )
      }
    >
      {/* Código gigante: é lido em voz alta na mesa e digitado à mão por outra
          pessoa — o tamanho generoso e o letterSpacing largo não são só
          estética, são legibilidade a distância de braço. */}
      <Pressable
        onPressIn={() => {
          haptics.tap()
          scale.value = withSpring(0.97, motion.spring)
        }}
        onPressOut={() => {
          scale.value = withSpring(1, motion.spring)
        }}
        onPress={() => void share()}
        accessibilityRole="button"
        accessibilityLabel={`Compartilhar código da sala, ${room.code}`}
      >
        <Animated.View style={codeCardAnimatedStyle}>
          <Card tone="primary" glow style={styles.codeCard}>
            <AppText variant="eyebrow" tone="muted">
              Código da sala
            </AppText>
            <AppText
              variant="display"
              tone="primary"
              weight="bold"
              tabular
              align="center"
              style={styles.codeText}
            >
              {room.code}
            </AppText>
            <View style={styles.hintRow}>
              {copied ? (
                <>
                  <Check size={16} color={colors.mutedForeground} />
                  <AppText variant="body" tone="muted">
                    Copiado
                  </AppText>
                </>
              ) : (
                <>
                  <Share2 size={16} color={colors.mutedForeground} />
                  <AppText variant="body" tone="muted">
                    Toque para compartilhar
                  </AppText>
                </>
              )}
            </View>
          </Card>
        </Animated.View>
      </Pressable>
    </PhaseShell>
  )
}

const styles = StyleSheet.create({
  codeCard: {
    alignItems: 'center',
    gap: space[2],
    marginBottom: space[6],
  },
  codeText: {
    letterSpacing: tracking.code,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1.5],
    marginTop: space[1],
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
