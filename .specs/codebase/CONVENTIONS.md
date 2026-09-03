# Convenções

## Idioma

- **UI, mensagens de erro visíveis, comentários e commits**: PT-BR com acentuação correta.
- **Identificadores de código** (variáveis, funções, tipos, nomes de arquivo): inglês.
- **Comentários explicam o porquê, nunca o quê.** O código já diz o que faz; o comentário existe para a decisão que não está óbvia lendo a linha — por que um `useEffect` tem aquele array de dependências, por que um valor é fixo e não veio de token, por que uma ordem de chamada importa. Um comentário que só parafraseia a linha de baixo é ruído.

## TypeScript / React

- Componentes em `PascalCase`, um por arquivo, arquivo com o mesmo nome.
- Hooks em `camelCase` com prefixo `use`, em `src/hooks/`.
- Tipos de banco vêm de `src/lib/supabase/database.types.ts` (gerado por `supabase gen types`, no repositório web) — nunca escritos à mão. `src/lib/types.ts` reexporta e adiciona os tipos de retorno de RPC (`JoinResult`, `ClueResult`, `GuessResult`, `VoteTally`).
- **Zero `any`** (regra 5 do `AGENTS.md`). Se o tipo gerado não bate com o que o código precisa, o schema é que está errado — não o cliente que finge saber melhor.
- Sem barrel files — import direto do caminho do módulo.

## Estilo vem de token, nunca de valor solto

Cor, raio, espaço, tamanho de fonte e glow saem de `src/theme/colors.ts` e `src/theme/tokens.ts` — nunca um hex ou um número de pixel escrito à mão dentro de um componente (regra 10 do `AGENTS.md`). Um `#39ff14` digitado numa tela nova é um bug de identidade esperando para divergir do valor real assim que alguém mudar o tema. Toda folha de estilo (`StyleSheet.create`) importa de `@/theme`, nunca declara a própria paleta.

## Texto sempre passa por `AppText`

`src/components/ui/Text.tsx` é a única porta para texto no app (`Text` cru do React Native não herda fonte nem cor de lugar nenhum). Toda variante de tipografia (`eyebrow`, `title`, `subtitle`, `body`, `label`, `caption`, `display`) já nasce com peso e cor corretos — uma tela nunca declara `fontSize`/`color` direto num `<Text>`.

## Vibração por intenção, com três regras que não têm exceção

- Chama-se `haptics.press()`, `haptics.suspense()`, etc. — nunca `Haptics.impactAsync(...)` direto fora de `src/lib/haptics.ts`. Ver README para o vocabulário completo.
- **Nunca `await` numa chamada de `haptics`.** Toda função do módulo é fire-and-forget por contrato; um `await` sem `catch` por cima transformaria uma vibração que falhou (simulador, motor ausente) numa ação de jogo que falhou.
- **Nunca dentro de worklet sem `runOnJS` primeiro.** `haptics.*` chama APIs nativas via ponte assíncrona — chamar direto de dentro de uma função `'worklet'` (rodando na UI thread do Reanimated) quebra. `VotingPhase.tsx` (`SuspectStamp`) é o exemplo de referência: o `thud()` dispara no callback de `withSpring`, envolto em `runOnJS(haptics.thud)()`.

## Padrões de `key` que evitam bug de estado preso

- **`Countdown` sempre com `key={deadline}`.** O restante inicial vem do inicializador de `useState`, calculado uma vez só; sem `key` nova, um prazo novo faria a instância continuar contando a partir do valor antigo em vez de reiniciar.
- **`ClueDialog` sempre com `key` no turno** (`key={turnKey}`, onde `turnKey` combina `discussion_round` e `clue_turn_index`). Input, erro e contagem de faltas por palavrão são estado local do popup; sem a key, a mensagem de palavrão do turno anterior vazaria para o turno seguinte.

Os dois seguem o mesmo princípio: quando o estado local de um componente representa "o que está acontecendo agora" e o "agora" muda por um valor vindo do banco, a forma segura de reiniciar esse estado é trocar a `key`, não tentar limpar campo por campo dentro de um efeito.

## Nada de `Dimensions.get('window')` para layout

Regra 11 do `AGENTS.md`. Layout usa `flex`, `%`, e `useSafeAreaInsets()` para respiro de notch/barra de gestos — nunca uma medida de tela lida uma vez no import do módulo. O app roda em celular dobrável, tablet e com teclado aberto; uma medida congelada no import está errada assim que qualquer uma dessas coisas muda. Onde uma medida de janela é genuinamente necessária em runtime (a altura de queda do confete em `Confetti.tsx`), o hook é `useWindowDimensions()`, que reage a mudança — não a função estática `Dimensions.get`.

## `Platform.select` para as duas divergências reais entre iOS e Android

O app tem exatamente dois pontos de divergência deliberada por plataforma, ambos em `src/theme/tokens.ts` e replicados em `Card`/`Button`: o glow (sombra de verdade no iOS via `shadowColor`; borda mais forte no Android, porque `elevation` só desenha sombra preta) e o `behavior` do `KeyboardAvoidingView` (`'padding'` no iOS, `'height'` no Android, porque o `Modal` do `Sheet` abre uma Window própria que não herda `adjustResize` da Activity no Android). Fora desses dois, o app não tem outro `Platform.select` de layout — divergir por plataforma é exceção, não hábito.
