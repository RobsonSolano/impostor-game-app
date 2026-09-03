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
 */

const mockCreateRoom = jest.fn()
const mockJoinRoom = jest.fn()

jest.mock('@/lib/game/actions', () => ({
  createRoom: (...args: unknown[]) => mockCreateRoom(...args),
  joinRoom: (...args: unknown[]) => mockJoinRoom(...args),
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

  it('cria a sala com o nome normalizado', async () => {
    mockCreateRoom.mockResolvedValue({ room_id: 'r1', player_id: 'p1', code: 'ABCD' })

    const { getByRole, getByPlaceholderText } = renderHomeScreen()

    typeName(getByPlaceholderText, '  Ana   ')
    fireEvent.press(getByRole('button', { name: 'Criar sala' }))

    await waitFor(() => expect(mockCreateRoom).toHaveBeenCalledWith('Ana'))
    expect(mockJoinRoom).not.toHaveBeenCalled()
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/sala/ABCD'))
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
})
