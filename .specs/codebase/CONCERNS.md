# Concerns — riscos, dívidas e áreas frágeis

Ordenado por risco real de estragar uma partida. Ver `.specs/project/STATE.md` para o registro de decisões — este arquivo é só sobre o que ainda incomoda.

## 🔴 Alto

### 1. Banco de produção não definido, e verificação de ponta a ponta pendente

O `.env` deste checkout aponta para um projeto Supabase (`wpmkvthjthwgbfandeif`) que não existe mais — confirmado NXDOMAIN em 2026-09-03. Isso significa que **nenhuma partida real foi jogada neste app**: o que está verificado é typecheck, testes de lógica isolada e render no simulador, não o fluxo completo de Realtime + RPC + RLS contra um banco vivo, com dois celulares na mesma sala. É o maior risco do porte simplesmente porque é o que falta testar por completo, não porque algo específico esteja quebrado. Ver `.specs/project/STATE.md` para o que fazer antes de jogar de verdade.

### 2. Expiração de prazo depende de um cliente vivo chamar a RPC

O Postgres não dispara nada sozinho: `expire_clue_turn` e `expire_last_chance` só rodam quando um cliente cujo contador local zerou as chama (herdado do web, mesmo padrão de `expire_last_chance` lá). São idempotentes no banco — todos os celulares chamando ao mesmo tempo produz um único resultado, sem corrida. Mas se **todos** os celulares da mesa fecharem o app, ou ficarem com a tela apagada por tempo suficiente, exatamente no instante em que o prazo vence, o turno (ou a Última Chance) fica preso sem ninguém para chamar a expiração — e sem cron nenhum para isso, mesma lacuna que o web já documenta para o seu próprio `LAST_CHANCE`.

## 🟡 Médio

### 3. Glow no Android não é sombra — a identidade não é 100% idêntica entre os dois SOs

`src/theme/tokens.ts`: no iOS o brilho neon usa `shadowColor` de verdade; no Android, `elevation` (o único jeito nativo de sombra) só desenha sombra **preta**, o que sujaria o fundo escuro do app com um halo cinza em vez de um brilho colorido. A solução foi `elevation: 0` no Android e o brilho virar borda mais forte (`Card`, `Button`). Funciona, mas é uma decisão deliberada de divergência visual, não um efeito equivalente — quem comparar lado a lado um Pixel e um iPhone vai ver um brilho diferente, e não há plano para igualar isso sem uma lib de sombra customizada.

### 4. Layout de uma faixa só — o web tem quatro

`PhaseShell` roda numa única coluna sempre. O web tem layout responsivo de celular/`sm`/tablet/desktop, com o `aside` virando coluna lateral a partir do desktop. Aqui o app cobre celular e tablet com a mesma coluna, só com `CONTENT_MAX_WIDTH` (520px) limitando a largura em tela grande — não existe uma segunda coluna para tablet em paisagem ou para o `aside` (mesa, placar). Aceitável para o caso de uso principal (celular na mão, retrato), mas um tablet em paisagem vê uma coluna estreita centralizada com bastante espaço vazio nas laterais.

### 5. Falta token de alpha para texto sobre avatar e véu do `Sheet`

Dois lugares reaproveitam um valor que não foi desenhado para aquele uso, registrados no próprio código:

- `PlayerAvatar.tsx`: o texto da inicial usa `'rgba(0, 0, 0, 0.8)'` direto, fora de `@/theme`, porque não existe um token do tipo "texto legível sobre cor arbitrária" — a cor de fundo do avatar vem do banco (`avatar_color`), não da paleta do app, então nenhum token de tema foi desenhado pra essa combinação. O próprio web resolve do mesmo jeito, com `text-black/80` direto no componente.
- `Sheet.tsx`: o véu (scrim) atrás do modal usa `alpha.card80`, que é o alpha mais próximo disponível, não um token pensado para "fundo de modal". O web usa `bg-black/10` porque conta com `backdrop-blur` (que o RN não tem sem lib nova); sem blur, 10% de opacidade não separaria visualmente o sheet do fundo, daí o valor emprestado.

Nenhum dos dois é bug — os componentes funcionam e ficam corretos visualmente — mas os dois são valor reaproveitado por falta de token, e a regra 10 do `AGENTS.md` é justamente sobre isso: um dia alguém vai mudar a paleta e esses dois pontos não vão acompanhar sozinhos.

## 🟢 Baixo

### 6. Vibração é enfeite por contrato — e às vezes simplesmente não acontece

Regra 9 do `AGENTS.md`, e cumprida à risca: todo `haptics.*` é fire-and-forget e engole o próprio erro. Consequência inevitável: um aparelho sem motor de vibração (a maioria dos simuladores/emuladores), ou com haptics desligado no sistema pelo usuário, simplesmente não vibra — e nada no jogo muda, porque nada pode depender disso. Isso é a decisão correta, mas vale registrar que "a vibração mais importante do app" (`suspense()` em "chegou a sua vez", ver README) tem uma fração desconhecida de aparelhos reais onde ela nunca chega, e não há fallback visual equivalente em destaque para esse caso — a tela muda (`CluePhase` abre o `ClueDialog`), mas sem o toque físico que é o argumento central do porte.

### 7. `expo-doctor` e `npm run verify` não fazem parte de nenhum pipeline

Os três comandos existem e estão documentados no README, mas nenhum roda automaticamente (não há CI configurado neste repositório). `npm run lint` depende de `eslint`/`eslint-config-expo` estarem instalados via `npm install` depois de qualquer mudança em `package.json` — o tipo de coisa fácil de esquecer quando várias pessoas (ou agentes) editam o `package.json` na mesma janela de tempo.

## Sem OTA (`expo-updates`) — decisão consciente

O `expo-updates` não está instalado, e os perfis do `eas.json` não declaram
`channel`. Isso significa que **toda mudança exige um build novo**, inclusive
trocar as credenciais do Supabase: `EXPO_PUBLIC_*` é inlinado pelo Metro no
bundle, não lido em tempo de execução.

Vale instalar quando o banco de produção estiver definido, porque aí OTA resolve
exatamente o problema mais provável deste projeto: apontar o app para outro
projeto Supabase sem reinstalar o APK em cada celular da mesa.

```bash
npx expo install expo-updates
npx eas-cli update:configure   # precisa editar app.config.ts à mão: é config dinâmica
```

Não foi feito agora porque acrescentaria dependência, `runtimeVersion` e uma
política de canal que não dá para validar sem um build a mais — e a configuração
atual está verificada como está.
