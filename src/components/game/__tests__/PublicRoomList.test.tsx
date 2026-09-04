import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import * as Haptics from 'expo-haptics'
import { PublicRoomList } from '@/components/game/PublicRoomList'
import { listPublicRooms } from '@/lib/game/actions'
import type { PublicRoom } from '@/lib/types'

/**
 * O que importa provar (contrato em `.specs/CONTRACTS.md`, tarefa IMP-40):
 * a lista mostra o que a RPC devolve, sala cheia nunca chama `onJoin` (o
 * banco já recusaria com IM005 — aqui é só para não gastar a chamada à toa),
 * falta de nome vira `onMissingName` em vez de uma tentativa de entrada, e as
 * duas mensagens de lista vazia (sem busca / com busca sem resultado) são
 * textos DIFERENTES — cada uma some por um motivo diferente.
 */

jest.mock('@/lib/game/actions', () => ({
  listPublicRooms: jest.fn(),
}))

const mockListPublicRooms = listPublicRooms as jest.MockedFunction<typeof listPublicRooms>

function makePublicRoom(overrides: Partial<PublicRoom> = {}): PublicRoom {
  return {
    code: 'AB12',
    title: 'Mesa dos amigos',
    host_name: 'Ana',
    players: 4,
    created_at: '2026-09-03T12:00:00.000Z',
    ...overrides,
  }
}

