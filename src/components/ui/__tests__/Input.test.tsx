import { StyleSheet } from 'react-native'
import { fireEvent, render } from '@testing-library/react-native'
import { colors } from '@/theme/colors'
import { Input } from '@/components/ui/Input'

describe('Input', () => {
  it('repassa onChangeText ao digitar', () => {
    const onChangeText = jest.fn()
    const { getByPlaceholderText } = render(
      <Input value="" onChangeText={onChangeText} placeholder="Como a mesa te chama" />,
    )

    fireEvent.changeText(getByPlaceholderText('Como a mesa te chama'), 'Ana')

    expect(onChangeText).toHaveBeenCalledWith('Ana')
  })

  it('marca a borda de inválido quando invalid=true, e some quando volta a false', () => {
    const { getByPlaceholderText, rerender } = render(
      <Input placeholder="Código da sala" invalid={false} />,
    )

    const valid = StyleSheet.flatten(getByPlaceholderText('Código da sala').props.style)
    expect(valid.borderColor).not.toBe(colors.destructive)

    rerender(<Input placeholder="Código da sala" invalid />)

    const invalid = StyleSheet.flatten(getByPlaceholderText('Código da sala').props.style)
    expect(invalid.borderColor).toBe(colors.destructive)
  })

  it('sempre usa a cor de seleção e de placeholder da identidade, mesmo se algo tentar sobrescrever antes', () => {
    const { getByPlaceholderText } = render(
      <Input
        placeholder="Dica"
        // Passadas de propósito para provar que o componente as reafirma
        // depois — o padrão do RN pintaria as duas de azul de sistema.
        placeholderTextColor="blue"
        selectionColor="blue"
      />,
    )

    const field = getByPlaceholderText('Dica')
    expect(field.props.placeholderTextColor).toBe(colors.mutedForeground)
    expect(field.props.selectionColor).toBe(colors.primary)
  })
})
