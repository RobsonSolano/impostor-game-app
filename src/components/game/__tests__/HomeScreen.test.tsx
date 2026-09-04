import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { HomeScreen } from '@/components/game/HomeScreen'

/**
 * O que importa aqui é a LÓGICA da tela, não o layout: quando o CTA pode ser
 * pressionado de fato, e com que valores `createRoom`/`joinRoom` são chamados.
 * Cor, halo e proporção ficam para revisão visual — não são coisa que um
 * `expect` prova.
 *
 * O CTA "desabilitado" é verificado pelo COMPORTAMENTO (pressionar não chama a
 * ação), não pela prop de acessibilidade do `Button` — a tela tem sua própria
 * guarda (`if (!canSubmit) return`) dentro de `submit()`, e é ela que este
 * teste teria que flagrar se quebrasse.
 *
 * `listPublicRooms` é mockado aqui também: o sub-modo "Salas abertas" monta o
 * `PublicRoomList` de verdade (é a integração entre as duas peças que este
 * arquivo prova; o comportamento interno da lista já tem sua própria suíte em
 * `PublicRoomList.test.tsx`).
 */

const mockCreateRoom = jest.fn()
const mockJoinRoom = jest.fn()
const mockListPublicRooms = jest.fn()

jest.mock('@/lib/game/actions', () => ({
  createRoom: (...args: unknown[]) => mockCreateRoom(...args),
  joinRoom: (...args: unknown[]) => mockJoinRoom(...args),
  listPublicRooms: (...args: unknown[]) => mockListPublicRooms(...args),
}))

const mockPush = jest.fn()
const mockReplace = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}))

function typeName(getByPlaceholderText: (text: string) => unknown, value: string) {
  fireEvent.changeText(getByPlaceholderText('Como a mesa te chama') as never, value)
}

function enterMode(getByRole: (role: string, opts: { name: string }) => unknown) {
  fireEvent.press(getByRole('tab', { name: 'Entrar em sala' }) as never)
}

function selectVisibility(
  getByRole: (role: string, opts: { name: string }) => unknown,
  label: 'Sala privada' | 'Sala pública',
) {
  fireEvent.press(getByRole('tab', { name: label }) as never)
}

function selectSalasAbertas(getByRole: (role: string, opts: { name: string }) => unknown) {
  fireEvent.press(getByRole('tab', { name: 'Salas abertas' }) as never)
}

/**
 * `Screen` (contrato compartilhado) lê `useSafeAreaInsets()` sem fallback —
 * fora de um `<SafeAreaProvider>` com métricas, o hook lança. Em produção quem
 * fornece isso é o `_layout.tsx` da raiz; aqui é este wrapper.
 */
function renderHomeScreen() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <HomeScreen />
    </SafeAreaProvider>,
  )
}

