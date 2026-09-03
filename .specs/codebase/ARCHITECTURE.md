# Arquitetura

## Princípio central: o mesmo do web — o banco é a autoridade

O app **nunca** decide regra de jogo. Ele lê estado e chama RPC. Toda transição de fase é uma função `SECURITY DEFINER` no Postgres (definida em `../impostor/supabase/migrations/`), que toma lock na linha da sala, valida quem está chamando via `auth.uid()`, valida se a transição é legal a partir do `status` atual, e escreve o novo estado. O `UPDATE` resultante é, ele mesmo, o evento de Realtime que sincroniza os celulares.

`src/lib/game/actions.ts` é a única porta para isso: uma função por RPC, sem `if` de regra de jogo. Ver o comentário de cabeçalho do arquivo — se aparecer lógica de decisão ali, a autoridade escapou do banco (regra 1 do `AGENTS.md`).

## Uma única rota para a partida inteira

`app/sala/[code].tsx` monta `GameRoom`, que resolve sessão anônima → id da sala → assina `rooms`/`players` → faz o switch de fase por `room.status`:

```
GameRoom
  useAnonSession()               → auth.uid()
  useRoomIdFromCode(code, ready) → resolve o código digitado para o id da sala
  useRoomChannel(roomId)         → { room, players, connected }
  useMyCard(room.active_round_id, me.id)   → card secreto da rodada atual
  useRoundClues(room.active_round_id)      → dicas da rodada (com Realtime)

  switch (room.status):
    LOBBY        → LobbyPhase
    WORD_REVEAL  → WordRevealPhase
    DISCUSSION   → CluePhase
    VOTING       → VotingPhase
    LAST_CHANCE  → LastChancePhase
    GAME_OVER    → GameOverPhase
    CLOSED       → RoomClosedScreen (fora do switch por status; redireciona sozinho)
```

