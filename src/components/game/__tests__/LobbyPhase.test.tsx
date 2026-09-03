import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'

import { LobbyPhase } from '@/components/game/LobbyPhase'
import { startGame } from '@/lib/game/actions'
import type { Player, Room } from '@/lib/types'

/**
 * Testa só a lógica do LobbyPhase (regra de 3 jogadores, host vs. convidado,
 * chamada de RPC) — não a aparência real de `Button`/`Card`/`PhaseShell`, que
 * são peças de outros agentes com testes próprios. Os stands-in abaixo
 * preservam o formato do contrato (`.specs/CONTRACTS.md`): `disabled` chega a
 * um `Pressable` de verdade, então o React Native (e o Testing Library) já
 * recusam o `press` sozinhos quando desabilitado — não é o mock que decide isso.
 */
jest.mock('@/components/ui/Text', () => {
  const RN = require('react-native')
  return { AppText: (props: Record<string, unknown>) => <RN.Text {...props} /> }
})

jest.mock('@/components/ui/Button', () => {
  const RN = require('react-native')
  return {
    Button: ({
      label,
      onPress,
      disabled,
      accessibilityLabel,
    }: {
      label: string
      onPress: () => void
      disabled?: boolean
      accessibilityLabel?: string
    }) => (
      <RN.Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
      >
        <RN.Text>{label}</RN.Text>
      </RN.Pressable>
    ),
  }
})

jest.mock('@/components/ui/Card', () => {
  const RN = require('react-native')
  return {
    Card: ({ children, style }: { children: React.ReactNode; style?: unknown }) => (
      <RN.View style={style}>{children}</RN.View>
    ),
  }
})

jest.mock('@/components/shared/PhaseShell', () => {
  const RN = require('react-native')
  return {
    PhaseShell: ({
      children,
      aside,
      action,
    }: {
      children?: React.ReactNode
      aside?: React.ReactNode
      action?: React.ReactNode
    }) => (
      <RN.View>
        {children}
        {aside}
        {action}
      </RN.View>
    ),
  }
})

jest.mock('@/components/shared/PlayerGrid', () => ({ PlayerGrid: () => null }))

jest.mock('@/components/shared/WaitingPill', () => {
  const RN = require('react-native')
  return {
    WaitingPill: ({ label }: { label: string }) => <RN.Text>{label}</RN.Text>,
  }
})

jest.mock('@/lib/game/actions', () => ({
  startGame: jest.fn(() => Promise.resolve()),
  confirmWordSeen: jest.fn(() => Promise.resolve()),
}))

/**
 * Fábrica de `Room`/`Player` completos — tipos reais do banco
 * (`@/lib/types`), nunca `as any` fingindo um objeto parcial. Cada teste
 * sobrescreve só o campo que importa para o cenário.
 */
function makeRoom(overrides: Partial<Room> = {}): Room {
  return {
    active_round_id: null,
    clue_turn_index: 0,
    code: 'AB12',
    created_at: '2026-09-03T12:00:00.000Z',
    discussion_round: 0,
    eliminated_player_id: null,
    games_played: 0,
    guess_deadline: null,
    host_player_id: 'host-1',
    id: 'room-1',
    last_vote_tally: null,
    outcome: null,
    revealed_impostor_id: null,
    revealed_word: null,
    status: 'LOBBY',
    turn_deadline: null,
    updated_at: '2026-09-03T12:00:00.000Z',
    votes_cast: 0,
    voting_cycle: 0,
    ...overrides,
  }
}

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    avatar_color: '#39ff14',
    has_seen_card: false,
    has_voted: false,
    id: 'player-1',
    is_alive: true,
    joined_at: '2026-09-03T12:00:00.000Z',
    name: 'Jogador',
    profanity_strikes: 0,
    room_id: 'room-1',
    score: 0,
    user_id: 'user-1',
    ...overrides,
  }
}

describe('LobbyPhase', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('desabilita o botão do host com menos de 3 jogadores (o toque não inicia a partida)', () => {
    const room = makeRoom()
    const host = makePlayer({ id: 'host-1' })
    const players = [host, makePlayer({ id: 'player-2' })]

    render(<LobbyPhase room={room} players={players} me={host} isHost />)

    // Verbo concorda com a contagem: falta 1 (singular) jogador, não "faltam".
    fireEvent.press(screen.getByText('Falta 1 jogador'))

    expect(startGame).not.toHaveBeenCalled()
  })

  it('habilita o botão do host com 3 jogadores e chama startGame ao tocar', async () => {
    const room = makeRoom({ id: 'room-42' })
    const host = makePlayer({ id: 'host-1' })
    const players = [host, makePlayer({ id: 'player-2' }), makePlayer({ id: 'player-3' })]

    render(<LobbyPhase room={room} players={players} me={host} isHost />)

    fireEvent.press(screen.getByText('Iniciar partida'))

    // `start()` segue assíncrono depois do `press` (RPC + `setBusy(false)` no
    // `finally`); espera a promise resolver em vez de checar de imediato.
    await waitFor(() => expect(startGame).toHaveBeenCalledWith('room-42'))
  })

  it('concorda o verbo com a contagem de quantos jogadores faltam (singular e plural)', () => {
    const host = makePlayer({ id: 'host-1' })

    const { rerender } = render(
      <LobbyPhase room={makeRoom()} players={[host]} me={host} isHost />,
    )
    // Faltam 2: plural nos dois lados, "Faltam" e "jogadores".
    expect(screen.getByText('Faltam 2 jogadores')).toBeTruthy()

    rerender(
      <LobbyPhase
        room={makeRoom()}
        players={[host, makePlayer({ id: 'player-2' })]}
        me={host}
        isHost
      />,
    )
    // Falta 1: singular nos dois lados — "Faltam 1 jogador" é o erro do web.
    expect(screen.getByText('Falta 1 jogador')).toBeTruthy()
  })

  it('quem não é host não vê botão de iniciar, só o aviso de espera', () => {
    const room = makeRoom()
    const players = [
      makePlayer({ id: 'host-1' }),
      makePlayer({ id: 'player-2' }),
      makePlayer({ id: 'player-3' }),
    ]
    const me = players[1] as Player

    render(<LobbyPhase room={room} players={players} me={me} isHost={false} />)

    expect(screen.queryByText('Iniciar partida')).toBeNull()
    expect(screen.getByText('Aguardando o host iniciar')).toBeTruthy()
  })
})
