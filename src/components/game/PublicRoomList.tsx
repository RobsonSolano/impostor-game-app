import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated'
import { RotateCcw, Users } from 'lucide-react-native'
import { AppText } from '@/components/ui/Text'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { listPublicRooms } from '@/lib/game/actions'
import { toDisplayError } from '@/lib/game/errors'
import { isValidNickname } from '@/lib/game/room-code'
import { countOf } from '@/lib/plural'
import { haptics } from '@/lib/haptics'
import { colors } from '@/theme/colors'
import { TOUCH_TARGET, space } from '@/theme/tokens'
import type { PublicRoom } from '@/lib/types'

export type PublicRoomListProps = {
  /** Nome já digitado na tela de cima. Vazio (ou só espaço) = não pode entrar ainda. */
  playerName: string
  /** Chamado quando o jogador toca numa sala aberta. Quem navega é a `HomeScreen`. */
  onJoin: (code: string) => void | Promise<void>
  /** Sinaliza que falta o nome, para a `HomeScreen` destacar o campo. */
  onMissingName: () => void
}

/**
 * Espelha o limite de `join_room` no banco (`IM005`/sala cheia com 12
 * jogadores). Repetido aqui só para DESABILITAR a sala cheia na lista antes do
 * toque — a regra continua sendo do banco (AGENTS.md, regra 1); isto é
 * conveniência de UI para não gastar uma chamada de RPC num resultado já
 * previsível, não uma segunda fonte de verdade.
 */
const MAX_PLAYERS = 12

/**
 * Sem debounce, cada tecla digitada na busca vira uma chamada de
 * `list_public_rooms` — em rede lenta a lista pisca resultado atrás de
 * resultado enquanto a pessoa ainda está digitando, e o banco recebe uma
 * rajada de RPCs que nenhuma delas chega a ser vista. 350ms é o bastante para
 * a rajada de teclas assentar antes de perguntar ao banco.
 */
const SEARCH_DEBOUNCE_MS = 350

/**
 * Lista de salas públicas em LOBBY. (IMP-40)
 *
 * Não usa `FlatList`: este componente vive dentro do `ScrollView` da `Screen`
 * (contrato compartilhado), e uma lista rolável dentro de outra lista rolável
 * quebra a rolagem no Android (o gesto fica "preso" entre as duas). Como a
 * quantidade de salas abertas é sempre pequena, `.map()` dentro de uma `View`
 * comum entrega a mesma lista sem esse conflito.
 */
