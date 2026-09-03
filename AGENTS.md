# Jogo do Impostor — app mobile

App React Native (Expo) do jogo de dedução social. Porte do `impostor` web
(`../impostor`), mesma identidade visual, mesmo banco, mesmas regras — adaptado
para celular e **gamificado com vibração**.

Todos recebem a mesma palavra secreta, exceto um impostor. O grupo conversa **na
vida real** e usa o celular só para receber o card secreto, escrever dicas, votar
e ver o resultado.

**Idioma do projeto: PT-BR.** UI, mensagens de erro visíveis, comentários e
commits em português com acentuação correta. Identificadores de código em inglês.

## Regras invioláveis

Herdadas do web e igualmente válidas aqui:

1. **O banco é a autoridade do jogo.** Toda transição de fase é uma função SQL
   `SECURITY DEFINER` com lock na linha da sala. O app lê estado e chama RPC —
   nunca decide regra, nunca recalcula resultado. Se aparecer um `if` de regra de
   jogo em `src/lib/game/actions.ts`, a autoridade escapou do banco.
2. **A palavra secreta e a identidade do impostor nunca entram em `rooms`.** RLS
   filtra linhas, não colunas: qualquer coluna de `rooms` é visível para todo
   jogador inscrito no Realtime daquela sala. O segredo vive em `rounds` (sem
   grants) e é entregue individualmente por `player_cards`.
3. **`votes` não tem `SELECT` para o cliente.** Progresso vira contador em
   `rooms.votes_cast`; apuração vira `rooms.last_vote_tally` só depois de
   resolvida.
4. **Nenhuma `SERVICE_ROLE_KEY` no app.** Se apareceu uma, é porque uma regra de
   jogo escapou do banco.
5. **Sem `any`.** Tipos de banco vêm de `supabase gen types`
   (`src/lib/supabase/database.types.ts`), nunca escritos à mão.
6. **O app dá ritmo à dica escrita, não à conversa.** Existe ordem sorteada e
   prazo para *escrever a palavra*. Não existe "sua vez de falar": enquanto o
   contador do próximo corre, a mesa comenta à vontade. Nada no app pede que
   alguém fale, nem cronometra a discussão.
7. **A palavra secreta não é bloqueada como dica.** Recusar confirmaria ao
   impostor que ele acertou. O aviso na tela é preventivo.

## Regras próprias do mobile

8. **O segredo só existe no DOM enquanto o dedo está na tela.** `HoldToReveal`
   desmonta o conteúdo ao soltar — não é `opacity` nem `blur`. Segredo renderizado
   e escondido por estilo está a um inspetor de distância.
9. **Vibração é enfeite, nunca caminho crítico.** Toda chamada de `haptics` é
   fire-and-forget e engole o próprio erro. Nada em `src/lib/haptics.ts` pode
   fazer um voto falhar. Nunca dê `await` numa vibração.
10. **Estilo vem de token, não de valor solto.** Cor, raio, espaço, fonte e glow
    saem de `src/theme/`. Um `#39ff14` escrito à mão numa tela é um bug de
    identidade esperando para divergir.
11. **Nada de `Dimensions.get('window')` para layout.** O app roda em aparelho
    dobrável, tablet e com teclado aberto. Use flex e `useSafeAreaInsets()`.

## Stack

Expo SDK 57 · React Native 0.86 · React 19.2 · expo-router 57 (rotas por arquivo)
· Reanimated 4 + Gesture Handler · react-native-svg · expo-linear-gradient ·
expo-haptics · Supabase (Postgres + RLS + Realtime + auth anônima) · Jest +
`jest-expo`

Estilo é **StyleSheet + tokens** (`src/theme/`), não NativeWind: a identidade
depende de glow (sombra nativa), gradiente e spring, que classe de Tailwind não
carrega em RN.

## Comandos

```bash
npm start              # Metro (Expo Go)
npm run ios            # abre no simulador iOS
npm run android        # abre no emulador Android
npm run typecheck      # tsc --noEmit
npm test               # Jest
npm run verify         # typecheck + lint + test
npx expo-doctor        # sanidade de dependências nativas
```

## Estrutura

```
app/                       rotas (expo-router)
  _layout.tsx              shell: gradiente, tema, gesture root, safe area
  index.tsx                tela inicial (criar/entrar)
  sala/[code].tsx          a partida inteira, uma rota só
src/
  components/game/         telas de fase + orquestrador
  components/shared/       peças reaproveitadas entre fases
  components/ui/           primitivas (Button, Input, Card, Text, Sheet)
  hooks/                   acesso, canal de Realtime, card secreto, dicas
  lib/game/                actions (RPC), validação de dica, código de sala, erros
  lib/supabase/            cliente singleton, sessão anônima, tipos do banco
  lib/haptics.ts           vocabulário de vibração, por intenção
  theme/                   cores, tokens, tema de navegação
```

Uma única rota para a partida inteira: as fases são componentes trocados por
`rooms.status`, não navegações. Navegar entre fases derrubaria e recriaria o canal
de Realtime a cada transição — o jeito mais fácil de perder um evento e deixar um
celular preso na tela anterior.

## Referência

- `.specs/CONTRACTS.md` — assinaturas das peças compartilhadas (contrato entre
  telas; leia antes de escrever componente novo)
- `.specs/project/PROJECT.md` — visão, escopo, decisões
- `.specs/codebase/*` — stack, arquitetura, convenções, testes, riscos
- `../impostor` — o web, fonte de verdade de regra, texto e identidade visual
