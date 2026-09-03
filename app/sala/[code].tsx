import { StyleSheet } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { AppText } from '@/components/ui/Text'
import { Button } from '@/components/ui/Button'
import { Screen } from '@/components/shared/Screen'
import { GameRoom } from '@/components/game/GameRoom'
import { isValidRoomCode, normalizeRoomCode } from '@/lib/game/room-code'
import { space } from '@/theme/tokens'

/**
 * Rota da partida inteira — uma só para todas as fases (ver comentário em
 * `GameRoom`). `useLocalSearchParams` NÃO é assíncrono como o `params` do
 * Next 16: o expo-router já entrega o segmento decodificado de cara.
 */
export default function SalaScreen() {
  const { code } = useLocalSearchParams<{ code: string }>()
  const normalized = normalizeRoomCode(code ?? '')

  // Código malformado não chega a consultar o banco. O Next tem `notFound()`
  // para isso; aqui a tela de erro é nossa mesmo, com o mesmo caminho de volta
  // (`Voltar ao início`) que os outros estados de borda do `GameRoom`.
  if (!isValidRoomCode(normalized)) {
    return <InvalidCodeScreen />
  }

  return <GameRoom code={normalized} />
}

function InvalidCodeScreen() {
  const router = useRouter()

  return (
    <Screen
      scroll={false}
      style={styles.center}
      action={<Button label="Voltar ao início" onPress={() => router.replace('/')} />}
    >
      <AppText variant="title" align="center">
        Código de sala inválido
      </AppText>
      <AppText variant="body" tone="muted" align="center" style={styles.detail}>
        Confira o código com quem te chamou para a mesa.
      </AppText>
    </Screen>
  )
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[6],
    gap: space[2],
  },
  detail: {
    marginTop: space[3],
  },
})
