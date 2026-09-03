import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { DoorOpen } from 'lucide-react-native'
import { AppText } from '@/components/ui/Text'
import { Button } from '@/components/ui/Button'
import { colors } from '@/theme/colors'
import { radius, space } from '@/theme/tokens'
import { haptics } from '@/lib/haptics'
import { leaveRoom } from '@/lib/game/actions'
import { toDisplayError } from '@/lib/game/errors'

type RoomExitButtonProps = {
  roomId: string
  isHost: boolean
}

/** Sem resposta neste tempo, o segundo toque provavelmente não vai vir. */
const CONFIRM_RESET_MS = 4000

/**
 * Saída da sala, disponível em qualquer fase.
 *
 * Para o host, sair encerra a sala para todos — daí a confirmação em dois
 * toques em vez de um diálogo: é destrutivo para outras pessoas, mas não
 * merece bloquear a tela num jogo de 5 minutos. O segundo toque é o "sim".
 *
 * Quem decide se isto encerra ou apenas sai é `leave_room` no banco, comparando
 * o chamador com `rooms.host_player_id` — o cliente só chama a RPC, nunca
 * replica essa decisão.
 */
export function RoomExitButton({ roomId, isHost }: RoomExitButtonProps) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current)
    }
  }, [])

  async function act() {
    if (isHost && !confirming) {
      // Entrar em confirmação é o momento de alerta: o próximo toque encerra
      // a sala de todo mundo.
      haptics.warn()
      setConfirming(true)
      resetTimer.current = setTimeout(() => setConfirming(false), CONFIRM_RESET_MS)
      return
    }

    if (resetTimer.current) clearTimeout(resetTimer.current)
    haptics.press()
    setBusy(true)
    setError(null)
    try {
      await leaveRoom(roomId)
      // O host recebe o redirecionamento via status CLOSED no Realtime, mas quem
      // apenas sai precisa navegar por conta própria.
      router.replace('/')
    } catch (err) {
      setError(toDisplayError(err))
      setBusy(false)
      setConfirming(false)
    }
  }

  const label = confirming ? 'Encerrar mesmo?' : isHost ? 'Encerrar' : 'Sair'
  const accessibilityLabel = isHost ? 'Encerrar a sala para todos' : 'Sair da sala'

  return (
    // `pointerEvents="box-none"`: a faixa cobre o topo da tela inteira, mas só o
    // botão em si pode capturar toque — o resto é passagem livre para o que está
    // por baixo (mesmo comportamento do `pointer-events-none` do wrapper web).
    <View
      style={[styles.wrapper, { paddingTop: insets.top + space[3] }]}
      pointerEvents="box-none"
    >
      <Button
        label={label}
        onPress={() => void act()}
        variant={confirming ? 'danger' : 'secondary'}
        size="md"
        busy={busy}
        icon={DoorOpen}
        fullWidth={false}
        // Os toques têm intenções diferentes (aviso vs. confirmação): a
        // vibração é escolhida à mão dentro de `act()`, não pelo padrão do Button.
        haptic={false}
        accessibilityLabel={accessibilityLabel}
        style={styles.button}
      />

      {error && (
        <AppText
          variant="caption"
          tone="danger"
          align="right"
          accessibilityLiveRegion="polite"
          style={styles.error}
        >
          {error}
        </AppText>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    zIndex: 40,
    alignItems: 'flex-end',
    paddingHorizontal: space[3],
    gap: space[1],
  },
  button: {
    borderRadius: radius.full,
    backgroundColor: colors.card,
  },
  error: {
    maxWidth: 192,
  },
})
