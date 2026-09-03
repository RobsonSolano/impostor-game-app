import { useEffect, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { DoorOpen, WifiOff } from 'lucide-react-native'
import { AppText } from '@/components/ui/Text'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { Screen } from '@/components/shared/Screen'
import { alpha, colors } from '@/theme/colors'
import { radius, space } from '@/theme/tokens'
import { haptics } from '@/lib/haptics'
import { useAnonSession, useRoomIdFromCode } from '@/hooks/useGameAccess'
import { useMyCard } from '@/hooks/useMyCard'
import { useRoomChannel } from '@/hooks/useRoomChannel'
import { useRoundClues } from '@/hooks/useRoundClues'
import { LobbyPhase } from '@/components/game/LobbyPhase'
import { WordRevealPhase } from '@/components/game/WordRevealPhase'
import { CluePhase } from '@/components/game/CluePhase'
import { VotingPhase } from '@/components/game/VotingPhase'
import { LastChancePhase } from '@/components/game/LastChancePhase'
import { GameOverPhase } from '@/components/game/GameOverPhase'
import { RoomExitButton } from '@/components/game/RoomExitButton'

/** Tempo de leitura do aviso antes de mandar todos para a home. */
const CLOSED_REDIRECT_MS = 2200

/**
 * Orquestrador da sala.
 *
 * Uma única rota para a partida inteira: as fases são componentes trocados por
 * `rooms.status`, não navegações. Navegar entre fases derrubaria e recriaria o
 * canal de Realtime a cada transição — o jeito mais fácil de perder um evento e
 * deixar um celular preso na tela anterior.
 */
export function GameRoom({ code }: { code: string }) {
  const { userId, ready, error: sessionError } = useAnonSession()
  const {
    roomId,
    loading: resolvingRoom,
    isMember,
  } = useRoomIdFromCode(code, ready && Boolean(userId))
  const { room, players, loading, connected, error } = useRoomChannel(roomId)

  const me = players.find((player) => player.user_id === userId) ?? null
  const { card } = useMyCard(room?.active_round_id ?? null, me?.id ?? null)
  const clues = useRoundClues(room?.active_round_id ?? null)

  // O host encerrou: todos voltam para a tela inicial.
  const isClosed = room?.status === 'CLOSED'

  // Vibra só na TRANSIÇÃO de conectado para desconectado, nunca em todo render:
  // vibrar de novo a cada re-render enquanto o canal segue caído viraria zumbido.
  const wasConnected = useRef(connected)
  useEffect(() => {
    if (wasConnected.current && !connected) {
      haptics.warn()
    }
    wasConnected.current = connected
  }, [connected])

  if (sessionError) {
    return <Fallback title="Não foi possível entrar" detail={sessionError} />
  }

  if (isClosed) {
    return <RoomClosedScreen />
  }

  if (!ready || resolvingRoom || (loading && !room)) {
    return <LoadingScreen />
  }

  if (!isMember || !roomId) {
    return (
      <Fallback
        title="Você não está nesta sala"
        detail={`Para entrar na sala ${code}, informe seu nome na tela inicial.`}
      />
    )
  }

  if (error || !room) {
    return <Fallback title="Sala indisponível" detail={error ?? 'Sala não encontrada.'} />
  }

  // `me` ausente com sala carregada acontece quando a sessão anônima trocou
  // (storage limpo, outro aparelho): o jogador antigo continua na sala, mas
  // este usuário não é ele.
  if (!me) {
    return (
      <Fallback
        title="Sessão não reconhecida"
        detail={`Sua sessão não corresponde a nenhum jogador da sala ${code}. Entre de novo pela tela inicial.`}
      />
    )
  }

  const isHost = room.host_player_id === me.id
  const shared = { room, players, me, isHost }

  return (
    <View style={styles.root}>
      {!connected && <OfflineBanner />}
      <RoomExitButton roomId={room.id} isHost={isHost} />

      {/*
        O `AnimatePresence mode="wait"` do web espera a fase antiga sair da tela
        antes de montar a nova: crossfade de duas fases sobrepostas confunde num
        jogo de dedução (por um instante dariam para ler pistas da fase errada).
        Reproduzir esse sequenciamento exato em Reanimated exigiria segurar o
        card do banco fora da árvore até a saída terminar — risco alto para um
        estado que muda via Realtime a qualquer momento. Preferimos uma troca
        simples: sem animação de saída, só a fase nova entrando com fade + leve
        deslize. Mais seguro que duas telas sobrepostas, e some com o problema
        de sequência por não ter sobreposição nenhuma.
      */}
      <Animated.View key={room.status} entering={FadeInDown.duration(200)} style={styles.stage}>
        {room.status === 'LOBBY' && <LobbyPhase {...shared} />}
        {room.status === 'WORD_REVEAL' && <WordRevealPhase {...shared} card={card} />}
        {room.status === 'DISCUSSION' && <CluePhase {...shared} clues={clues} />}
        {room.status === 'VOTING' && <VotingPhase {...shared} />}
        {room.status === 'LAST_CHANCE' && <LastChancePhase {...shared} card={card} />}
        {room.status === 'GAME_OVER' && <GameOverPhase {...shared} />}
      </Animated.View>
    </View>
  )
}

function LoadingScreen() {
  return (
    <Screen scroll={false} contentStyle={styles.center}>
      <Spinner size={32} />
    </Screen>
  )
}

/**
 * Sala encerrada pelo host.
 *
 * Redireciona sozinha, mas com uma pausa: cair na home sem explicação pareceria
 * bug ou queda de conexão. O aviso é o que diferencia "o host encerrou" de
 * "o app quebrou".
 */
function RoomClosedScreen() {
  const router = useRouter()

  useEffect(() => {
    // `warn` e não `defeat`: pelo vocabulário de `lib/haptics.ts`, `defeat` é o
    // fim de uma partida perdida. O host encerrar a sala não é derrota de
    // ninguém — é um aviso de que o jogo acabou por fora.
    haptics.warn()
    const id = setTimeout(() => router.replace('/'), CLOSED_REDIRECT_MS)
    return () => clearTimeout(id)
  }, [router])

  return (
    <Screen
      scroll={false}
      contentStyle={styles.center}
      action={<Button label="Ir agora" variant="ghost" onPress={() => router.replace('/')} />}
    >
      <View style={[styles.iconCard, { backgroundColor: colors.card }]}>
        <DoorOpen size={40} color={colors.mutedForeground} />
      </View>
      <AppText variant="title" align="center" style={styles.gap}>
        O host encerrou a sala
      </AppText>
      <AppText variant="body" tone="muted" align="center">
        Voltando para o início…
      </AppText>
    </Screen>
  )
}

function Fallback({ title, detail }: { title: string; detail: string }) {
  const router = useRouter()

  return (
    <Screen
      scroll={false}
      contentStyle={styles.center}
      action={<Button label="Voltar ao início" onPress={() => router.replace('/')} />}
    >
      <AppText variant="title" align="center">
        {title}
      </AppText>
      <AppText variant="body" tone="muted" align="center" style={styles.gap}>
        {detail}
      </AppText>
    </Screen>
  )
}

/**
 * Aviso de canal caído.
 *
 * Sem isso o jogador não teria como saber que a tela parou de atualizar — o
 * estado simplesmente congelaria na fase anterior, e ele acharia que o jogo
 * travou.
 */
function OfflineBanner() {
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.offlineBanner, { paddingTop: insets.top + space[2] }]}>
      <WifiOff size={16} color={colors.destructive} />
      <AppText variant="label" tone="danger">
        Reconectando…
      </AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  stage: {
    flex: 1,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[6],
    gap: space[2],
  },
  gap: {
    marginTop: space[3],
  },
  iconCard: {
    borderRadius: radius['3xl'],
    padding: space[5],
    marginBottom: space[2],
  },
  offlineBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    paddingBottom: space[2],
    backgroundColor: alpha.danger15,
  },
})
