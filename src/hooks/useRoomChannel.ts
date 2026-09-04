import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { useKeepFresh } from '@/hooks/useKeepFresh'
import { haptics } from '@/lib/haptics'
import type { Player, Room, RoomStatus } from '@/lib/types'

type ChannelState = {
  room: Room | null
  players: Player[]
  /** Carregamento inicial em andamento. */
  loading: boolean
  /** Canal de Realtime ativo. Falso = a tela pode estar desatualizada. */
  connected: boolean
  error: string | null
}

const INITIAL: ChannelState = {
  room: null,
  players: [],
  loading: true,
  connected: false,
  error: null,
}

function sortByJoin(players: Player[]) {
  return [...players].sort((a, b) => a.joined_at.localeCompare(b.joined_at))
}

/**
 * Assina o estado público da sala.
 *
 * Duas subscriptions, um canal: `rooms` (a fase) e `players` (o roster). É tudo
 * que o cliente precisa observar — `player_cards` é buscado por fase em
 * `useMyCard`, e `votes`/`rounds` são inalcançáveis por design.
 *
 * Detalhe que evita bug de sincronia: depois de SUBSCRIBED o estado é buscado de
 * novo. Entre o fetch inicial e o canal ficar pronto existe uma janela em que um
 * UPDATE se perde — sem o refetch, um jogador ficaria preso na fase anterior.
 *
 * Mas fechar essa janela não basta: Realtime sozinho já congelou uma partida
 * real, e no celular a condição do travamento é a rotina do jogo (o aparelho
 * fica minutos na mesa com a tela apagada, e o SO suspende o socket sem avisar).
 * Por isso o estado também é ressincronizado por `useKeepFresh` — na volta ao
 * primeiro plano e por sondagem periódica. Ver o hook para o caso que originou
 * isso.
 */
export function useRoomChannel(roomId: string | null) {
  const [state, setState] = useState<ChannelState>(INITIAL)

  // Rede de segurança contra evento de Realtime perdido: volta do segundo plano
  // e sondagem periódica. Ver `useKeepFresh`.
  const freshness = useKeepFresh(Boolean(roomId))

  // Evita setState depois do unmount quando o fetch termina tarde.
  const mounted = useRef(true)

  /**
   * Último `rooms.status` observado.
   *
   * Fica em ref, não em `state`, de propósito: quem lê isto decide efeito
   * colateral, e o updater passado a `setState` precisa continuar puro (o React
   * pode, em tese, reexecutá-lo).
   */
  const lastStatus = useRef<RoomStatus | null>(null)

  /**
   * Registra o novo valor de `rooms`.
   *
   * **Este hook não vibra em troca de fase, de propósito.** A versão anterior
   * dava um `haptics.thud()` aqui, e o resultado era vibração empilhada: cada
   * fase tem a sua própria intenção e nenhuma sabia do hook. Entrando na Última
   * Chance saíam 4 pulsos em 320ms (o `thud` daqui + o `suspense` da fase), que
   * no motor do celular viram um borrão só em vez de suspense — e no
   * `WordRevealPhase`, que é deliberadamente silencioso para não fazer a mesa
   * olhar para quem está com o segredo, o `thud` daqui furava essa contenção.
   *
   * Quem vibra é a fase, que sabe o que a transição significa. O ref continua
   * aqui porque a comparação de fase anterior é útil para quem consome.
   */
  function noteRoom(nextRoom: Room | null) {
    if (nextRoom) lastStatus.current = nextRoom.status
  }

  /**
   * `useEffectEvent` e não `useCallback`: chamar direto uma função que faz
   * setState no corpo do efeito dispara render em cascata (e o lint reclama, com
   * razão). Effect Event é o escape hatch desenhado para este caso — busca
   * pontual disparada por um efeito.
   */
  const loadRoom = useEffectEvent(async () => {
    if (!roomId) return
    const supabase = getSupabaseClient()

    const [roomResult, playersResult] = await Promise.all([
      supabase.from('rooms').select('*').eq('id', roomId).maybeSingle(),
      supabase.from('players').select('*').eq('room_id', roomId).order('joined_at'),
    ])

    if (!mounted.current) return

    if (roomResult.error || playersResult.error) {
      setState((prev) => ({ ...prev, loading: false, error: 'Não foi possível carregar a sala.' }))
      return
    }

    noteRoom(roomResult.data)

    setState((prev) => ({
      ...prev,
      room: roomResult.data,
      players: playersResult.data ?? [],
      loading: false,
      error: roomResult.data ? null : 'Sala não encontrada.',
    }))
  })

  useEffect(() => {
    mounted.current = true
    if (!roomId) return

    const supabase = getSupabaseClient()

    // Carga inicial em microtask, não no corpo do efeito: assim o primeiro
    // setState acontece depois do flush de render, sem cascata. O canal também
    // recarrega em SUBSCRIBED, mas esta chamada é o que garante que a sala apareça
    // mesmo se o WebSocket estiver bloqueado (wi-fi corporativo, extensão).
    void Promise.resolve().then(() => loadRoom())

    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          if (!mounted.current) return
          const incoming = payload.new as Room
          noteRoom(incoming)
          setState((prev) => ({ ...prev, room: incoming }))
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` },
        (payload) => {
          if (!mounted.current) return

          if (payload.eventType === 'DELETE') {
            const gone = payload.old as Partial<Player>
            setState((prev) => ({ ...prev, players: prev.players.filter((p) => p.id !== gone.id) }))
            return
          }

          const incoming = payload.new as Player

          // Só o lobby ganha o toque de "chegou gente": nas fases seguintes o
          // roster já está fechado, e um jogador reaparecendo (reconexão) não é
          // novidade nenhuma.
          if (payload.eventType === 'INSERT' && lastStatus.current === 'LOBBY') {
            haptics.tap()
          }

          setState((prev) => {
            const others = prev.players.filter((p) => p.id !== incoming.id)
            return { ...prev, players: sortByJoin([...others, incoming]) }
          })
        },
      )
      .subscribe((status) => {
        if (!mounted.current) return
        const isConnected = status === 'SUBSCRIBED'
        setState((prev) => ({ ...prev, connected: isConnected }))
        // Fecha a janela entre o fetch inicial e o canal ficar pronto.
        if (isConnected) void loadRoom()
      })

    return () => {
      mounted.current = false
      void supabase.removeChannel(channel)
    }
  }, [roomId])

  // Ressincroniza quando o app volta ao primeiro plano ou a sondagem bate.
  useEffect(() => {
    if (!roomId || freshness === 0) return
    void Promise.resolve().then(() => loadRoom())
  }, [roomId, freshness])

  return state
}