describe('PublicRoomList', () => {
  beforeEach(() => {
    mockListPublicRooms.mockReset()
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('mostra as salas que a RPC devolve, com host e contagem no formato N/12', async () => {
    mockListPublicRooms.mockResolvedValue([
      makePublicRoom({ code: 'AB12', title: 'Mesa dos amigos', host_name: 'Ana', players: 4 }),
      makePublicRoom({ code: 'ZX99', title: null, host_name: 'Bia', players: 1 }),
    ])

    const { findByText } = render(
      <PublicRoomList playerName="Ana" onJoin={jest.fn()} onMissingName={jest.fn()} />,
    )

    expect(await findByText('Mesa dos amigos')).toBeTruthy()
    expect(await findByText('4/12')).toBeTruthy()

    // Sem título, o nome da sala cai para "Sala de {host}".
    expect(await findByText('Sala de Bia')).toBeTruthy()
    expect(await findByText('1/12')).toBeTruthy()
  })

  it('sala cheia (12/12) aparece desabilitada, com o motivo visível, e não dispara onJoin', async () => {
    mockListPublicRooms.mockResolvedValue([
      makePublicRoom({ code: 'FULL', title: 'Sala lotada', host_name: 'Cau', players: 12 }),
    ])
    const onJoin = jest.fn()

    const { findByText, getByRole } = render(
      <PublicRoomList playerName="Ana" onJoin={onJoin} onMissingName={jest.fn()} />,
    )

    expect(await findByText('Sala lotada')).toBeTruthy()
    expect(await findByText(/Sala cheia/)).toBeTruthy()

    fireEvent.press(getByRole('button', { name: /Sala lotada/ }))

    expect(onJoin).not.toHaveBeenCalled()
  })

  it('sem nome preenchido, o toque chama onMissingName (com aviso de vibração) e nunca onJoin', async () => {
    mockListPublicRooms.mockResolvedValue([
      makePublicRoom({ code: 'AB12', title: 'Mesa dos amigos', players: 4 }),
    ])
    const onJoin = jest.fn()
    const onMissingName = jest.fn()

    const { findByText, getByRole } = render(
      <PublicRoomList playerName="" onJoin={onJoin} onMissingName={onMissingName} />,
    )

    expect(await findByText('Mesa dos amigos')).toBeTruthy()

    fireEvent.press(getByRole('button', { name: /Mesa dos amigos/ }))

    expect(onMissingName).toHaveBeenCalledTimes(1)
    expect(onJoin).not.toHaveBeenCalled()
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('warning')
  })

  it('toque numa sala válida com nome preenchido chama onJoin com o código', async () => {
    mockListPublicRooms.mockResolvedValue([
      makePublicRoom({ code: 'AB12', title: 'Mesa dos amigos', players: 4 }),
    ])
    const onJoin = jest.fn().mockResolvedValue(undefined)

    const { findByText, getByRole } = render(
      <PublicRoomList playerName="Ana" onJoin={onJoin} onMissingName={jest.fn()} />,
    )

    expect(await findByText('Mesa dos amigos')).toBeTruthy()

    fireEvent.press(getByRole('button', { name: /Mesa dos amigos/ }))

    await waitFor(() => expect(onJoin).toHaveBeenCalledWith('AB12'))
    expect(Haptics.impactAsync).toHaveBeenCalledWith('medium')
  })

  it('lista vazia sem busca explica que ninguém abriu sala agora (não parece erro)', async () => {
    mockListPublicRooms.mockResolvedValue([])

    const { findByText, queryByText } = render(
      <PublicRoomList playerName="Ana" onJoin={jest.fn()} onMissingName={jest.fn()} />,
    )

    expect(await findByText(/Ninguém abriu sala pública agora/)).toBeTruthy()
    expect(queryByText(/Nenhuma sala encontrada para essa busca/)).toBeNull()
  })

  it('lista vazia COM busca usa um texto diferente do vazio sem busca', async () => {
    jest.useFakeTimers()
    mockListPublicRooms.mockResolvedValue([])

    const { findByText, getByPlaceholderText } = render(
      <PublicRoomList playerName="Ana" onJoin={jest.fn()} onMissingName={jest.fn()} />,
    )

    // Estado vazio inicial (sem busca).
    expect(await findByText(/Ninguém abriu sala pública agora/)).toBeTruthy()

    fireEvent.changeText(getByPlaceholderText('Buscar sala ou host'), 'bar que não existe')

    // Ainda dentro da janela de debounce (350ms): a mensagem antiga continua.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(200)
    })

    await act(async () => {
      await jest.advanceTimersByTimeAsync(200)
    })

    expect(await findByText(/Nenhuma sala encontrada para essa busca/)).toBeTruthy()
  })

  it('espera o debounce antes de buscar — não dispara uma RPC por tecla digitada', async () => {
    jest.useFakeTimers()
    mockListPublicRooms.mockResolvedValue([])

    const { getByPlaceholderText } = render(
      <PublicRoomList playerName="Ana" onJoin={jest.fn()} onMissingName={jest.fn()} />,
    )

    // Deixa a busca inicial (montagem, sem termo) resolver antes de zerar a
    // contagem de chamadas — senão ela contaminaria a asserção do debounce.
    await act(async () => {
      await Promise.resolve()
    })
    mockListPublicRooms.mockClear()

    const input = getByPlaceholderText('Buscar sala ou host')
    fireEvent.changeText(input, 'b')
    fireEvent.changeText(input, 'ba')
    fireEvent.changeText(input, 'bar')

    // Cada tecla reinicia o temporizador: 200ms não é o bastante desde a
    // ÚLTIMA tecla para a busca disparar.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(200)
    })
    expect(mockListPublicRooms).not.toHaveBeenCalled()

    // Mais 200ms (400ms desde a última tecla, acima dos 350ms) — agora sim.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(200)
    })
    expect(mockListPublicRooms).toHaveBeenCalledTimes(1)
    expect(mockListPublicRooms).toHaveBeenCalledWith('bar')
  })

  it('mostra o erro traduzido por toDisplayError quando a RPC falha', async () => {
    mockListPublicRooms.mockRejectedValue({ code: 'IM003', message: 'Sala não encontrada.' })

    const { findByText } = render(
      <PublicRoomList playerName="Ana" onJoin={jest.fn()} onMissingName={jest.fn()} />,
    )

    expect(await findByText('Sala não encontrada.')).toBeTruthy()
  })
})
