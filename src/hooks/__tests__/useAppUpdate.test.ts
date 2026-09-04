import { act, renderHook, waitFor } from '@testing-library/react-native'
import { Linking } from 'react-native'
import * as Updates from 'expo-updates'
import * as InAppUpdates from 'expo-in-app-updates'

/**
 * O que vale provar aqui é a REGRA, não a chamada: quando as duas atualizações
 * existem, a nativa é a única que resolve (o runtime antigo parou de receber
 * OTA), então ela tem que ganhar. E nada disso pode explodir para fora do hook:
 * atualização é conveniência, e uma falha de rede aqui não pode atrapalhar quem
 * só quer jogar.
 *
 * `expo-updates` é mockado globalmente com `isEnabled: false` (ver
 * `jest.setup.js`), que é o estado honesto em teste. Aqui ele é ligado, porque o
 * hook fica inerte de propósito quando desligado — e um teste contra o hook
 * inerte não provaria nada. `__DEV__` também é desligado: ele é sempre
 * verdadeiro no Jest, e a porta do hook exige os dois.
 */
;(globalThis as unknown as { __DEV__: boolean }).__DEV__ = false

jest.mock('expo-updates', () => ({
  isEnabled: true,
  checkForUpdateAsync: jest.fn(),
  fetchUpdateAsync: jest.fn(),
  reloadAsync: jest.fn(),
}))

 
const { useAppUpdate } = require('@/hooks/useAppUpdate') as typeof import('@/hooks/useAppUpdate')

const mockLoja = jest.mocked(InAppUpdates.checkForUpdate)
const mockStart = jest.mocked(InAppUpdates.startUpdate)
const mockCheckOta = jest.mocked(Updates.checkForUpdateAsync)
const mockFetchOta = jest.mocked(Updates.fetchUpdateAsync)

beforeEach(() => {
  jest.clearAllMocks()
  mockLoja.mockResolvedValue({ updateAvailable: false, storeVersion: '1.0.0' })
  mockCheckOta.mockResolvedValue({ isAvailable: false } as Awaited<
    ReturnType<typeof Updates.checkForUpdateAsync>
  >)
})

describe('useAppUpdate', () => {
  it('não avisa nada quando não há atualização de nenhum tipo', async () => {
    const { result } = renderHook(() => useAppUpdate())
    await waitFor(() => expect(mockCheckOta).toHaveBeenCalled())
    expect(result.current.update).toEqual({ kind: 'none' })
  })

  it('a atualização NATIVA vence a OTA quando as duas existem', async () => {
    mockLoja.mockResolvedValue({ updateAvailable: true, storeVersion: '1.1.0' })
    mockCheckOta.mockResolvedValue({ isAvailable: true } as Awaited<
      ReturnType<typeof Updates.checkForUpdateAsync>
    >)

    const { result } = renderHook(() => useAppUpdate())

    await waitFor(() =>
      expect(result.current.update).toEqual({ kind: 'native', storeVersion: '1.1.0' }),
    )
    // E nem chega a baixar OTA: aquele runtime não recebe mais nada de novo.
    expect(mockFetchOta).not.toHaveBeenCalled()
  })

  it('avisa OTA só depois de ela estar BAIXADA, não quando é anunciada', async () => {
    mockCheckOta.mockResolvedValue({ isAvailable: true } as Awaited<
      ReturnType<typeof Updates.checkForUpdateAsync>
    >)
    let concluirDownload: (() => void) | undefined
    mockFetchOta.mockReturnValue(
      new Promise((resolve) => {
        concluirDownload = () => resolve({ isNew: true } as Awaited<
          ReturnType<typeof Updates.fetchUpdateAsync>
        >)
      }),
    )

    const { result } = renderHook(() => useAppUpdate())

    await waitFor(() => expect(mockFetchOta).toHaveBeenCalled())
    // Baixando: o jogador ainda não é avisado — o aviso não pode virar "espere aí".
    expect(result.current.update).toEqual({ kind: 'none' })

    await act(async () => {
      concluirDownload?.()
    })
    await waitFor(() => expect(result.current.update).toEqual({ kind: 'ota' }))
  })

  it('engole falha da loja e segue para OTA, em vez de propagar', async () => {
    mockLoja.mockRejectedValue(new Error('sem Play Services'))
    mockCheckOta.mockResolvedValue({ isAvailable: true } as Awaited<
      ReturnType<typeof Updates.checkForUpdateAsync>
    >)
    mockFetchOta.mockResolvedValue({ isNew: true } as Awaited<
      ReturnType<typeof Updates.fetchUpdateAsync>
    >)

    const { result } = renderHook(() => useAppUpdate())

    await waitFor(() => expect(result.current.update).toEqual({ kind: 'ota' }))
  })

  it('engole falha do servidor de OTA sem derrubar nada', async () => {
    mockCheckOta.mockRejectedValue(new Error('offline'))

    const { result } = renderHook(() => useAppUpdate())

    await waitFor(() => expect(mockCheckOta).toHaveBeenCalled())
    expect(result.current.update).toEqual({ kind: 'none' })
  })

  it('cai para a loja quando o fluxo da Play não abre', async () => {
    mockLoja.mockResolvedValue({ updateAvailable: true, storeVersion: '1.1.0' })
    mockStart.mockResolvedValue(false)
    const canOpen = jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true)
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)

    const { result } = renderHook(() => useAppUpdate())
    await waitFor(() => expect(result.current.update.kind).toBe('native'))

    await act(async () => {
      await result.current.aplicarNativa()
    })

    expect(openURL).toHaveBeenCalledWith(expect.stringContaining('market://details?id='))
    canOpen.mockRestore()
    openURL.mockRestore()
  })

  it('dispensar esconde o aviso na sessão', async () => {
    mockLoja.mockResolvedValue({ updateAvailable: true, storeVersion: '1.1.0' })

    const { result } = renderHook(() => useAppUpdate())
    await waitFor(() => expect(result.current.update.kind).toBe('native'))

    act(() => {
      result.current.dispensar()
    })

    expect(result.current.update).toEqual({ kind: 'none' })
  })
})
