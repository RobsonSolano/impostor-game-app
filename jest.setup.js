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

/**
 * `expo-updates` e `expo-in-app-updates` são módulos NATIVOS: o require deles
 * quebra no Jest, que não tem TurboModule. Mockados aqui, e não em cada teste,
 * porque quem os importa é a `HomeScreen` — qualquer teste que a monte tropeça.
 *
 * `isEnabled: false` é o estado honesto no ambiente de teste (e em dev): é assim
 * que `useAppUpdate` fica inerte, que é o comportamento correto fora de um build
 * de verdade. Teste que queira o caminho ativo sobrescreve localmente.
 */
jest.mock('expo-updates', () => ({
  isEnabled: false,
  checkForUpdateAsync: jest.fn(() => Promise.resolve({ isAvailable: false })),
  fetchUpdateAsync: jest.fn(() => Promise.resolve({ isNew: false })),
  reloadAsync: jest.fn(() => Promise.resolve()),
}))

jest.mock('expo-in-app-updates', () => ({
  AppUpdateType: { FLEXIBLE: 0, IMMEDIATE: 1 },
  checkForUpdate: jest.fn(() =>
    Promise.resolve({ updateAvailable: false, storeVersion: '1.0.0' }),
  ),
  startUpdate: jest.fn(() => Promise.resolve(true)),
  checkAndStartUpdate: jest.fn(() => Promise.resolve(false)),
  addUpdateListener: jest.fn(() => () => {}),
}))

/**
 * SDK do AdMob: nativo, não existe no Jest. Mockado com `loaded: false` — o
 * estado honesto em teste, e o caminho que prova que a navegação NÃO depende do
 * anúncio.
 */
jest.mock('react-native-google-mobile-ads', () => ({
  MobileAds: () => ({ initialize: jest.fn(() => Promise.resolve()) }),
  AdEventType: { LOADED: 'loaded', CLOSED: 'closed', ERROR: 'error' },
  TestIds: { INTERSTITIAL: 'test-interstitial' },
  InterstitialAd: {
    createForAdRequest: jest.fn(() => ({
      addAdEventListener: jest.fn(() => () => {}),
      load: jest.fn(),
      show: jest.fn(() => Promise.resolve()),
      loaded: false,
    })),
  },
  AdsConsent: { gatherConsent: jest.fn(() => Promise.resolve()) },
}))
