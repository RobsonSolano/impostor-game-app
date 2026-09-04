import { render, screen } from '@testing-library/react-native'
import { VotingOutcome } from '@/components/game/VotingOutcome'
import type { Player, VoteTally } from '@/lib/types'

/**
 * `VotingOutcome` nasceu de um bug de campo (IMP-13, IMP-39): a regra estava
 * certa (empate não elimina), o que faltava era DIZER isso — com nomes e
 * contagem, não só "houve empate". Testa comportamento (o que aparece na
 * tela), nunca snapshot.
 */

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

function makeTally(overrides: Partial<VoteTally> = {}): VoteTally {
  return {
    cycle: 0,
    skip: 0,
    top: 0,
    players: {},
    ...overrides,
  }
}

describe('VotingOutcome', () => {
  it('devolve nada na rodada 1: não existiu votação anterior para explicar', () => {
    const players = [makePlayer({ id: 'ana', name: 'Ana' })]
    const tally = makeTally({ top: 2, players: { ana: 2 } })

    const { toJSON } = render(<VotingOutcome tally={tally} players={players} round={1} />)

    expect(toJSON()).toBeNull()
  })

  it('devolve nada sem apuração (`tally` nulo), mesmo em rodada avançada', () => {
    const players = [makePlayer({ id: 'ana', name: 'Ana' })]

    const { toJSON } = render(<VotingOutcome tally={null} players={players} round={3} />)

    expect(toJSON()).toBeNull()
  })

  it('empate: mostra os NOMES e a contagem de cada um, não só "houve empate"', () => {
    const players = [
      makePlayer({ id: 'ana', name: 'Ana' }),
      makePlayer({ id: 'papai', name: 'Papai' }),
      makePlayer({ id: 'mae', name: 'Mãe' }),
    ]
    // Empate no topo entre Ana e Papai (2 votos cada); Mãe ficou de fora (1 voto).
    const tally = makeTally({ top: 2, players: { ana: 2, papai: 2, mae: 1 } })

    render(<VotingOutcome tally={tally} players={players} round={2} />)

    expect(screen.getByText('Ana 2  ·  Papai 2')).toBeTruthy()
    expect(screen.queryByText(/Mãe/)).toBeNull()
    expect(screen.getByText('Deu empate na votação')).toBeTruthy()
    expect(
      screen.getByText('Ninguém foi eliminado. Deem mais uma dica cada um e votem de novo.'),
    ).toBeTruthy()
  })

  it('"pular" venceu (skip >= top): mostra a contagem de votos para pular, com plural correto', () => {
    const players = [makePlayer({ id: 'ana', name: 'Ana' })]
    const tally = makeTally({ skip: 3, top: 1, players: { ana: 1 } })

    render(<VotingOutcome tally={tally} players={players} round={2} />)

    expect(screen.getByText('3 votos para pular.')).toBeTruthy()
    expect(screen.getByText('A mesa preferiu pular')).toBeTruthy()
  })

  it('"pular" venceu com um único voto: concorda no singular ("1 voto", não "1 votos")', () => {
    const players = [makePlayer({ id: 'ana', name: 'Ana' })]
    const tally = makeTally({ skip: 1, top: 0, players: {} })

    render(<VotingOutcome tally={tally} players={players} round={2} />)

    expect(screen.getByText('1 voto para pular.')).toBeTruthy()
  })

  it('`bare`: só o conteúdo, sem o título nem o rodapé da moldura — usado dentro do anúncio em tela cheia', () => {
    const players = [
      makePlayer({ id: 'ana', name: 'Ana' }),
      makePlayer({ id: 'papai', name: 'Papai' }),
    ]
    const tally = makeTally({ top: 2, players: { ana: 2, papai: 2 } })

    render(<VotingOutcome tally={tally} players={players} round={2} bare />)

    expect(screen.getByText('Ana 2  ·  Papai 2')).toBeTruthy()
    expect(screen.getByText('Deem mais uma dica cada um e votem de novo.')).toBeTruthy()

    // A moldura (título com o ícone, rodapé "Ninguém foi eliminado…") é do
    // anúncio em tela cheia que já envolve este componente — `bare` não repete.
    expect(screen.queryByText('Deu empate na votação')).toBeNull()
    expect(
      screen.queryByText('Ninguém foi eliminado. Deem mais uma dica cada um e votem de novo.'),
    ).toBeNull()
  })
})
