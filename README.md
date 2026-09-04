# Jogo do Impostor — mobile

Todos recebem a mesma palavra secreta. Menos um. O impostor não sabe qual é, e tem que blefar a partir das dicas que os outros escrevem — sem se entregar.

Este é o porte para celular do [Jogo do Impostor](../impostor): mesmo banco, mesmas regras, mesma identidade visual — adaptado para uma mesa de bar onde o aparelho passa de mão em mão, e gamificado com vibração.

## Como funciona uma partida

1. Alguém cria a sala no celular e passa o código de 4 letras para a mesa (lido em voz alta, digitado por outra pessoa — por isso o código gigante e sem I/O/0/1).
2. Cada um vê seu card secreto — **segurando o dedo na tela por 2 segundos**. Solta, esconde na hora.
3. O app sorteia a ordem e cada um escreve **uma palavra** relacionada à secreta, com prazo (15s para o primeiro da ordem, 20s para os seguintes). A dica aparece para todos os celulares na hora.
4. Terminada a volta, o host escolhe: mais uma rodada de dicas, ou abrir a votação.
5. Eliminaram um inocente? O impostor ganha. Acertaram o impostor? Ele ainda tem **5 segundos** para adivinhar a palavra entre 4 opções e roubar a vitória.

De 3 a 12 jogadores. Pontuação: verdadeiros +1 cada, impostor descoberto 0, impostor não descoberto +2, roubo na Última Chance +3. Serve presencial (a mesma mesa, celulares passando de mão) e remoto (cada um com o seu), com o fluxo idêntico.

## A diferença do mobile: vibração como canal de informação

O jogo web já existia; o que este porte acrescenta não é uma tela nova, é um sentido novo.

Numa mesa de bar o celular está sendo segurado por uma pessoa que olha para as outras, não para o aparelho — é assim que o jogo de dedução funciona. O ambiente é barulhento, a tela está longe do resto da mesa, e ninguém vai ficar checando o telefone a cada dois segundos esperando a própria vez. A vibração é o canal que sempre chega: é ela que avisa "chegou sua vez" sem que a mesa inteira precise ouvir um som ou ver uma notificação.

Por isso `src/lib/haptics.ts` não expõe primitivas (`impactAsync(Heavy)`), expõe **intenções**: `tap` (toque secundário), `select` (seleção mudou), `press` (ação primária confirmada), `thud` (algo pesado — card revelado, jogador eliminado), `success`, `warn` (aviso sem falha), `error` (regra quebrada, expulsão, tempo esgotado), `tick` (contagem regressiva), `soft` (revelação progressiva), `suspense` (três pulsos crescentes — o drumroll da apuração, "chegou a sua vez" na fase de dicas), `fanfare` (vitória) e `defeat` (derrota). Mudar o "peso" de um evento é mudar uma linha nesse arquivo, não caçar chamadas espalhadas por dez telas.

Toda vibração é fire-and-forget e engole o próprio erro — nunca um `await`. Um celular sem motor de vibração (simulador, ou haptics desligado no sistema) simplesmente não vibra, e nada no jogo muda: vibração é enfeite, nunca caminho crítico.

## A regra que sustenta o jogo

**O banco é a autoridade.** Toda transição de fase é uma função SQL `SECURITY DEFINER` com lock na linha da sala. O app lê estado e chama RPC — nunca decide regra, nunca recalcula resultado.

Disso decorre o cuidado mais importante do código: **a palavra secreta e a identidade do impostor nunca entram em `rooms`**. RLS filtra linhas, não colunas — qualquer coluna de `rooms` é visível para todo jogador inscrito no Realtime daquela sala. O segredo vive em `rounds` (sem grants para o cliente) e é entregue individualmente por `player_cards`, com RLS de linha própria. Um vazamento aqui seria falha **silenciosa**: o jogo continuaria funcionando, só que trapaceável — e é por isso que essa garantia é testada em pgTAP no banco (ver `../impostor/supabase/tests/03_secret_isolation.test.sql`), não neste repositório.

## As regras próprias do mobile

O app herda as 7 regras invioláveis do web (ver [`AGENTS.md`](AGENTS.md)) e acrescenta 4, porque celular na mão muda o que pode dar errado:

- **O segredo só existe na árvore de componentes enquanto o dedo está na tela.** `HoldToReveal` não esconde a palavra com `opacity` nem `blur` — ele **desmonta** o conteúdo ao soltar. A diferença importa: um segredo renderizado e só escondido por estilo está a um inspetor de componentes de distância (React DevTools, ou até o preview do multitarefa do sistema); um segredo que nunca chegou a montar não tem o que inspecionar. É a mesma disciplina da regra 2 (o segredo nunca entra em `rooms`), aplicada de novo na árvore de UI.
- **Vibração é enfeite, nunca caminho crítico.** Toda chamada de `haptics` é fire-and-forget e engole o próprio erro; nada nela pode fazer um voto falhar.
- **Estilo vem de token, não de valor solto.** Cor, raio, espaço, fonte e glow saem de `src/theme/`. Um `#39ff14` escrito à mão numa tela é um bug de identidade esperando para divergir do web.
- **Nada de `Dimensions.get('window')` para layout.** O app roda em aparelho dobrável, tablet e com teclado aberto — layout usa flex e `useSafeAreaInsets()`.