As fases são componentes trocados por estado (`{room.status === 'LOBBY' && <LobbyPhase />}` dentro de um `Animated.View key={room.status}`), não telas navegadas. **Por quê:** navegar entre fases desmontaria e remontaria `useRoomChannel` a cada transição, derrubando e recriando o canal de Realtime — a forma mais fácil de perder um evento (um `UPDATE` chegando na janela de reconexão) e deixar um celular preso na fase anterior enquanto o resto da mesa já avançou. O preço dessa escolha é que `GameRoom.tsx` cresce com cada fase nova (mesma tensão que o web já registra em `CONCERNS.md` #9) — mas evitar duas fontes de verdade para "em que fase estamos" vale mais que um arquivo menor.

## Como o segredo não vaza (herdado do web, sem mudança de desenho)

```
rounds        ← segredo bruto. ZERO grants para o cliente.
player_cards  ← uma linha por (rodada, jogador). RLS: só a linha do meu auth.uid().
              ← impostor recebe word_text = NULL.
rooms         ← estado público: status, contadores, resultado.
              ← revealed_word / revealed_impostor_id só preenchidos em GAME_OVER.
```

Ver `../impostor/.specs/codebase/ARCHITECTURE.md` para o desenho completo — o schema é o mesmo, este app só consome.

## Fluxo de dados: três buscas, uma só com Realtime completo

```
useRoomChannel(roomId)
  1 canal Supabase → 2 subscriptions: rooms (por id) + players (por room_id)
  → é TUDO que o app observa continuamente

useMyCard(roundId, playerId)
  fetch pontual em player_cards — SEM Realtime, de propósito
  gatilho: mudança de room.active_round_id, que já chega via useRoomChannel

useRoundClues(roundId)
  fetch pontual + Realtime em round_clues, filtrado por round_id
  (diferente de player_cards: a dica de um jogador tem que aparecer
  no celular dos outros no instante em que ele confirma)

votes / rounds
  inalcançáveis pelo cliente por design — SELECT bloqueado por RLS
```

`useMyCard` não assina Realtime porque o gatilho de recarregar já vem de graça: `room.active_round_id` muda, o componente que consome o hook re-renderiza com o novo `roundId`, e o efeito busca de novo. Uma terceira subscription só adicionaria superfície de RLS-em-Realtime sem ganho — mesma lógica de custo/benefício que levou `votes` a não ter `SELECT` nenhum.

## `src/lib/game/actions.ts` — camada fina de RPC

Cada função exportada (`createRoom`, `startGame`, `submitClue`, `castVote`, `expireClueTurn`, etc.) faz exatamente uma chamada `supabase.rpc(...)` e devolve o resultado ou lança o erro do Postgres. `submitClue` é o caso que quebra o padrão "throw em erro": palavra vulgar volta como `{ ok: false, reason: 'PROFANITY', strikes }`, não como exceção — porque uma exceção em `plpgsql` desfaria a transação inteira, e o incremento do contador de faltas voltaria a zero junto (a falta **precisa** ser persistida mesmo quando a dica é recusada).

## Onde a vibração entra

`src/lib/haptics.ts` não é chamado por `actions.ts` nem por nenhum hook de dados — vibração é decisão de tela, não de camada de dados. Cada componente de fase decide, no seu próprio código, qual intenção chamar e quando:

- `useRoomChannel` **não** vibra em troca de fase, embora seja o hook mais central do app — comentário extenso no próprio arquivo explica por que uma versão anterior que vibrava ali produzia vibração empilhada (a fase que ganha o card secreto ficando silenciosa por design tinha esse silêncio furado por um `thud` genérico do hook).
- `CluePhase` vibra `suspense()` na transição para "chegou a sua vez" — a vibração mais importante do app, porque é o único sinal que funciona com o celular na mesa e a pessoa olhando para os amigos.
- `Countdown` e `HoldToReveal` vibram sozinhos, amarrados ao próprio progresso (tique por segundo nos últimos 3s; pulso a cada ~25% do hold).
- `GameOverPhase` dispara `fanfare()`/`defeat()` no exato commit em que o resultado é revelado, nunca antes — a fase de drumroll é silenciosa (exceto por `tick()` a cada segundo) para não competir com a fanfarra final.

Toda chamada é fire-and-forget (regra 9 do `AGENTS.md`): nunca `await`, e o próprio `haptics.ts` engole a rejeição de um aparelho sem motor de vibração.

## Duas adições que o web não precisava

O web roda numa aba de navegador que o usuário está olhando. O celular vai para o bolso, a tela apaga, o app troca de plano — e o sistema operacional pode suspender timers e sockets sem avisar ninguém. Duas peças existem só por causa disso:

**1. Recalibração do `Countdown` ao voltar para primeiro plano.** A regra herdada do web é: o restante é calculado **uma vez** (`deadline - Date.now()`, limitado a `totalMs`) e conta para baixo localmente a partir daí — nunca relendo o relógio a cada tique, porque isso deixaria o contador refém de um celular com hora errada. Mas o SO suspende os `setTimeout` do JS com o app em segundo plano; sem correção, ao voltar o contador retomaria de onde parou e mostraria mais tempo do que realmente resta (possivelmente mais do que o prazo já vencido no banco). `Countdown` escuta `AppState` e, só na transição para `'active'`, recalcula o restante a partir do `deadline` — sem violar a regra de não reler o relógio a cada tique, que é sobre o loop normal, não sobre essa borda específica.

**2. Refetch de `useRoomChannel` quando o `AppState` volta para `'active'`.** O WebSocket do Realtime pode morrer em silêncio com a tela apagada — o SO suspende sockets ociosos, e o Supabase só percebe e reconecta depois. Qualquer `UPDATE` que aconteceu nesse intervalo nunca chega até a reconexão. Sem este refetch, o jogador voltaria ao app e ficaria preso vendo a fase de antes de guardar o celular, mesmo com o resto da mesa três fases à frente. O mesmo padrão existe em `HoldToReveal` (que também escuta `AppState` para descartar o segredo se o app sair de primeiro plano com o dedo ainda na tela — ver regra 8) e no cliente Supabase (`startAutoRefreshBridge`, que liga/desliga o refresh de token com o ciclo de vida do app, porque o timer de refresh do GoTrue também não roda em segundo plano).
