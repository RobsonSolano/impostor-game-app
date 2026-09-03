# STATE — Jogo do Impostor mobile

Memória persistente do porte. Decisões, o que está verificado e como, e o que continua em aberto.

**Hoje é 2026-09-03.** O código está sendo editado por múltiplos agentes em paralelo nesta mesma data — os números de teste e dependências abaixo são um retrato deste momento, não uma garantia permanente. Confira `npm test` e `package.json` antes de citar esses números de novo.

## O que está feito e verificado

- **`npm run typecheck` limpo** (`tsc --noEmit`, `strict` + `noUncheckedIndexedAccess` ligados) — checado em 2026-09-03.
- **Suíte Jest: 103 testes, 20 suítes, 103/103 passando** — checado em 2026-09-03 rodando `npm test`. Cobre lógica pura (`src/lib/game/`, `src/lib/haptics.ts`), hooks (`useGameAccess`) e comportamento de tela (todas as fases, `ClueDialog`, `Countdown`, `HoldToReveal`, `PlayerGrid`, `Button`, `Input`). Ver `.specs/codebase/TESTING.md` para o detalhamento — esse número mudou três vezes ao longo desta mesma tarde (101→103 testes) porque outros agentes editavam o código em paralelo, e vai continuar mudando.
- **`npm run lint` sem erros.** Duas regras do conjunto novo do React Compiler estão desligadas com justificativa em `eslint.config.js`: `react-hooks/immutability` (ela marca `sharedValue.value = ...` como mutação proibida, mas isso é a API documentada do Reanimated — a regra ligada transformaria cada animação do app em erro) e `react-hooks/set-state-in-effect`, só em `Sheet.tsx` (o `visible` do Modal não é derivável de `open`: ele tem que continuar verdadeiro DEPOIS de `open` virar falso, para a animação de descida acontecer antes de desmontar).
- **`npx expo-doctor`: 21/21 checks.**
- **Render confirmado no simulador iOS e no emulador Android**: a cadeia nativa completa (Reanimated, Gesture Handler, SVG, lucide, haptics, tokens de tema, cliente Supabase) sobe sem crash nos dois.
- **Interação real verificada no emulador Android**, dirigida por `adb shell input` (o simulador iOS não serve para isso: automação de toque lá exige permissão de acessibilidade). Confirmado na tela: digitar o nome habilita o CTA (que nasce desabilitado), `normalizeRoomCode` converte `x9k2` digitado em `X9K2` na tela, trocar de aba preserva o nome, e um erro de rede aparece em PT-BR na tela em vez de derrubar o app.
- **As seis telas de fase fotografadas em aparelho** e conferidas contra o web, via uma rota temporária de preview que montava cada fase com dados fabricados (rota removida depois de usada). Incluindo as duas garantias que mais importam e que teste unitário com mock não prova: no `WORD_REVEAL` a palavra secreta **não** está na tela antes do hold, e no drumroll do `GAME_OVER` o resultado **não** aparece antes da contagem terminar.
- Todas as seis fases da máquina de estados (`LOBBY`, `WORD_REVEAL`, `DISCUSSION`, `VOTING`, `LAST_CHANCE`, `GAME_OVER`) e o estado `CLOSED` têm componente de tela implementado e testado isoladamente.

## O que continua em aberto

- **Verificação de ponta a ponta contra um banco Supabase vivo.** Nunca foi testado criar sala, entrar com um segundo celular, trocar de fase por Realtime, votar e chegar ao resultado contra um projeto Supabase real. O `.env` deste checkout aponta para um projeto que não existe mais (ver abaixo) — isso bloqueia esse teste até um banco novo ser provisionado.
- **Instalação num aparelho físico.** O projeto EAS existe (`eada121e-ff8e-4bf4-a8d7-cff45d0622f5`, conta `robsonsolano`), `eas.json` tem os perfis `development`/`preview`/`production`, e as credenciais do Supabase estão como variáveis de ambiente do EAS (`EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY` nos três ambientes) em vez de fixadas no repositório — trocar de projeto Supabase é `eas env:update`, sem commit. O que falta é instalar o artefato num celular de verdade e sentir a vibração, que é o único jeito de validar a gamificação (emulador e simulador não têm motor de vibração).

## Decisões técnicas

### 2026-09 — StyleSheet + tokens em vez de NativeWind

O web usa Tailwind 4. A tentação óbvia seria NativeWind no mobile para reaproveitar classes. Descartado por dois motivos: (1) o NativeWind 4 não tem pin de versão de React Native — ele engancha em Metro e Babel de um jeito que amarra o app a uma combinação de versões fora do controle deste projeto, numa stack (Expo SDK 57 / RN 0.86) recém-lançada onde esse tipo de acoplamento quebra fácil; (2) a identidade visual do app depende de glow (sombra nativa via `shadowColor`/`elevation`), gradiente (`expo-linear-gradient`) e spring (Reanimated) — nenhum desses três é uma classe utilitária que o Tailwind carrega em React Native. O caminho escolhido foi `src/theme/` (cores, tokens de espaço/raio/fonte, glow, motion) consumido via `StyleSheet.create`, replicando os valores do `globals.css` do web token a token.

