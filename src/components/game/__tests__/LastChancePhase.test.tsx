import type { ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { LastChancePhase } from '@/components/game/LastChancePhase'
import type { Player, PlayerCard, Room } from '@/lib/types'

/**
 * O que mais importa provar aqui: quem NÃO é o impostor nunca vê
 * `last_chance_options` — é vazamento de segredo se ver. O resto (impostor vê
 * as 4, tocar já envia) é o roteiro normal da fase.
 */

const mockSubmitGuess = jest.fn<Promise<void>, [string, string]>().mockResolvedValue(undefined)
const mockExpireLastChance = jest.fn().mockResolvedValue(undefined)

jest.mock('@/lib/game/actions', () => ({
  submitGuess: (roomId: string, word: string) => mockSubmitGuess(roomId, word),
  expireLastChance: (roomId: string) => mockExpireLastChance(roomId),
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
    return { WaitingPill: ({ label }: { label: string }) => <Text>{label}</Text> }
  },
)

jest.mock(
  '@/components/shared/Countdown',
  () => {
    const { Text } = require('react-native')
    return { Countdown: () => <Text>contagem</Text> }
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
  '@/components/ui/Spinner',
  () => ({ Spinner: () => null }),
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
    // Presente na base mesmo valendo `null`: sem isto o spread de
    // `Partial<Room>` deixa o campo `string | null | undefined` e a fábrica
    // para de satisfazer `Room`.
    clue_round_starts_at: null,
    is_public: false,
    title: null,
    clue_turn_index: 0,
    code: 'ABCD',
    created_at: '2026-09-03T12:00:00.000Z',
    discussion_round: 1,
    eliminated_player_id: 'p2',
    games_played: 1,
    guess_deadline: '2026-09-03T12:00:05.000Z',
    host_player_id: 'p1',
    id: 'room-1',
    last_vote_tally: null,
    outcome: null,
    revealed_impostor_id: null,
    revealed_word: null,
    status: 'LAST_CHANCE',
    turn_deadline: null,
    updated_at: '2026-09-03T12:00:00.000Z',
    votes_cast: 3,
    voting_cycle: 1,
    ...overrides,
  }
}

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    avatar_color: '#39ff14',
    has_seen_card: true,
    has_voted: true,
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

function makeCard(overrides: Partial<PlayerCard> = {}): PlayerCard {
  return {
    is_impostor: false,
    last_chance_options: null,
    player_id: 'p1',
    room_id: 'room-1',
    round_id: 'round-1',
    word_text: 'gato',
    ...overrides,
  }
}

const OPTIONS = ['gato', 'cachorro', 'papagaio', 'hamster']

beforeEach(() => {
  mockSubmitGuess.mockClear()
  mockExpireLastChance.mockClear()
})

describe('LastChancePhase', () => {
  it('não mostra as opções para quem não é o impostor — vazaria a resposta', () => {
    const me = makePlayer({ id: 'p3', name: 'Eu' })
    const eliminado = makePlayer({ id: 'p2', name: 'Fulano' })
    const card = makeCard({ is_impostor: false, last_chance_options: OPTIONS })

    render(
      <LastChancePhase
        room={makeRoom({ eliminated_player_id: 'p2' })}
        players={[me, eliminado]}
        me={me}
        isHost={false}
        card={card}
      />,
    )

    for (const word of OPTIONS) {
      expect(screen.queryByText(word)).toBeNull()
    }
    expect(screen.getByText('Aguardando o palpite')).toBeTruthy()
  })

  it('mostra as 4 opções para o impostor', () => {
    const me = makePlayer({ id: 'p2', name: 'Impostor' })
    const card = makeCard({ is_impostor: true, last_chance_options: OPTIONS })

    render(
      <LastChancePhase
        room={makeRoom({ eliminated_player_id: 'p2' })}
        players={[me]}
        me={me}
        isHost={false}
        card={card}
      />,
    )

    for (const word of OPTIONS) {
      expect(screen.getByText(word)).toBeTruthy()
    }
  })

  it('ao tocar numa opção, envia exatamente essa palavra ao banco', () => {
    const me = makePlayer({ id: 'p2', name: 'Impostor' })
    const card = makeCard({ is_impostor: true, last_chance_options: OPTIONS })

    render(
      <LastChancePhase
        room={makeRoom({ id: 'room-9', eliminated_player_id: 'p2' })}
        players={[me]}
        me={me}
        isHost={false}
        card={card}
      />,
    )

    fireEvent.press(screen.getByTestId('guess-papagaio'))

    expect(mockSubmitGuess).toHaveBeenCalledWith('room-9', 'papagaio')
    expect(mockSubmitGuess).toHaveBeenCalledTimes(1)
  })
})
