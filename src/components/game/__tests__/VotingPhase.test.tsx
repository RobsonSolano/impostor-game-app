import type { ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { VotingPhase } from '@/components/game/VotingPhase'
import type { Player, Room } from '@/lib/types'

/**
 * `votes` não tem SELECT para o cliente (AGENTS.md, regra 3): esta fase nunca
 * deriva nada de voto individual, só do contador `room.votes_cast` e — depois
 * de resolvida — de `room.last_vote_tally`. Os testes aqui provam
 * comportamento (quem aparece, o que é enviado ao banco), nunca snapshot.
 */

const mockCastVote = jest.fn<Promise<void>, [string, string | null]>().mockResolvedValue(undefined)

jest.mock('@/lib/game/actions', () => ({
  castVote: (roomId: string, targetPlayerId: string | null) => mockCastVote(roomId, targetPlayerId),
}))

jest.mock(
  '@/components/shared/PhaseShell',
  () => {
    const { Text, View } = require('react-native')
    return {
      PhaseShell: ({
        title,
        subtitle,
        action,
        children,
      }: {
        title: ReactNode
        subtitle?: ReactNode
        action?: ReactNode
        children?: ReactNode
      }) => (
        <View>
          <Text>{title}</Text>
          {subtitle}
          {children}
          {action}
        </View>
      ),
    }
  },
)

jest.mock(
  '@/components/shared/PlayerAvatar',
  () => ({ PlayerAvatar: () => null }),
)

jest.mock(
  '@/components/shared/WaitingPill',
  () => {
    const { Text } = require('react-native')
    return {
      WaitingPill: ({ label }: { label: string }) => <Text>{label}</Text>,
    }
  },
)

jest.mock(
  '@/components/ui/Button',
  () => {
    const { Text } = require('react-native')
    return {
      Button: ({
        label,
        onPress,
        disabled,
      }: {
        label: string
        onPress: () => void
        disabled?: boolean
      }) => (
        <Text
          accessibilityRole="button"
          accessibilityState={{ disabled: Boolean(disabled) }}
          onPress={() => {
            if (!disabled) onPress()
          }}
        >
          {label}
        </Text>
      ),
    }
  },
)

jest.mock(
  '@/components/ui/Card',
  () => {
    const { View } = require('react-native')
    return { Card: ({ children }: { children: ReactNode }) => <View>{children}</View> }
  },
)

jest.mock(
  '@/components/ui/Text',
  () => {
    const { Text: RNText } = require('react-native')
    return {
      AppText: ({ children, ...rest }: { children: ReactNode }) => <RNText {...rest}>{children}</RNText>,
    }
  },
)

function makeRoom(overrides: Partial<Room> = {}): Room {
  return {
    active_round_id: 'round-1',
    clue_turn_index: 0,
    code: 'ABCD',
    created_at: '2026-09-03T12:00:00.000Z',
    discussion_round: 1,
    eliminated_player_id: null,
    games_played: 1,
    guess_deadline: null,
    host_player_id: 'p1',
    id: 'room-1',
    last_vote_tally: null,
    outcome: null,
    revealed_impostor_id: null,
    revealed_word: null,
    status: 'VOTING',
    turn_deadline: null,
    updated_at: '2026-09-03T12:00:00.000Z',
    votes_cast: 0,
    voting_cycle: 1,
    ...overrides,
  }
}

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    avatar_color: '#39ff14',
    has_seen_card: true,
    has_voted: false,
    id: 'p1',
    is_alive: true,
    joined_at: '2026-09-03T12:00:00.000Z',
    name: 'Jogador',
    profanity_strikes: 0,
    room_id: 'room-1',
    score: 0,
    user_id: 'u1',
    ...overrides,
  }
}

beforeEach(() => {
  mockCastVote.mockClear()
})

describe('VotingPhase', () => {
  it('não lista o próprio jogador entre os suspeitos', () => {
    const me = makePlayer({ id: 'p1', name: 'Eu' })
    const outro = makePlayer({ id: 'p2', name: 'Fulano' })
    const players = [me, outro]

    render(<VotingPhase room={makeRoom()} players={players} me={me} isHost={false} />)

    expect(screen.queryByText('Eu')).toBeNull()
    expect(screen.getByText('Fulano')).toBeTruthy()
  })

  it('não deixa confirmar sem selecionar ninguém', () => {
    const me = makePlayer({ id: 'p1', name: 'Eu' })
    const outro = makePlayer({ id: 'p2', name: 'Fulano' })

    render(<VotingPhase room={makeRoom()} players={[me, outro]} me={me} isHost={false} />)

    fireEvent.press(screen.getByText('Confirmar voto'))

    expect(mockCastVote).not.toHaveBeenCalled()
  })

  it('envia o id do suspeito escolhido ao confirmar', () => {
    const me = makePlayer({ id: 'p1', name: 'Eu' })
    const outro = makePlayer({ id: 'p2', name: 'Fulano' })

    render(<VotingPhase room={makeRoom({ id: 'room-42' })} players={[me, outro]} me={me} isHost={false} />)

    fireEvent.press(screen.getByTestId('suspect-p2'))
    fireEvent.press(screen.getByText('Confirmar voto'))

    expect(mockCastVote).toHaveBeenCalledWith('room-42', 'p2')
  })

  it('envia null quando a escolha é pular a votação', () => {
    const me = makePlayer({ id: 'p1', name: 'Eu' })
    const outro = makePlayer({ id: 'p2', name: 'Fulano' })

    render(<VotingPhase room={makeRoom({ id: 'room-42' })} players={[me, outro]} me={me} isHost={false} />)

    fireEvent.press(screen.getByTestId('skip-vote'))
    fireEvent.press(screen.getByText('Confirmar: pular votação'))

    expect(mockCastVote).toHaveBeenCalledWith('room-42', null)
  })

  it('mostra a tela de voto registrado para quem já votou, em vez da lista de suspeitos', () => {
    const me = makePlayer({ id: 'p1', name: 'Eu', has_voted: true })
    const outro = makePlayer({ id: 'p2', name: 'Fulano', has_voted: false })

    render(
      <VotingPhase
        room={makeRoom({ votes_cast: 1 })}
        players={[me, outro]}
        me={me}
        isHost={false}
      />,
    )

    expect(screen.getByText('Voto registrado')).toBeTruthy()
    // Sem lista de suspeito para tocar — o voto já foi.
    expect(screen.queryByTestId('suspect-p2')).toBeNull()
  })
})
