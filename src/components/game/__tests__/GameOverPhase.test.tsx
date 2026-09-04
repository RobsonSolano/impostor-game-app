import type { ReactNode } from 'react'
import { act, render, screen } from '@testing-library/react-native'
import { GameOverPhase } from '@/components/game/GameOverPhase'
import type { Player, Room } from '@/lib/types'

// A tela de drumroll usa `useSafeAreaInsets()` (AGENTS.md, regra 11 — nada de
// `Dimensions.get('window')` para layout). Sem `<SafeAreaProvider>` real no
// teste, o mock oficial do pacote devolve insets zerados em vez de lançar.
jest.mock('react-native-safe-area-context', () =>
   
  // projeto transpila `export default` com interop de ESM, não substitui `module.exports` direto)
  require('react-native-safe-area-context/jest/mock').default,
)

/**
 * O drumroll (IMP-24) é puro suspense: o placar já está gravado no banco antes
 * da tela aparecer, mas o texto só pode revelar depois dos 5 segundos visíveis.
 * O teste que importa aqui é justamente esse: nada do resultado escapa antes da
 * hora, e tudo aparece depois.
 */

jest.mock(
  '@/components/shared/PhaseShell',
  () => {
    const { Text, View } = require('react-native')
    return {
      PhaseShell: ({
        title,
        subtitle,
        action,
        aside,
        children,
      }: {
        title: ReactNode
        subtitle?: ReactNode
        action?: ReactNode
        aside?: ReactNode
        children?: ReactNode
      }) => (
        <View>
          <Text>{title}</Text>
          {subtitle}
          {children}
          {aside}
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
  '@/components/shared/Confetti',
  () => ({ Confetti: () => null }),
)

jest.mock(
  '@/components/ui/Button',
  () => {
    const { Text } = require('react-native')
    return {
      Button: ({ label, onPress }: { label: string; onPress: () => void }) => (
        <Text accessibilityRole="button" onPress={onPress}>
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
    active_round_id: null,
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
    guess_deadline: null,
    host_player_id: 'p1',
    id: 'room-1',
    last_vote_tally: { cycle: 1, skip: 0, top: 2, players: { p2: 2 } },
    outcome: 'TRUTHERS_WIN',
    revealed_impostor_id: 'p2',
    revealed_word: 'girafa',
    status: 'GAME_OVER',
    turn_deadline: null,
    updated_at: '2026-09-03T12:00:00.000Z',
    votes_cast: 2,
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

/**
 * Cada segundo do drumroll só agenda o PRÓXIMO `setTimeout` depois que o
 * `useEffect` reage ao novo `secondsLeft` — e isso só acontece quando o React
 * comita o re-render. Um `advanceTimersByTime(5000)` de uma vez só dispara o
 * primeiro timer (o único já agendado) e para aí: os outros quatro ainda nem
 * existem. Por isso o avanço tem que ser segundo a segundo, com o `act` entre
 * cada um dando ao React a chance de rodar o efeito e agendar o próximo.
 */
function advanceDrumroll() {
  for (let i = 0; i < 5; i += 1) {
    act(() => {
      jest.advanceTimersByTime(1_000)
    })
  }
}

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('GameOverPhase', () => {
  it('não revela o resultado durante o drumroll', () => {
    const me = makePlayer({ id: 'p1', name: 'Eu' })
    const impostor = makePlayer({ id: 'p2', name: 'Fulano' })

    render(<GameOverPhase room={makeRoom()} players={[me, impostor]} me={me} isHost={false} />)

    expect(screen.getByText('Apurando os votos…')).toBeTruthy()
    expect(screen.queryByText('Fulano')).toBeNull()
    expect(screen.queryByText('girafa')).toBeNull()
    expect(screen.queryByText('Os verdadeiros venceram!')).toBeNull()
  })

  it('revela o impostor e a palavra depois que o drumroll termina', () => {
    const me = makePlayer({ id: 'p1', name: 'Eu' })
    const impostor = makePlayer({ id: 'p2', name: 'Fulano' })

    render(<GameOverPhase room={makeRoom()} players={[me, impostor]} me={me} isHost={false} />)

    advanceDrumroll()

    expect(screen.queryByText('Apurando os votos…')).toBeNull()
    // "Fulano" aparece duas vezes na tela revelada (o card do impostor e a
    // linha dele no placar) — o que importa é que apareceu, não a contagem.
    expect(screen.getAllByText('Fulano').length).toBeGreaterThan(0)
    expect(screen.getByText('girafa')).toBeTruthy()
    expect(screen.getByText('Os verdadeiros venceram!')).toBeTruthy()
  })

  it('mostra o botão de novo jogo só para o host, em qualquer desfecho', () => {
    const me = makePlayer({ id: 'p1', name: 'Eu' })
    const impostor = makePlayer({ id: 'p2', name: 'Fulano' })

    render(
      <GameOverPhase
        room={makeRoom({ outcome: 'IMPOSTOR_STEAL' })}
        players={[me, impostor]}
        me={me}
        isHost
      />,
    )

    advanceDrumroll()

    expect(screen.getByText('Novo jogo')).toBeTruthy()
    expect(
      screen.getByText(
        'O impostor foi descoberto, mas acertou a palavra na Última Chance e roubou a vitória.',
      ),
    ).toBeTruthy()
  })
})
