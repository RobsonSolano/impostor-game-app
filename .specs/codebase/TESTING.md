# Testes

## As regras do jogo NÃO são testadas aqui

As regras do jogo vivem em SQL, no banco compartilhado com o web — então os testes delas também vivem lá: `../impostor/supabase/tests/`, em pgTAP, rodando com `npx supabase test db` a partir do repositório web. Em 2026-09-03 esse conjunto tem 13 arquivos e soma **199 asserções** (contadas somando os `plan(N)` de cada arquivo — `01_room_lifecycle` até `13_clue_validation`; o README do web cita "196" e pode estar um pouco desatualizado, já que o schema segue evoluindo). Um teste de componente aqui que mockasse o Supabase para "provar" que uma regra de jogo funciona só provaria que o mock funciona — é exatamente o anti-padrão que o próprio web documenta em `.specs/codebase/TESTING.md`.

O que este repositório testa é: lógica pura de cliente, hooks e comportamento de tela.

## O que roda aqui e onde

Checado em 2026-09-03, rodando `npm test`: **20 suítes, 103 testes, 103/103 passando.** O número mudou três vezes só durante a escrita deste documento (101→103 testes, 18→20 suítes) porque outros agentes editavam o código em paralelo — confira `npm test` antes de citar de novo, é o tipo de número que não fica parado.

| Camada | Onde | Exemplo |
|---|---|---|
| Lógica pura | `src/lib/game/__tests__/`, `src/lib/__tests__/` | `clue.test.ts` (validação de dica, espelha `is_valid_clue`), `room-code.test.ts` (normalização de código/nickname), `errors.test.ts` (mapeamento IM00x → mensagem), `haptics.test.ts` |
| Hooks | `src/hooks/__tests__/` | `useGameAccess.test.ts` (sessão anônima) |
| Primitivas de UI | `src/components/ui/__tests__/`, `src/components/shared/__tests__/` | `Button.test.tsx`, `Input.test.tsx`, `Countdown.test.tsx` (contrato: `onExpire` único, restante limitado a `totalMs`), `HoldToReveal.test.tsx` (regra 8 do AGENTS.md — o segredo desmonta, não só esconde), `PlayerGrid.test.tsx` |
| Telas de fase | `src/components/game/__tests__/` | Um arquivo por fase (`LobbyPhase`, `WordRevealPhase`, `CluePhase`, `VotingPhase`, `LastChancePhase`, `GameOverPhase`, `HomeScreen`) + `ClueDialog.test.tsx`, que é o mais extenso (10 casos) porque cobre envio de dica, palavrão, expiração e vibração numa peça só |

Não há teste de integração contra Realtime nem contra um banco real — mesma lacuna que o web já reconhece em `CONCERNS.md` #6, e a razão pela qual a verificação de ponta a ponta continua pendente (`.specs/project/STATE.md`).

## Comandos

```bash
npm test               # roda toda a suíte uma vez
npm run test:watch     # modo watch
npm run verify         # typecheck + lint + test
```

## Dois contornos de infraestrutura, e o sintoma que cada um evita

Ambos vivem em `jest.config.js`/`jest.setup.js`. Sem eles a suíte não sobe — não é uma questão de teste passar ou falhar, é o processo do Jest quebrando antes do primeiro `it()` rodar.

### 1. Resolver do `react-native-worklets`

**Sintoma sem o contorno:** qualquer componente que usa Reanimated (ou seja, quase todos — `Button`, `Card`, `Sheet`, `Spinner`, `Countdown`, `Confetti`...) derruba o teste na hora do `import`, porque `react-native-worklets` resolve para `NativeWorklets.native.ts`, que tenta instalar um Turbo Module nativo assim que o módulo é carregado. Esse nativo não existe no ambiente do Jest.

**Contorno:** `jest.config.js` aponta `resolver: 'react-native-worklets/jest/resolver.js'` — o resolver que a própria lib publica, que troca essa resolução pela variante sem sufixo `.native`. `jest.setup.js` complementa mockando `react-native-reanimated` inteiro (`jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'))`), que é o caminho documentado pelo próprio projeto Reanimated para testes — hooks e `with*` viram versões síncronas em JS puro.

### 2. Mapeamento de `lucide-react-native` para a build CJS

**Sintoma sem o contorno:** `SyntaxError: Unexpected token 'export'` ao importar qualquer ícone como valor (não como tipo — tipo o TS apaga em build, valor não). `lucide-react-native` publica `dist/esm/*.mjs` cru, sem transpilar, e é isso que o Jest resolve por padrão: a condição de export `"react-native"` do pacote aponta para o `.mjs`, exatamente como o Metro faria no app de verdade — mas o `transformIgnorePatterns` do preset `jest-expo` não cobre `.mjs`.

**Contorno:** `moduleNameMapper` em `jest.config.js` mapeia `^lucide-react-native$` direto para `dist/cjs/lucide-react-native.js` (build CJS, `.js` puro), evitando o `.mjs` por completo sem tocar no array de `transformIgnorePatterns` do preset (que é frágil e cheio de caminho específico de máquina).

## Outros mocks em `jest.setup.js`

- `expo-haptics` mockado com `jest.fn(() => Promise.resolve())` para cada função — sem motor de vibração no ambiente de teste as chamadas reais rejeitariam (sem ser falha nenhuma, mas poluindo a saída com "unhandled rejection"). Mockar aqui também permite os testes **assertarem** vibração: `expect(Haptics.impactAsync).toHaveBeenCalled()`.
- `@react-native-async-storage/async-storage` mockado com o mock oficial em memória (`.../jest/async-storage-mock`) — suficiente para a sessão anônima em teste.
- `expo-constants` mockado com credenciais fixas de teste (`https://test.supabase.co`, `test-anon-key`) — nenhum teste fala com um Supabase de verdade.
