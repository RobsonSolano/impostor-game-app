# Stack

Checado em 2026-09-03, lendo `package.json` diretamente. **Este arquivo é um retrato, não uma garantia**: o código está sendo editado por múltiplos agentes em paralelo nesta mesma data. Confira `package.json` antes de citar uma versão daqui.

## Runtime

| Item | Versão | Nota |
|---|---|---|
| Node.js | 20.20.2 (local) | `AGENTS.md`/README pedem Node 20+ |
| Expo SDK | 57 | Fixado em `app.config.ts` implicitamente pelas versões `~57.x` de cada pacote `expo-*` |

## Aplicação — 22 dependências diretas

| Pacote | Versão | Papel |
|---|---|---|
| `expo` | ~57.0.19 | Runtime e CLI do Expo |
| `expo-router` | ~57.0.18 | Rotas por arquivo (`app/`), `typedRoutes` ligado em `app.config.ts` |
| `react` / `react-dom` | 19.2.3 | `react-dom` só entra pela dependência de peer do Expo web; o app roda em iOS/Android |
| `react-native` | 0.86.3 | New Architecture é a única no SDK 57 — não existe mais flag `newArchEnabled` |
| `react-native-reanimated` | 4.5.1 | Toda animação do app (spring, `useAnimatedStyle`, `entering`/`layout`) |
| `react-native-worklets` | 0.10.1 | Dependência própria do Reanimated 4 (deixou de vir embutido) — o resolver dele é o que faz o Jest não travar em módulo nativo (ver `TESTING.md`) |
| `react-native-gesture-handler` | ~2.32.0 | `GestureHandlerRootView` no `_layout`; `HoldToReveal` usa `Pressable` (RN puro), não Gesture Handler diretamente — ver comentário no próprio componente |
| `react-native-svg` | 15.15.4 | Anel do `Countdown`, halo da `HomeScreen`, arco do `Spinner` |
| `react-native-safe-area-context` | ~5.7.0 | `useSafeAreaInsets()` em toda tela — nunca `Dimensions.get('window')` (regra 11 do AGENTS.md) |
| `react-native-screens` | ~4.26.0 | Peer do expo-router/React Navigation por baixo |
| `expo-linear-gradient` | ~57.0.1 | Gradiente de fundo do shell, lavada diagonal dos `Card`, degradê acima da ação fixa |
| `expo-haptics` | ~57.0.2 | Motor de vibração por trás de `src/lib/haptics.ts` |
| `expo-clipboard` | ~57.0.1 | Plano B de "compartilhar código da sala" quando a folha nativa de compartilhamento falha |
| `expo-linking` | ~57.0.9 | Suporte de deep link do expo-router (`scheme: 'impostor'`) |
| `expo-splash-screen` | ~57.0.8 | Splash controlada manualmente (`preventAutoHideAsync`/`hideAsync` no `_layout`) |
| `expo-status-bar` | ~57.0.1 | Barra de status sempre `style="light"` — o app é sempre escuro |
| `expo-constants` | ~57.0.17 | Lê `expoConfig.extra` (credenciais do Supabase) em runtime |
| `lucide-react-native` | ^1.40.0 | Ícones — mesma família do `lucide-react` usada no web |
| `@supabase/supabase-js` | ^2.109.0 | Cliente de dados, Realtime e auth anônima |
| `react-native-url-polyfill` | ^4.0.0 | `import 'react-native-url-polyfill/auto'` como primeira linha do app — sem ele, `URL`/`URLSearchParams` do Hermes não cobrem o que o `supabase-js` precisa, e o primeiro `signInAnonymously()` falha (ver README, "Três armadilhas") |
| `@react-native-async-storage/async-storage` | 2.2.0 | Storage de sessão do GoTrue — sem ele o app não tem `localStorage` e perderia a sessão anônima a cada abertura |

## Testes e dev — 9 devDependencies

| Pacote | Papel |
|---|---|
| `jest` ^29.7.0 | Test runner |
| `jest-expo` ^57.0.5 | Preset do Expo para Jest — mocks de módulo nativo e transform de TS/JSX |
| `@testing-library/react-native` ^13.3.3 | Testes de comportamento de componente (`render`, `fireEvent`) |
| `react-test-renderer` ^19.2.3 | Peer do Testing Library, pareado à versão do React |
| `@types/jest`, `@types/react` | Tipos |
| `typescript` ~6.0.3 | `strict` + `noUncheckedIndexedAccess` em `tsconfig.json` |
| `eslint` ^9.0.0, `eslint-config-expo` ~57.0.2 | Lint (`npm run lint` → `expo lint`) |

## Infra

- **Banco + Realtime + Auth:** Supabase gerenciado — o **mesmo projeto** do `impostor` web (compartilhado, não duplicado). Este repositório não tem `supabase/` de propósito: ver `.specs/project/STATE.md` e `../impostor` para migrations e schema.
- **Build/distribuição:** EAS (Expo Application Services). `app.config.ts` já tem `eas.projectId` fixo e `owner` definido; nenhum build EAS foi gerado até 2026-09-03 (ver `.specs/project/STATE.md`).
- **CLI:** `npx expo start`, `npx expo-doctor`. Não há CLI do Supabase neste repositório (fica no web, que é quem aplica migration).

## Diferenças de stack em relação ao web

| Web | Mobile | Por quê |
|---|---|---|
| Next.js 16 (App Router) | expo-router 57 (rotas por arquivo) | Equivalente RN do App Router |
| Tailwind 4 + shadcn/ui | StyleSheet + `src/theme/` (tokens próprios) | NativeWind não tem pin de versão de RN e a identidade depende de glow/gradiente/spring nativos — ver `.specs/project/STATE.md` |
| Motion (Framer Motion) | Reanimated 4 + Gesture Handler | Motion não roda em React Native |
| Vitest + Testing Library + jsdom | Jest (`jest-expo`) + Testing Library (React Native) | jsdom não simula módulo nativo; `jest-expo` traz os mocks certos |
| pgTAP (`supabase test db`) | — (não existe aqui) | As regras do jogo são testadas no banco, que é do web — ver `.specs/codebase/TESTING.md` |