## Stack

Expo SDK 57 · React Native 0.86 · React 19.2 · expo-router 57 (rotas por arquivo) · Reanimated 4 + Gesture Handler · react-native-svg · expo-linear-gradient · expo-haptics · Supabase (Postgres + RLS + Realtime + auth anônima) · Jest + `jest-expo`.

Estilo é **StyleSheet + tokens** (`src/theme/`), não NativeWind — ver `.specs/project/STATE.md` para o porquê.

## Rodando local

Requer Node 20+.

```bash
npm install
cp .env.example .env          # preencha com as credenciais de um projeto Supabase
npx expo start
```

Abra no simulador iOS (`i`), emulador Android (`a`) ou no Expo Go de um celular na mesma rede.

## Comandos

```bash
npm start              # Metro (Expo Go)
npm run ios            # abre no simulador iOS
npm run android        # abre no emulador Android
npm run typecheck      # tsc --noEmit
npm test               # Jest
npm run verify         # typecheck + lint + test
npx expo-doctor         # sanidade de dependências nativas
```

## O banco é do repositório web

Este app **não é dono de banco nenhum**. Por isso não existe pasta `supabase/` aqui — as migrations, a RLS e as funções SQL vivem em `../impostor`, que é quem define o schema. Este repositório é só cliente: lê estado, chama RPC, mostra tela.

Projeto Supabase em uso: `bbtsqjxcmlymwxcqvrmo`. As 8 migrations do web estão aplicadas nele e *Anonymous sign-ins* está habilitado (sem isso `signInAnonymously()` volta 422 e ninguém entra em sala). Para apontar para outro projeto, mude `.env` no local e as variáveis de ambiente do EAS nos builds — nada de credencial fica no repositório.

## Verificação

- `npm run typecheck` limpo, `npm run lint` sem erros, suíte Jest passando (ver `.specs/codebase/TESTING.md`), `npx expo-doctor` 21/21.
- **Partida completa jogada contra o banco de verdade**, com o emulador Android como jogador 1 e dois jogadores dirigidos por REST: criar sala → os dois entrando e aparecendo no lobby **por Realtime, sem recarregar** → iniciar → card secreto revelado no hold → turnos de dica de 30s → votação em "pular" → anúncio de votação indecisa → rodada nova largando sozinha em 10s → votação decisiva → Última Chance → fim de jogo com o placar certo (verdadeiros +1 cada, impostor pego 0).
- As duas garantias que teste com mock não prova, conferidas no aparelho: a palavra secreta **não** está na árvore de views antes do hold (conferido no dump de acessibilidade do Android, não em screenshot), e o resultado **não** aparece durante o drumroll.
- `rooms` conferido durante a partida: `revealed_word` e `revealed_impostor_id` continuam `null` até o fim, e cada jogador lê só a própria linha em `player_cards`.

## Três armadilhas que já custaram tempo

**`react-native-url-polyfill/auto` tem que ser a primeira linha do app.** O `@supabase/supabase-js` monta URLs de request com `URL`/`URLSearchParams`, e o Hermes (motor JS do React Native) não cobre tudo que essas APIs usam. Sem o polyfill carregado antes de qualquer import do Supabase, o primeiro `signInAnonymously()` falha com um erro de parsing que **parece** problema de rede — e não é. Está resolvido em `app/_layout.tsx`, na primeira linha do arquivo, de propósito.

**Tema de navegação escuro explícito, ou o app abre com fundo branco.** O expo-router pinta o container de tela com a cor do tema de navegação — não com o que está no `_layout`. Sem um tema escuro explícito, o gradiente do app renderiza normalmente por baixo, mas o expo-router pinta um fundo **branco** por cima dele. O sintoma engana: parece "erro de cor em alguns componentes" (texto branco em fundo branco, com os cards escuros ainda aparecendo por cima), não "tema de navegação errado". Resolvido em `src/theme/navigation.ts`.

**O glow do Android não é sombra, é borda.** No iOS o brilho neon do app é `shadowColor` de verdade. No Android, `elevation` (o jeito nativo de dar sombra) só desenha sombra **preta** — aplicar isso sujaria o fundo escuro do app com um halo cinza em vez de um brilho colorido. A solução em `src/theme/tokens.ts` é: no Android, `elevation: 0` e o brilho vira borda mais forte. A identidade não é 100% idêntica entre os dois sistemas operacionais — e é assim de propósito, não um bug pendente.
