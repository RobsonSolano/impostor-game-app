/**
 * Jest com o preset do Expo.
 *
 * `jest-expo` já traz o transform de TS/JSX, os mocks dos módulos nativos e o
 * `transformIgnorePatterns` que deixa os pacotes ESM do RN passarem pelo Babel —
 * escrever isso à mão é a receita para "SyntaxError: Cannot use import statement".
 */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // `lucide-react-native` publica `dist/esm/*.mjs` cru (sem transpilar) e é
    // isso que o Jest resolve por padrão (a condição de export "react-native"
    // aponta pro `.mjs`, igual o Metro faria no app de verdade) — mas o
    // transform de `.[jt]sx?` do preset não cobre `.mjs`, então QUALQUER
    // import de valor (não só de tipo, que o TS apaga em build) de um ícone
    // quebrava o Jest com "Unexpected token 'export'". Mapear direto para a
    // build CJS do pacote (`dist/cjs`, `.js` puro) evita o `.mjs` por completo
    // sem tocar no array de transform do preset (frágil e cheio de caminho
    // absoluto específico da máquina).
    '^lucide-react-native$': '<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
  },
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
  // `react-native-worklets` (dependência do Reanimated 4) resolve para o
  // `NativeWorklets.native.ts`, que instala um Turbo Module nativo no import —
  // ele não existe no Jest e derruba QUALQUER componente que use Reanimated. O
  // resolver que a própria lib publica em `jest/resolver.js` troca essa
  // resolução pela variante sem sufixo `.native`, que não toca em nativo.
  resolver: 'react-native-worklets/jest/resolver.js',
}
