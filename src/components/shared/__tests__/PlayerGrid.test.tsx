import { render } from '@testing-library/react-native'
import { PlayerGrid } from '@/components/shared/PlayerGrid'
import type { Player } from '@/lib/types'

/** Jogador mínimo válido para o tipo do banco, com só o necessário sobrescrito por teste. */
function makePlayer(overrides: Partial<Player> & Pick<Player, 'id' | 'name'>): Player {
  return {
    avatar_color: '#39ff14',
    has_seen_card: false,
    has_voted: false,
    is_alive: true,
    joined_at: new Date().toISOString(),
    profanity_strikes: 0,
    room_id: 'room-1',
    score: 0,
    user_id: overrides.id,
    ...overrides,
  }
}

describe('PlayerGrid', () => {
  it('marca o host com a coroa', () => {
    const players = [makePlayer({ id: 'p1', name: 'Ana' }), makePlayer({ id: 'p2', name: 'Beto' })]
    const { getAllByLabelText } = render(<PlayerGrid players={players} hostPlayerId="p1" />)

    // `react-native-svg` propaga `accessibilityLabel` por mais de um nó
    // interno do próprio ícone — o que importa é que existe pelo menos um,
    // não a contagem exata de nós SVG por trás dele.
    expect(getAllByLabelText('Host').length).toBeGreaterThan(0)
  })

  it('marca quem está pronto com o selo e o rótulo — só quem está em readyIds', () => {
    const players = [makePlayer({ id: 'p1', name: 'Ana' }), makePlayer({ id: 'p2', name: 'Beto' })]
    const { getAllByText } = render(
      <PlayerGrid players={players} readyIds={new Set(['p1'])} readyLabel="viu a palavra" />,
    )

    // Só Ana (p1) está em `readyIds` — um selo só na árvore, não um por jogador.
    expect(getAllByText('viu a palavra')).toHaveLength(1)
  })

  it('mostra "(você)" ao lado do próprio nome, e só do próprio', () => {
    const players = [makePlayer({ id: 'p1', name: 'Ana' }), makePlayer({ id: 'p2', name: 'Beto' })]
    const { getByText, queryByText } = render(<PlayerGrid players={players} myPlayerId="p1" />)

    expect(getByText('Ana')).toBeTruthy()
    expect(getByText('(você)')).toBeTruthy()
    expect(queryByText('Beto (você)')).toBeNull()
  })
})