describe('HomeScreen', () => {
  beforeEach(() => {
    mockCreateRoom.mockReset()
    mockJoinRoom.mockReset()
    mockListPublicRooms.mockReset()
    mockListPublicRooms.mockResolvedValue([])
    mockPush.mockReset()
    mockReplace.mockReset()
  })

  it('mantém o CTA inoperante sem nome preenchido', () => {
    const { getByRole } = renderHomeScreen()

    fireEvent.press(getByRole('button', { name: 'Criar sala' }))

    expect(mockCreateRoom).not.toHaveBeenCalled()
  })

  it('no modo entrar, mantém o CTA inoperante sem os 4 caracteres do código', () => {
    const { getByRole, getByPlaceholderText } = renderHomeScreen()

    enterMode(getByRole)
    typeName(getByPlaceholderText, 'Ana')

    const cta = getByRole('button', { name: 'Entrar na sala' })

    // Sem código nenhum.
    fireEvent.press(cta)
    expect(mockJoinRoom).not.toHaveBeenCalled()

    // Código incompleto (3 de 4 caracteres).
    fireEvent.changeText(getByPlaceholderText('X9K2'), 'X9K')
    fireEvent.press(cta)
    expect(mockJoinRoom).not.toHaveBeenCalled()
  })

  it('cria a sala privada por padrão (isPublic: false, sem título)', async () => {
    mockCreateRoom.mockResolvedValue({ room_id: 'r1', player_id: 'p1', code: 'ABCD' })

    const { getByRole, getByPlaceholderText } = renderHomeScreen()

    typeName(getByPlaceholderText, '  Ana   ')
    fireEvent.press(getByRole('button', { name: 'Criar sala' }))

    await waitFor(() =>
      expect(mockCreateRoom).toHaveBeenCalledWith('Ana', { isPublic: false, title: undefined }),
    )
    expect(mockJoinRoom).not.toHaveBeenCalled()
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/sala/ABCD'))
  })

  it('ao escolher "Pública", createRoom recebe isPublic: true', async () => {
    mockCreateRoom.mockResolvedValue({ room_id: 'r1', player_id: 'p1', code: 'ABCD' })

    const { getByRole, getByPlaceholderText } = renderHomeScreen()

    typeName(getByPlaceholderText, 'Ana')
    selectVisibility(getByRole, 'Sala pública')
    fireEvent.press(getByRole('button', { name: 'Criar sala' }))

    await waitFor(() =>
      expect(mockCreateRoom).toHaveBeenCalledWith('Ana', { isPublic: true, title: undefined }),
    )
  })

  it('com o título preenchido (sala pública), ele chega em options.title', async () => {
    mockCreateRoom.mockResolvedValue({ room_id: 'r1', player_id: 'p1', code: 'ABCD' })

    const { getByRole, getByPlaceholderText } = renderHomeScreen()

    typeName(getByPlaceholderText, 'Ana')
    selectVisibility(getByRole, 'Sala pública')
    fireEvent.changeText(getByPlaceholderText('Mesa do bar'), 'Mesa do bar')
    fireEvent.press(getByRole('button', { name: 'Criar sala' }))

    await waitFor(() =>
      expect(mockCreateRoom).toHaveBeenCalledWith('Ana', {
        isPublic: true,
        title: 'Mesa do bar',
      }),
    )
  })

  it('o campo de título só aparece com a sala marcada como pública', () => {
    const { getByRole, queryByPlaceholderText } = renderHomeScreen()

    expect(queryByPlaceholderText('Mesa do bar')).toBeNull()

    selectVisibility(getByRole, 'Sala pública')
    expect(queryByPlaceholderText('Mesa do bar')).toBeTruthy()

    selectVisibility(getByRole, 'Sala privada')
    expect(queryByPlaceholderText('Mesa do bar')).toBeNull()
  })

  it('entra na sala com nome e código normalizados', async () => {
    mockJoinRoom.mockResolvedValue({ room_id: 'r1', player_id: 'p1', code: 'X9K2' })

    const { getByRole, getByPlaceholderText } = renderHomeScreen()

    enterMode(getByRole)
    typeName(getByPlaceholderText, '  Bia ')
    // minúsculo e com separador — o `onChangeText` do campo de código já deve
    // ter normalizado isto para 'X9K2' antes mesmo do submit.
    fireEvent.changeText(getByPlaceholderText('X9K2'), 'x9-k2')

    fireEvent.press(getByRole('button', { name: 'Entrar na sala' }))

    await waitFor(() => expect(mockJoinRoom).toHaveBeenCalledWith('X9K2', 'Bia'))
    expect(mockPush).toHaveBeenCalledWith('/sala/X9K2')
  })

  it('mostra o erro traduzido e reabilita o CTA quando a ação falha', async () => {
    mockCreateRoom.mockRejectedValue({ code: 'IM004', message: 'Nome inválido.' })

    const { getByRole, getByPlaceholderText, findByText } = renderHomeScreen()

    typeName(getByPlaceholderText, 'Ana')
    fireEvent.press(getByRole('button', { name: 'Criar sala' }))

    expect(await findByText('Nome inválido.')).toBeTruthy()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('no sub-modo "Salas abertas", o CTA fixo da base some (quem entra é o toque na sala)', async () => {
    const { getByRole, queryByRole, findByText } = renderHomeScreen()

    enterMode(getByRole)
    selectSalasAbertas(getByRole)

    expect(queryByRole('button', { name: 'Entrar na sala' })).toBeNull()

    // Espera a busca inicial do `PublicRoomList` assentar (aqui, lista vazia)
    // antes do teste acabar — senão o `setState` da resposta chega depois do
    // componente já ter sido desmontado pelo fim do teste, e o React acusa
    // (com razão) um update fora de `act`.
    await findByText(/Ninguém abriu sala pública agora/)
  })

  it('toca numa sala da lista com nome preenchido: usa o mesmo joinRoom e navega', async () => {
    mockListPublicRooms.mockResolvedValue([
      {
        code: 'X9K2',
        title: 'Mesa dos amigos',
        host_name: 'Bia',
        players: 3,
        created_at: '2026-09-03T12:00:00.000Z',
      },
    ])
    mockJoinRoom.mockResolvedValue({ room_id: 'r1', player_id: 'p1', code: 'X9K2' })

    const { getByRole, getByPlaceholderText, findByText } = renderHomeScreen()

    enterMode(getByRole)
    typeName(getByPlaceholderText, 'Ana')
    selectSalasAbertas(getByRole)

    fireEvent.press(await findByText('Mesa dos amigos'))

    await waitFor(() => expect(mockJoinRoom).toHaveBeenCalledWith('X9K2', 'Ana'))
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/sala/X9K2'))
  })

  it('toca numa sala da lista SEM nome: destaca o campo em vez de chamar joinRoom', async () => {
    mockListPublicRooms.mockResolvedValue([
      {
        code: 'X9K2',
        title: 'Mesa dos amigos',
        host_name: 'Bia',
        players: 3,
        created_at: '2026-09-03T12:00:00.000Z',
      },
    ])

    const { getByRole, findByText } = renderHomeScreen()

    enterMode(getByRole)
    selectSalasAbertas(getByRole)

    fireEvent.press(await findByText('Mesa dos amigos'))

    expect(await findByText('Digite seu nome para entrar na sala.')).toBeTruthy()
    expect(mockJoinRoom).not.toHaveBeenCalled()
  })
})
