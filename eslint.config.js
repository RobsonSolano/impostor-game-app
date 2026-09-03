// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config')
const expoConfig = require('eslint-config-expo/flat')

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*'],
  },
  {
    /**
     * `react-hooks/immutability` é do conjunto novo do React Compiler, e ele não
     * conhece o Reanimated: escrever em `sharedValue.value` é a API DOCUMENTADA
     * da biblioteca (é assim que se anima fora da thread de JS), não uma mutação
     * acidental do retorno de um hook. A regra marca todo `scale.value = ...`
     * como erro, o que aqui significa marcar como erro cada animação do app.
     *
     * Desligada só onde o Reanimated é usado — em qualquer outro lugar, mutar o
     * retorno de um hook continua sendo erro, que é o comportamento correto.
     */
    files: ['src/**/*.tsx', 'src/**/*.ts', 'app/**/*.tsx'],
    rules: {
      'react-hooks/immutability': 'off',
    },
  },
  {
    /**
     * O `Sheet` monta o `Modal` (via `setVisible(true)`) dentro de um efeito, de
     * propósito, e a regra do compilador reclama com razão no caso geral — mas
     * não neste.
     *
     * `visible` não é derivável de `open`: ele precisa continuar verdadeiro
     * DEPOIS de `open` virar falso, para a animação de descida acontecer antes de
     * o `Modal` desmontar. E a montagem tem que vir antes da animação de entrada,
     * senão não existe nó para animar. É o caso de escape que a própria regra
     * prevê.
     */
    files: ['src/components/ui/Sheet.tsx'],
    rules: {
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    /**
     * Nos testes, `require()` dentro da fábrica de `jest.mock` não é escolha de
     * estilo: o `babel-plugin-jest-hoist` iça a chamada de `jest.mock` para ANTES
     * dos imports, então um `import` no topo ainda não existiria quando a fábrica
     * roda. `require()` ali é o único jeito que funciona.
     */
    files: ['**/__tests__/**', '**/*.test.ts', '**/*.test.tsx', 'jest.setup.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
])
