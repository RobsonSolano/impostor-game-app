import type { ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { CluePhase } from '@/components/game/CluePhase'
import { haptics } from '@/lib/haptics'
import type { Player, Room, RoundClue } from '@/lib/types'

/**
 * Testa só a lógica do `CluePhase` (quem vê turno para escrever, o segredo do
 * `dismissedTurn`, a vibração na transição de turno) — não a aparência real de
 * `Button`/`Card`/`PhaseShell`/`Countdown`, que são peças de outros agentes com
 * testes próprios. `ClueDialog` também é mockado: é o componente irmão desta
 * mesma fase, com teste próprio em `ClueDialog.test.tsx`.
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
    }: {
      label: string
      onPress: () => void
      disabled?: boolean
    }) => (
      <RN.Pressable onPress={onPress} disabled={disabled} accessibilityRole="button">
        <RN.Text>{label}</RN.Text>
      </RN.Pressable>
    ),
  }
})

jest.mock('@/components/ui/Card', () => {
  const RN = require('react-native')
  return {
    Card: ({ children, style }: { children: ReactNode; style?: unknown }) => (
      <RN.View style={style}>{children}</RN.View>
    ),
  }
})

jest.mock('@/components/shared/PhaseShell', () => {
  const RN = require('react-native')
  return {
    PhaseShell: ({
      title,
      subtitle,
      children,
      aside,
      action,
    }: {
      title: ReactNode
      subtitle?: ReactNode
      children?: ReactNode
      aside?: ReactNode
      action?: ReactNode
    }) => (
      <RN.View>
        <RN.Text>{title}</RN.Text>
        {subtitle}
        {children}
        {aside}
        {action}
      </RN.View>
    ),
  }
})

jest.mock('@/components/shared/PlayerGrid', () => ({ PlayerGrid: () => null }))
jest.mock('@/components/shared/PlayerAvatar', () => ({ PlayerAvatar: () => null }))

jest.mock('@/components/shared/WaitingPill', () => {
  const RN = require('react-native')
  return {
    WaitingPill: ({ label }: { label: string }) => <RN.Text>{label}</RN.Text>,
  }
})

jest.mock('@/components/shared/Countdown', () => {
  const RN = require('react-native')
  return { Countdown: () => <RN.Text>contagem</RN.Text> }
})

// `ClueDialog` é o componente irmão testado em `ClueDialog.test.tsx`; aqui só
// interessa SE ele está `open` e SE `onDismiss` chega até ele.
jest.mock('@/components/game/ClueDialog', () => {
  const RN = require('react-native')
  return {
    ClueDialog: ({ open, onDismiss }: { open: boolean; onDismiss: () => void }) =>
      open ? (
        <RN.Pressable onPress={onDismiss} accessibilityRole="button" accessibilityLabel="fechar popup">
          <RN.Text>popup de dica aberto</RN.Text>
        </RN.Pressable>
      ) : null,
  }
})

jest.mock('@/lib/game/actions', () => ({
  expireClueTurn: jest.fn(() => Promise.resolve()),
  nextClueRound: jest.fn(() => Promise.resolve()),
  openVoting: jest.fn(() => Promise.resolve()),
}))

jest.mock('@/lib/haptics', () => ({
  haptics: {
    tap: jest.fn(),
    select: jest.fn(),
    press: jest.fn(),
    thud: jest.fn(),
    success: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    tick: jest.fn(),
    soft: jest.fn(),
    suspense: jest.fn(),
    fanfare: jest.fn(),
    defeat: jest.fn(),
  },
}))

/**
 * Fábrica de `Room`/`Player`/`RoundClue` completos — tipos reais do banco
 * (`@/lib/types`), nunca `as any` fingindo um objeto parcial.
 */
function makeRoom(overrides: Partial<Room> = {}): Room {
  return {
    active_round_id: 'round-1',
    clue_turn_index: 0,
    code: 'AB12',
    created_at: '2026-09-03T12:00:00.000Z',
    discussion_round: 1,
    eliminated_player_id: null,
    games_played: 0,
    guess_deadline: null,
    host_player_id: 'host-1',
    id: 'room-1',
    last_vote_tally: null,
    outcome: null,
    revealed_impostor_id: null,
    revealed_word: null,
    status: 'DISCUSSION',
    turn_deadline: new Date(Date.now() + 15_000).toISOString(),
    updated_at: '2026-09-03T12:00:00.000Z',
    votes_cast: 0,
    voting_cycle: 0,
    ...overrides,
  }
}

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    avatar_color: '#39ff14',
    has_seen_card: true,
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

function makeClue(overrides: Partial<RoundClue> = {}): RoundClue {
  return {
    discussion_round: 1,
    player_id: 'player-1',
    round_id: 'round-1',
    // Presente na base mesmo valendo `null`: sem isto o spread de
    // `Partial<RoundClue>` deixa o campo `string | null | undefined` e a fábrica
    // para de satisfazer `RoundClue`.
    submitted_at: null,
    timed_out: false,
    turn_index: 0,
    word: null,
    ...overrides,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('CluePhase', () => {
  it('quem não está is_alive não vê turno para escrever, mas continua vendo as dicas acumuladas', () => {
    const me = makePlayer({ id: 'player-2', is_alive: false })
    const players = [
      makePlayer({ id: 'player-1' }),
      me,
      makePlayer({ id: 'player-3' }),
    ]
    const clues = [makeClue({ player_id: 'player-1', turn_index: 0, word: 'tromba' })]

    render(
      <CluePhase
        room={makeRoom()}
        players={players}
        me={me}
        isHost={false}
        clues={clues}
      />,
    )

    expect(screen.getByText('Você está fora desta partida')).toBeTruthy()
    expect(screen.queryByText('Escrever minha palavra')).toBeNull()
    expect(screen.queryByText('popup de dica aberto')).toBeNull()

    // A dica já dada continua na mesa — é sobre o acumulado que a mesa desconfia.
    expect(screen.getByText('tromba')).toBeTruthy()
  })

  it('dismissedTurn de um turno não silencia o popup do turno seguinte', () => {
    const me = makePlayer({ id: 'player-1' })
    const players = [me, makePlayer({ id: 'player-2' }), makePlayer({ id: 'player-3' })]

    const room1 = makeRoom({
      discussion_round: 1,
      clue_turn_index: 0,
      turn_deadline: new Date(Date.now() + 15_000).toISOString(),
    })
    const clues1 = [makeClue({ discussion_round: 1, turn_index: 0, player_id: me.id, word: null })]

    const { rerender } = render(
      <CluePhase room={room1} players={players} me={me} isHost={false} clues={clues1} />,
    )

    // Turno 1: é minha vez, o popup abre sozinho.
    expect(screen.getByText('popup de dica aberto')).toBeTruthy()

    // Fecho para consultar a mesa: o popup some, mas o botão de reabrir aparece
    // — fechar não desiste do turno.
    fireEvent.press(screen.getByText('popup de dica aberto'))
    expect(screen.queryByText('popup de dica aberto')).toBeNull()
    expect(screen.getByText('Escrever minha palavra')).toBeTruthy()

    // Nova rodada: turno novo (chave diferente). Se `dismissedTurn` fosse um
    // booleano em vez de guardar QUAL turno foi dispensado, o popup
    // continuaria fechado aqui — e não deveria.
    const room2 = makeRoom({
      discussion_round: 2,
      clue_turn_index: 0,
      turn_deadline: new Date(Date.now() + 15_000).toISOString(),
    })
    const clues2 = [
      makeClue({ discussion_round: 1, turn_index: 0, player_id: me.id, word: 'tromba' }),
      makeClue({ discussion_round: 2, turn_index: 0, player_id: me.id, word: null }),
    ]

    rerender(<CluePhase room={room2} players={players} me={me} isHost={false} clues={clues2} />)

    expect(screen.getByText('popup de dica aberto')).toBeTruthy()
  })

  it('vibra com haptics.suspense() só na transição para "chegou a sua vez"', () => {
    const me = makePlayer({ id: 'player-1' })
    const others = [makePlayer({ id: 'player-2' }), makePlayer({ id: 'player-3' })]
    const players = [me, ...others]

    // Rodada começa sendo a vez de outro jogador.
    const room1 = makeRoom({
      discussion_round: 1,
      clue_turn_index: 0,
      turn_deadline: new Date(Date.now() + 15_000).toISOString(),
    })
    const clues1 = [makeClue({ discussion_round: 1, turn_index: 0, player_id: 'player-2', word: null })]

    const { rerender } = render(
      <CluePhase room={room1} players={players} me={me} isHost={false} clues={clues1} />,
    )

    expect(haptics.suspense).not.toHaveBeenCalled()

    // Agora chega minha vez.
    const room2 = makeRoom({
      discussion_round: 1,
      clue_turn_index: 1,
      turn_deadline: new Date(Date.now() + 20_000).toISOString(),
    })
    const clues2 = [
      makeClue({ discussion_round: 1, turn_index: 0, player_id: 'player-2', word: 'tromba' }),
      makeClue({ discussion_round: 1, turn_index: 1, player_id: me.id, word: null }),
    ]
    rerender(<CluePhase room={room2} players={players} me={me} isHost={false} clues={clues2} />)

    expect(haptics.suspense).toHaveBeenCalledTimes(1)

    // Um re-render qualquer enquanto CONTINUA sendo minha vez não deve vibrar de novo.
    rerender(
      <CluePhase room={{ ...room2 }} players={players} me={me} isHost={false} clues={clues2} />,
    )
    expect(haptics.suspense).toHaveBeenCalledTimes(1)
  })
})
