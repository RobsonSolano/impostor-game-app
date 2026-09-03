/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * Mocks globais dos testes.
 *
 * `expo-haptics` é mockado porque não existe motor de vibração no ambiente de
 * teste e as chamadas rejeitariam — o que não é falha nenhuma, mas polui a saída
 * com "unhandled rejection". Mockar aqui também deixa os testes ASSERTAREM
 * vibração: `expect(Haptics.impactAsync).toHaveBeenCalled()`.
 */
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
    Rigid: 'rigid',
    Soft: 'soft',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
}))

// O AsyncStorage nativo não existe no ambiente de teste; o mock oficial guarda em
// memória, que é o suficiente para a sessão anônima.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)

// `expo-constants` entrega a config do app; nos testes só as credenciais importam.
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        supabaseUrl: 'https://test.supabase.co',
        supabaseAnonKey: 'test-anon-key',
      },
    },
  },
}))

/**
 * `react-native-reanimated` (via `react-native-worklets`) resolve para o
 * arquivo `.native.ts` da lib em teste — o mesmo que o app real usa — e esse
 * arquivo tenta instalar o Turbo Module nativo dos worklets na hora do
 * `require`. Não existe esse nativo no Jest, e a chamada quebra o import de
 * QUALQUER componente que use Reanimated (Button, Card, Sheet, Spinner, o
 * `Countdown`/`Confetti` do agente `shared` etc.) antes mesmo do teste rodar.
 * O mock oficial da própria lib troca hooks e `with*` por versões síncronas em
 * JS puro — é o caminho documentado pelo projeto Reanimated para testes.
 */
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'))
