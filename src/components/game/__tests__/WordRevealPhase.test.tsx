import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { View } from 'react-native'

import { WordRevealPhase } from '@/components/game/WordRevealPhase'
import { confirmWordSeen } from '@/lib/game/actions'
import type { Player, PlayerCard, Room } from '@/lib/types'
import type { HoldToReveal as HoldToRevealComponent } from '@/components/shared/HoldToReveal'

type HoldToRevealProps = Parameters<typeof HoldToRevealComponent>[0]

/**
 * Testa a lógica do WordRevealPhase (o que aparece dependendo de
 * `card.is_impostor`/`card` nulo/`me.has_seen_card`) — não o gesto de segurar
 * em si, que é do `HoldToReveal` (peça de outro agente, com teste próprio).
 * Por isso o mock do `HoldToReveal` renderiza `children` direto: equivale a
 * testar o estado "já revelado", sem depender do timing real do hold de 2s.
 *
 * O stub é um `jest.fn` (não uma função solta) DE PROPÓSITO: o `describe` no
 * fim deste arquivo troca a implementação por `jest.requireActual` para uma
 * verificação com o `HoldToReveal` de verdade — ver o comentário lá.
 */
const mockHoldToRevealStub = jest.fn((props: HoldToRevealProps) => <View>{props.children}</View>)

jest.mock('@/components/shared/HoldToReveal', () => ({
  HoldToReveal: (props: HoldToRevealProps) => mockHoldToRevealStub(props),
}))

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
 * Fábrica de `Room`/`Player`/`PlayerCard` completos — tipos reais do banco
 * (`@/lib/types`), nunca `as any` fingindo um objeto parcial.
 */
function makeRoom(overrides: Partial<Room> = {}): Room {
  return {
    active_round_id: 'round-1',
    // Presente na base mesmo valendo `null`: sem isto o spread de
    // `Partial<Room>` deixa o campo `string | null | undefined` e a fábrica
    // para de satisfazer `Room`.
    clue_round_starts_at: null,
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
    status: 'WORD_REVEAL',
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

function makePlayerCard(overrides: Partial<PlayerCard> = {}): PlayerCard {
  return {
    is_impostor: false,
    last_chance_options: null,
    player_id: 'player-1',
    room_id: 'room-1',
    round_id: 'round-1',
    word_text: 'Girafa',
    ...overrides,
  }
}

describe('WordRevealPhase', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('mostra o texto de impostor quando card.is_impostor é true', () => {
    const room = makeRoom()
    const me = makePlayer({ id: 'player-1' })
    const players = [me, makePlayer({ id: 'player-2' }), makePlayer({ id: 'player-3' })]
    const card = makePlayerCard({ is_impostor: true, word_text: null })

    render(<WordRevealPhase room={room} players={players} me={me} isHost={false} card={card} />)

    expect(screen.getByText('VOCÊ É O IMPOSTOR 👀')).toBeTruthy()
    expect(screen.queryByText('Girafa')).toBeNull()
  })

  it('mostra a palavra quando card.is_impostor é false', () => {
    const room = makeRoom()
    const me = makePlayer({ id: 'player-1' })
    const players = [me, makePlayer({ id: 'player-2' }), makePlayer({ id: 'player-3' })]
    const card = makePlayerCard({ is_impostor: false, word_text: 'Girafa' })

    render(<WordRevealPhase room={room} players={players} me={me} isHost={false} card={card} />)

    expect(screen.getByText('Girafa')).toBeTruthy()
    expect(screen.queryByText('VOCÊ É O IMPOSTOR 👀')).toBeNull()
  })

  it('desabilita "Já vi minha palavra" enquanto o card ainda não chegou (o toque não confirma)', () => {
    const room = makeRoom()
    const me = makePlayer({ id: 'player-1' })
    const players = [me, makePlayer({ id: 'player-2' }), makePlayer({ id: 'player-3' })]

    render(<WordRevealPhase room={room} players={players} me={me} isHost={false} card={null} />)

    fireEvent.press(screen.getByText('Já vi minha palavra'))

    expect(confirmWordSeen).not.toHaveBeenCalled()
  })

  it('chama confirmWordSeen ao tocar em "Já vi minha palavra" com o card presente', async () => {
    const room = makeRoom({ id: 'room-9' })
    const me = makePlayer({ id: 'player-1' })
    const players = [me, makePlayer({ id: 'player-2' }), makePlayer({ id: 'player-3' })]
    const card = makePlayerCard()

    render(<WordRevealPhase room={room} players={players} me={me} isHost={false} card={card} />)

    fireEvent.press(screen.getByText('Já vi minha palavra'))

    // `confirm()` segue assíncrono depois do `press` (RPC + `setBusy(false)` no
    // `finally`); espera a promise resolver em vez de checar de imediato.
    await waitFor(() => expect(confirmWordSeen).toHaveBeenCalledWith('room-9'))
  })

  it('quem já viu (me.has_seen_card) não vê o botão de confirmar', () => {
    const room = makeRoom()
    const me = makePlayer({ id: 'player-1', has_seen_card: true })
    const players = [
      me,
      makePlayer({ id: 'player-2', has_seen_card: false }),
      makePlayer({ id: 'player-3', has_seen_card: false }),
    ]
    const card = makePlayerCard()

    render(<WordRevealPhase room={room} players={players} me={me} isHost={false} card={card} />)

    expect(screen.queryByText('Já vi minha palavra')).toBeNull()
    expect(screen.getByText('Faltam 2 jogadores ver o card')).toBeTruthy()
  })
})

/**
 * O mock de `HoldToReveal` usado acima renderiza `children` sempre — ótimo
 * para testar o TEXTO de cada card, mas apaga a única garantia que esta fase
 * precisa dar: que a palavra secreta está DENTRO do gate, não solta na tela.
 * Com aquele mock, `getByText('Girafa')` passaria idêntico se alguém movesse
 * a palavra para FORA do `HoldToReveal`.
 *
 * Este describe troca a implementação do mock pela função REAL de
 * `HoldToReveal` (via `jest.requireActual`, que ignora o `jest.mock` do topo
 * do arquivo só para esta chamada — sem `jest.resetModules()`, que criaria uma
 * segunda cópia de `react`/`react-native` e quebraria os hooks com "Invalid
 * hook call"). Só o card de verdade decide se a palavra aparece.
 */
describe('WordRevealPhase — o HoldToReveal de verdade é quem decide (nunca o mock)', () => {
  afterEach(() => {
    // Devolve o stub padrão para não vazar a implementação real para as
    // outras suítes deste arquivo, caso a ordem de execução mude.
    mockHoldToRevealStub.mockImplementation((props: HoldToRevealProps) => (
      <View>{props.children}</View>
    ))
  })

  it('a palavra secreta NÃO aparece antes de qualquer toque no card', () => {
    const { HoldToReveal: RealHoldToReveal } = jest.requireActual('@/components/shared/HoldToReveal') as {
      HoldToReveal: typeof HoldToRevealComponent
    }
    mockHoldToRevealStub.mockImplementation(RealHoldToReveal)

    const room = makeRoom()
    const me = makePlayer({ id: 'player-1' })
    const players = [me, makePlayer({ id: 'player-2' }), makePlayer({ id: 'player-3' })]
    const card = makePlayerCard({ is_impostor: false, word_text: 'Girafa' })

    render(<WordRevealPhase room={room} players={players} me={me} isHost={false} card={card} />)

    expect(screen.queryByText('Girafa')).toBeNull()
  })
})