### 2026-09 — Expo SDK 57 / React Native 0.86 / Reanimated 4 + react-native-worklets 0.10

Versões mais recentes disponíveis no momento do porte. Reanimated 4 depende de `react-native-worklets` como pacote separado (não é mais parte do próprio Reanimated) — isso tem efeito direto na configuração do Jest (ver `.specs/codebase/TESTING.md`).

### 2026-09 — Uma única rota para a partida inteira

`app/sala/[code].tsx` é a única rota depois da home; as fases (`LobbyPhase`, `WordRevealPhase`, `CluePhase`, etc.) são componentes trocados por `rooms.status` dentro de `GameRoom`, não telas navegadas. Motivo: navegar entre fases desmontaria e remontaria `useRoomChannel`, derrubando e recriando o canal de Realtime a cada transição — o jeito mais fácil de perder um evento (um `UPDATE` chegando exatamente na janela de reconexão) e deixar um celular preso na fase anterior enquanto o resto da mesa já avançou.

### 2026-09 — Tema de navegação escuro explícito (`src/theme/navigation.ts`)

Sem isso o app abre com fundo **branco**: o expo-router pinta o container de tela com a cor do tema de navegação, não com o que está no `_layout`. O gradiente escuro do app renderiza normalmente por baixo, mas o expo-router pinta por cima — e o tema padrão do `expo-router`/`Stack` é claro. O sintoma engana quem for debugar: aparece como texto branco sobre fundo branco, com os cards escuros (que têm cor própria) ainda visíveis por cima, e isso lê como "erro de cor em alguns componentes" em vez de "tema de navegação errado". `contentStyle: { backgroundColor: 'transparent' }` no `Stack` **não resolve sozinho** — quem pinta o fundo é o tema (`background`/`card` em `navigationTheme.colors`), não o `contentStyle`. Resolvido fixando um `Theme` escuro explícito com `background` e `card` transparentes, para o gradiente do shell aparecer atrás de qualquer tela.

### 2026-09 — Credenciais do Supabase como variável de ambiente do EAS, não no `eas.json`

A `anon key` é pública por design (quem protege o jogo é a RLS), então não haveria risco de segurança em fixá-la no repositório. O motivo é outro: fixar URL e key no `eas.json` amarra cada build a um projeto Supabase específico, e este projeto já trocou de banco uma vez (o ref do web morreu). Com variável de ambiente do EAS, apontar para outro projeto é um comando, sem commit e sem rebuild da configuração. Os perfis do `eas.json` só declaram `environment` ("development"/"preview"/"production").

### 2026-09 — Este repositório não tem `supabase/`

Decisão deliberada, não uma pendência: o schema, as migrations, a RLS, as funções SQL e os testes pgTAP de regra de jogo vivem em `../impostor`, que é o dono do banco (web e mobile compartilham o mesmo projeto Supabase). Duplicar o schema aqui criaria duas fontes de verdade que podem divergir silenciosamente. Este app só fala com o banco via `@supabase/supabase-js` — RPC e `select`.

## Blocker atual

### 🔴 O banco de teste do web não existe mais

`.env` deste checkout aponta para `https://wpmkvthjthwgbfandeif.supabase.co` — o mesmo ref que estava em `.env.local` do `impostor` web. Consultado em 2026-09-03, o domínio devolve `NXDOMAIN` (confirmado com `dig`/`nslookup`): o projeto foi pausado ou apagado, provável efeito do plano gratuito do Supabase por inatividade.

**Efeito prático:** nenhuma RPC, nenhum Realtime, nenhuma sessão anônima funciona contra este `.env` hoje. O app builda, typecheck passa, os testes passam (todos mockam o Supabase) e as telas renderizam — mas ninguém consegue de fato criar ou entrar numa sala.

**Ação necessária antes de jogar de verdade:** provisionar um projeto Supabase novo (ou reativar um existente), aplicar as migrations de `../impostor/supabase/migrations/` (`npx supabase link` + `npx supabase db push`, rodado a partir do repositório web), habilitar *Anonymous sign-ins* no painel, e apontar `EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_ANON_KEY` para o projeto novo.

## Lições herdadas do web (valem aqui também)

Ver `../impostor/.specs/project/STATE.md` para o registro completo. As que mais pesam para quem mexe no cliente:

- Login anônimo precisa estar habilitado no painel do Supabase, ou `signInAnonymously()` volta 422.
- Sessão anônima órfã (token válido apontando para usuário que não existe mais) não se resolve tentando de novo — precisa de `getUser()` contra o servidor, não só `getSession()`. `src/lib/supabase/client.ts` já implementa essa checagem, e no app ela pesa mais que no web: o `AsyncStorage` sobrevive a fechar e reabrir o aplicativo, então uma sessão órfã ficaria presa por semanas em vez de sumir ao fechar a aba.
