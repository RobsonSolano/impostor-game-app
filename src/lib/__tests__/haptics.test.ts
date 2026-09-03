import * as Haptics from 'expo-haptics'
import { haptics } from '@/lib/haptics'

/**
 * O que importa provar aqui não é "chamou a função certa" — é que NADA em
 * haptics.ts consegue derrubar uma ação de jogo. Vibração é enfeite: aparelho sem
 * motor rejeita a promise, e uma rejeição escapando daqui abortaria o voto.
 */
describe('haptics', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('traduz intenção em primitiva do expo-haptics', () => {
    haptics.press()
    expect(Haptics.impactAsync).toHaveBeenCalledWith('medium')

    haptics.success()
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('success')

    haptics.select()
    expect(Haptics.selectionAsync).toHaveBeenCalled()
  })

  it('engole a rejeição do aparelho sem motor em vez de propagar', async () => {
    jest.mocked(Haptics.impactAsync).mockRejectedValueOnce(new Error('sem motor'))

    // Se a rejeição escapasse, isto viraria unhandled rejection e o processo
    // registraria falha — que num componente seria a ação de jogo abortada.
    expect(() => haptics.press()).not.toThrow()
    await Promise.resolve()
  })

  it('não prende quem chamou durante a sequência de suspense', () => {
    haptics.suspense()

    // O primeiro pulso sai na hora; os outros dois ficam em setTimeout, então
    // quem chamou já seguiu adiante.
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1)

    jest.advanceTimersByTime(400)
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(3)
  })
})
