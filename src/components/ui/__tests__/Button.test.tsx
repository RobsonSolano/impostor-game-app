import { fireEvent, render } from '@testing-library/react-native'
import * as Haptics from 'expo-haptics'
import { Button } from '@/components/ui/Button'

/**
 * O que importa aqui não é o visual (escala, glow) — é o contrato de
 * interação: toque dispara `onPress`, `disabled`/`busy` bloqueiam, e a
 * vibração acontece exatamente quando o contrato promete.
 */
describe('Button', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('dispara onPress ao tocar', () => {
    const onPress = jest.fn()
    const { getByRole } = render(<Button label="Entrar na sala" onPress={onPress} />)

    fireEvent.press(getByRole('button'))

    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('não dispara onPress quando disabled', () => {
    const onPress = jest.fn()
    const { getByRole } = render(
      <Button label="Entrar na sala" onPress={onPress} disabled />,
    )

    fireEvent.press(getByRole('button'))

    expect(onPress).not.toHaveBeenCalled()
  })

  it('não dispara onPress quando busy', () => {
    const onPress = jest.fn()
    const { getByRole } = render(<Button label="Entrar na sala" onPress={onPress} busy />)

    fireEvent.press(getByRole('button'))

    expect(onPress).not.toHaveBeenCalled()
  })

  it('vibra ao tocar com o haptic padrão ("press")', () => {
    const onPress = jest.fn()
    const { getByRole } = render(<Button label="Entrar na sala" onPress={onPress} />)

    fireEvent.press(getByRole('button'))

    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium)
  })

  it('respeita haptic={false}: dispara onPress sem vibrar', () => {
    const onPress = jest.fn()
    const { getByRole } = render(
      <Button label="Entrar na sala" onPress={onPress} haptic={false} />,
    )

    fireEvent.press(getByRole('button'))

    expect(onPress).toHaveBeenCalledTimes(1)
    expect(Haptics.impactAsync).not.toHaveBeenCalled()
    expect(Haptics.selectionAsync).not.toHaveBeenCalled()
    expect(Haptics.notificationAsync).not.toHaveBeenCalled()
  })
})