export function PublicRoomList({ playerName, onJoin, onMissingName }: PublicRoomListProps) {
  const [searchText, setSearchText] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [rooms, setRooms] = useState<PublicRoom[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [joiningCode, setJoiningCode] = useState<string | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /**
   * Busca ao montar e a cada mudança de `appliedSearch` (o debounce já
   * resolveu antes de chegar aqui — ver `handleSearchChange`).
   *
   * ARMADILHA: nenhum `setState` corre ANTES do primeiro `await` — nem
   * `setLoading(true)`, nem `setError(null)`. Fazer isso seria `setState`
   * síncrono dentro do corpo do efeito, que dispara um re-render em cascata
   * (mesma armadilha documentada em `useGameAccess`/`useMyCard`). O estado
   * inicial de `loading` já cobre a primeira carga; recargas por busca só
   * trocam o resultado quando a resposta chega, sem "piscar" um carregando no
   * meio do caminho.
   */
  useEffect(() => {
    let active = true

    void (async () => {
      try {
        const data = await listPublicRooms(appliedSearch)
        if (!active) return
        setRooms(data)
        setError(null)
      } catch (err) {
        if (!active) return
        setError(toDisplayError(err))
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [appliedSearch])

  // Limpa o temporizador pendente ao desmontar — sem isto, uma busca digitada
  // bem antes de sair do sub-modo "Salas abertas" ainda dispararia depois,
  // tentando atualizar o estado de um componente que já não existe.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  function handleSearchChange(raw: string) {
    setSearchText(raw)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setAppliedSearch(raw.trim()), SEARCH_DEBOUNCE_MS)
  }

  /**
   * Botão de atualizar. Ao contrário do efeito acima, isto é um handler de
   * TOQUE, não um efeito — pode marcar `loading` antes da chamada sem cair na
   * mesma regra (ela só vale para `useEffect`), e é isso que dá o retorno
   * visual imediato do toque, em vez de um botão que parece não ter feito nada.
   */
  async function handleRefresh() {
    setLoading(true)
    setError(null)
    try {
      const data = await listPublicRooms(appliedSearch)
      setRooms(data)
    } catch (err) {
      setError(toDisplayError(err))
    } finally {
      setLoading(false)
    }
  }

  async function handlePress(room: PublicRoom) {
    // Checado aqui, e não só desabilitando o botão: sem nome não existe RPC
    // certa para tentar, e mandar mesmo assim voltaria um erro de banco
    // (nome vazio) que não diz nada sobre o problema real ("falta o nome").
    if (!isValidNickname(playerName)) {
      haptics.warn()
      onMissingName()
      return
    }

    haptics.press()
    setJoiningCode(room.code)
    try {
      await onJoin(room.code)
    } catch {
      // Quem é dono do erro de entrada é a tela que navega (`onJoin`, ver
      // contrato acima) — ela já mostra a mensagem e vibra `error()`. Aqui só
      // evitamos uma promise rejeitada sem `catch` e destravamos a linha.
    } finally {
      setJoiningCode(null)
    }
  }

  const hasSearch = appliedSearch.length > 0
  const showInitialLoading = loading && rooms === null

  return (
    <View style={styles.root}>
      <Input
        placeholder="Buscar sala ou host"
        value={searchText}
        onChangeText={handleSearchChange}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />

      <View style={styles.headerRow}>
        <AppText variant="caption" tone="muted">
          Salas abertas agora
        </AppText>
        <Pressable
          onPress={handleRefresh}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Atualizar lista de salas"
          style={styles.refreshButton}
          hitSlop={space[2]}
        >
          {loading ? (
            <Spinner size={16} />
          ) : (
            <RotateCcw size={16} color={colors.mutedForeground} />
          )}
        </Pressable>
      </View>

      {/* Muda sozinha (busca, atualização manual) sem o jogador ter pedido
          foco nela — o TalkBack/VoiceOver só percebe a troca de conteúdo se
          alguém anunciar. */}
      <View accessibilityLiveRegion="polite" style={styles.list}>
        {showInitialLoading && (
          <View style={styles.centerState}>
            <Spinner size={24} />
            <AppText variant="caption" tone="muted" style={styles.centerStateText}>
              Carregando salas…
            </AppText>
          </View>
        )}

        {!loading && error && (
          <View style={styles.centerState}>
            <AppText variant="body" tone="danger" align="center">
              {error}
            </AppText>
            <Pressable
              onPress={handleRefresh}
              accessibilityRole="button"
              accessibilityLabel="Tentar de novo"
              style={styles.retryButton}
            >
              <AppText variant="label" tone="primary" weight="semibold">
                Tentar de novo
              </AppText>
            </Pressable>
          </View>
        )}

        {!showInitialLoading && !error && rooms !== null && rooms.length === 0 && (
          <View style={styles.centerState}>
            {/*
              Duas mensagens diferentes de propósito: lista vazia sem busca é
              o estado normal do jogo num horário parado (ninguém abriu sala
              agora), e parecer erro desanimaria quem está tentando decidir se
              cria uma. Lista vazia COM busca é "sua busca não bateu com nada"
              — uma informação distinta, que merece texto distinto.
            */}
            <AppText variant="body" tone="muted" align="center">
              {hasSearch
                ? 'Nenhuma sala encontrada para essa busca.'
                : 'Ninguém abriu sala pública agora. Que tal criar a primeira?'}
            </AppText>
          </View>
        )}

        {!error &&
          rooms !== null &&
          rooms.map((room) => {
            const isFull = room.players >= MAX_PLAYERS
            const hostLabel = room.host_name ?? 'alguém'
            const heading = room.title?.trim() ? room.title : `Sala de ${hostLabel}`
            const isJoining = joiningCode === room.code

            return (
              <Animated.View
                key={room.code}
                entering={FadeInDown.springify().damping(18)}
                layout={LinearTransition}
              >
                <Pressable
                  onPress={() => void handlePress(room)}
                  disabled={isFull || isJoining}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isFull }}
                  accessibilityLabel={`${heading}, anfitrião ${hostLabel}, ${countOf(
                    room.players,
                    'jogador',
                    'jogadores',
                  )} de ${MAX_PLAYERS}${isFull ? ', sala cheia' : ''}`}
                >
                  <Card
                    tone={isFull ? 'plain' : 'primary'}
                    style={[styles.room, isFull ? styles.roomFull : null]}
                  >
                    <View style={styles.roomInfo}>
                      <AppText variant="label" weight="semibold" numberOfLines={1}>
                        {heading}
                      </AppText>
                      {room.title?.trim() ? (
                        <AppText variant="caption" tone="muted" numberOfLines={1}>
                          Sala de {hostLabel}
                        </AppText>
                      ) : null}
                      {isFull && (
                        <AppText variant="caption" tone="warn" weight="medium">
                          Sala cheia — aguarde uma vaga
                        </AppText>
                      )}
                    </View>

                    <View style={styles.roomCount}>
                      {isJoining ? (
                        <Spinner size={18} />
                      ) : (
                        <>
                          <Users size={16} color={colors.mutedForeground} />
                          <AppText variant="label" weight="semibold" tabular>
                            {room.players}/{MAX_PLAYERS}
                          </AppText>
                        </>
                      )}
                    </View>
                  </Card>
                </Pressable>
              </Animated.View>
            )
          })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    gap: space[3],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  refreshButton: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    gap: space[2],
  },
  centerState: {
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[8],
    paddingHorizontal: space[4],
  },
  centerStateText: {
    marginTop: space[1],
  },
  retryButton: {
    minHeight: TOUCH_TARGET,
    paddingHorizontal: space[5],
    alignItems: 'center',
    justifyContent: 'center',
  },
  room: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  roomFull: {
    opacity: 0.55,
  },
  roomInfo: {
    flex: 1,
    minWidth: 0,
    gap: space[1],
  },
  roomCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1.5],
    flexShrink: 0,
  },
})
