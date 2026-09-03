import { renderHook, waitFor } from '@testing-library/react-native'
import { useAnonSession } from '@/hooks/useGameAccess'

/**
 * Só `useAnonSession` é coberto aqui.
 *
 * `useRoomIdFromCode` e os hooks de Realtime (`useRoomChannel`, `useRoundClues`)
 * não entram: testar um canal do Supabase mockado só provaria que o mock
 * responde como o mock foi programado para responder — nada sobre o
 * comportamento real do app. `useAnonSession` é diferente: a lógica que importa
 * (traduzir sucesso/erro de `ensureAnonSession` em estado) não depende do
 * Realtime, só de uma Promise, e essa Promise mockada é o bastante.
 */

// Prefixo `mock` é exigido pelo babel-plugin-jest-hoist: o `jest.mock` abaixo é
// IÇADO para antes dos imports, e só variáveis `mock*` escapam dessa regra de
// escopo — sem o prefixo, a referência dentro do factory quebraria em runtime.
const mockEnsureAnonSession = jest.fn()

jest.mock('@/lib/supabase/client', () => ({
  ensureAnonSession: (...args: unknown[]) => mockEnsureAnonSession(...args),
  getSupabaseClient: jest.fn(),
}))

describe('useAnonSession', () => {
  beforeEach(() => {
    mockEnsureAnonSession.mockReset()
  })

  it('expõe o uid da sessão anônima quando ensureAnonSession resolve', async () => {
    mockEnsureAnonSession.mockResolvedValue({ user: { id: 'uid-123' } })

    const { result } = renderHook(() => useAnonSession())

    await waitFor(() => expect(result.current.ready).toBe(true))

    expect(result.current.userId).toBe('uid-123')
    expect(result.current.error).toBeNull()
  })

  it('traduz falha da sessão anônima em mensagem exibível', async () => {
    mockEnsureAnonSession.mockRejectedValue(new Error('Anonymous sign-ins are disabled'))

    const { result } = renderHook(() => useAnonSession())

    await waitFor(() => expect(result.current.ready).toBe(true))

    expect(result.current.userId).toBeNull()
    expect(result.current.error).toBe('Anonymous sign-ins are disabled')
  })

  it('não quebra quando a sessão vem nula', async () => {
    mockEnsureAnonSession.mockResolvedValue(null)

    const { result } = renderHook(() => useAnonSession())

    await waitFor(() => expect(result.current.ready).toBe(true))

    expect(result.current.userId).toBeNull()
    expect(result.current.error).toBeNull()
  })
})
