import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { ClueDialog } from '@/components/game/ClueDialog'
import { haptics } from '@/lib/haptics'

/**
 * Testa só a lógica do `ClueDialog` (validação de formato, o que acontece com
 * a resposta de `submitClue`, o botão de dispensar) — não a aparência real de
 * `Button`/`Input`/`Sheet`, que são peças de outros agentes com testes
 * próprios.
 *
 * `submitClue` é a única dependência externa de verdade: o resto (validação de
 * formato, contador) é código nosso e roda de verdade no teste. A variável do
 * mock precisa começar com `mock` (convenção exigida pelo `babel-plugin-jest-
 * hoist` para poder ser referenciada de dentro do factory de `jest.mock`).
 */
const mockSubmitClue = jest.fn<Promise<{ ok: boolean; reason?: 'PROFANITY'; strikes?: number }>, [string, string]>()
jest.mock('@/lib/game/actions', () => ({
  submitClue: (roomId: string, word: string) => mockSubmitClue(roomId, word),
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
      <RN.Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label}>
        <RN.Text>{label}</RN.Text>
      </RN.Pressable>
    ),
  }
})

jest.mock('@/components/ui/Input', () => {
  const RN = require('react-native')
  return {
    Input: ({
      value,
      onChangeText,
      placeholder,
      invalid,
    }: {
      value: string
      onChangeText: (text: string) => void
      placeholder?: string
      invalid?: boolean
    }) => (
      <RN.TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        accessibilityState={{ invalid }}
      />
    ),
  }
})

// O `Sheet` real é o modal de verdade (Reanimated + Modal nativo); aqui só
// interessa que `title`/`description`/`children` cheguem à tela quando `open`.
jest.mock('@/components/ui/Sheet', () => {
  const RN = require('react-native')
  return {
    Sheet: ({
      open,
      children,
      title,
      description,
    }: {
      open: boolean
      children: ReactNode
      title?: ReactNode
      description?: ReactNode
    }) =>
      open ? (
        <RN.View>
          {title}
          {description}
          {children}
        </RN.View>
      ) : null,
  }
})

jest.mock('@/components/shared/Countdown', () => {
  const RN = require('react-native')
  return { Countdown: () => <RN.Text>contagem</RN.Text> }
})

function renderDialog(overrides: Partial<Parameters<typeof ClueDialog>[0]> = {}) {
  const onExpire = jest.fn()
  const onDismiss = jest.fn()

  render(
    <ClueDialog
      roomId="sala-1"
      deadline={new Date(Date.now() + 20_000).toISOString()}
      totalMs={20_000}
      onExpire={onExpire}
      onDismiss={onDismiss}
      open
      {...overrides}
    />,
  )

  return { onExpire, onDismiss }
}

const input = () => screen.getByPlaceholderText('ex.: tromba')
const pronto = () => screen.getByRole('button', { name: /pronto/i })

beforeEach(() => {
  mockSubmitClue.mockReset()
  jest.clearAllMocks()
})

describe('ClueDialog — o que o jogador lê e envia (IMP-31 a IMP-34)', () => {
  it('mostra o aviso de não entregar a palavra secreta', () => {
    renderDialog()
    expect(screen.getByText(/não entregar a palavra secreta/i)).toBeTruthy()
  })

  it('não deixa enviar com o campo vazio', () => {
    renderDialog()
    expect(pronto().props.accessibilityState?.disabled).toBe(true)
  })

  it('bloqueia e explica quando são duas palavras', () => {
    renderDialog()
    fireEvent.changeText(input(), 'dois termos')

    expect(pronto().props.accessibilityState?.disabled).toBe(true)
    expect(screen.getByText(/sem espaços/i)).toBeTruthy()
    expect(mockSubmitClue).not.toHaveBeenCalled()
  })

  it('aponta o problema específico de cada entrada inválida', () => {
    renderDialog()

    fireEvent.changeText(input(), 'x1')
    expect(screen.getByText(/sem números/i)).toBeTruthy()

    fireEvent.changeText(input(), '-abc')
    expect(screen.getByText(/hífen/i)).toBeTruthy()

    fireEvent.changeText(input(), 'a')
    expect(screen.getByText(/2 letras/i)).toBeTruthy()
  })

  it('libera o envio com uma palavra válida, inclusive com hífen, e vibra sucesso', async () => {
    mockSubmitClue.mockResolvedValue({ ok: true })
    renderDialog()

    fireEvent.changeText(input(), 'guarda-chuva')
    expect(pronto().props.accessibilityState?.disabled).toBe(false)

    fireEvent.press(pronto())
    await waitFor(() => expect(mockSubmitClue).toHaveBeenCalledWith('sala-1', 'guarda-chuva'))
    expect(haptics.success).toHaveBeenCalledTimes(1)
    expect(haptics.error).not.toHaveBeenCalled()
  })

  it('apara espaço das pontas antes de enviar', async () => {
    mockSubmitClue.mockResolvedValue({ ok: true })
    renderDialog()

    fireEvent.changeText(input(), '  areia  ')
    fireEvent.press(pronto())

    await waitFor(() => expect(mockSubmitClue).toHaveBeenCalledWith('sala-1', 'areia'))
  })

  it('palavra vulgar mostra o aviso de falta, vibra aviso (não erro) e NÃO é tratada como erro técnico', async () => {
    mockSubmitClue.mockResolvedValue({ ok: false, reason: 'PROFANITY', strikes: 1 })
    renderDialog()

    fireEvent.changeText(input(), 'palavrao')
    fireEvent.press(pronto())

    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent(/proibido utilizar palavras vulgares/i)
    expect(alerta).toHaveTextContent(/será expulso da sala/i)
    expect(alerta).toHaveTextContent(/primeira ocorrência/i)
    // `warn`, não `error`: pelo vocabulário de `lib/haptics.ts`, isto é "aviso
    // sem falha" — o turno não acabou, a pessoa ainda pode digitar outra
    // palavra e cumprir o prazo.
    expect(haptics.warn).toHaveBeenCalledTimes(1)
    expect(haptics.error).not.toHaveBeenCalled()

    // Não é uma falha técnica: nenhuma mensagem de erro genérica aparece, e a
    // resposta (`ok: false`) não passou pelo `catch`.
    expect(screen.queryByText('Algo deu errado. Tente de novo.')).toBeNull()
  })

  it('avisa que a próxima falta expulsa, na segunda ocorrência', async () => {
    mockSubmitClue.mockResolvedValue({ ok: false, reason: 'PROFANITY', strikes: 2 })
    renderDialog()

    fireEvent.changeText(input(), 'palavrao')
    fireEvent.press(pronto())

    expect(await screen.findByText(/na próxima você é expulso/i)).toBeTruthy()
  })

  it('limpa o campo depois da recusa, sem fechar o popup — o turno continua', async () => {
    mockSubmitClue.mockResolvedValue({ ok: false, reason: 'PROFANITY', strikes: 1 })
    renderDialog()

    fireEvent.changeText(input(), 'palavrao')
    fireEvent.press(pronto())

    await screen.findByRole('alert')
    expect(input().props.value).toBe('')
  })

  it('oferece consultar a mesa sem desistir do turno: fechar chama onDismiss, nada mais', () => {
    const { onDismiss } = renderDialog()

    fireEvent.press(screen.getByRole('button', { name: /ver as dicas da mesa/i }))

    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(mockSubmitClue).not.toHaveBeenCalled()
  })
})
