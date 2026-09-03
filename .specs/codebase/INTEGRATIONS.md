# Integrações externas

## Supabase — única dependência externa

O mesmo projeto Supabase do `impostor` web (compartilhado, não duplicado — ver `.specs/project/STATE.md`). Cobre banco, tempo real e identidade.

| Recurso | Uso |
|---|---|
| PostgreSQL | Estado do jogo + banco de palavras. Schema definido em `../impostor/supabase/migrations/` |
| Realtime (`postgres_changes`) | `useRoomChannel` assina `rooms` (por `id`) e `players` (por `room_id`) num canal só; `useRoundClues` assina `round_clues` (por `round_id`) num segundo canal |
| Auth — Anonymous sign-ins | Identidade sem cadastro. `ensureAnonSession()` chama `signInAnonymously()` no primeiro acesso e reconfirma a sessão salva com `getUser()` (não só `getSession()`) a cada execução do app |
| RPC (PostgREST) | Toda ação de jogo, via `src/lib/game/actions.ts` — as funções SQL são a API |

### RLS — quem protege o jogo não é a chave, é a política

A `anon key` em `EXPO_PUBLIC_SUPABASE_ANON_KEY` **é pública por design** — o prefixo `EXPO_PUBLIC_` garante isso, o Expo inlina o valor no bundle do cliente (equivalente ao `NEXT_PUBLIC_` do Next). Quem protege o jogo é a Row Level Security no Postgres, não o sigilo dessa chave: `player_cards` só devolve a linha do próprio `auth.uid()`, `votes` não tem `SELECT` nenhum para o cliente, `rounds` (onde o segredo bruto mora) não tem grant nenhum.

**Nenhuma `SERVICE_ROLE_KEY` entra neste app** (regra 4 do `AGENTS.md`). Se um dia aparecer uma variável desse tipo em qualquer `.env`/`app.config.ts` deste repositório, é sinal de que uma regra de jogo escapou do banco para o cliente — não uma otimização legítima.

### Diferenças do cliente RN em relação ao cliente web

`src/lib/supabase/client.ts` documenta três, todas obrigatórias em React Native (não op­cionais, não estilo de código):

1. **`storage: AsyncStorage`** em vez de `localStorage` (que não existe em RN) — sem isso o GoTrue não tem onde persistir sessão, e cada abertura do app criaria um usuário anônimo novo, perdendo o vínculo com `players.user_id` da sala em que o jogador já estava.
2. **`detectSessionInUrl: false`** — não existe URL de callback num app nativo; deixar ligado faz o GoTrue procurar um fragmento de hash que nunca chega.
3. **`autoRefreshToken` amarrado ao `AppState`** (`startAutoRefreshBridge`) — o timer de refresh do GoTrue não roda com o app em segundo plano (o SO suspende timers de JS), então sem essa ponte um celular que ficou 40 minutos no bolso volta com token expirado e a primeira RPC falha por 401 — o que na tela parece "o jogo travou", não "sessão vencida".

### Variáveis de ambiente

| Variável | Onde | Nota |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `.env`, lido via `app.config.ts` → `Constants.expoConfig.extra` | Pública |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | idem | Pública — segurança vem de RLS, não do sigilo da chave |

`app.config.ts` é `.ts`, não `.json`, exatamente para poder ler `process.env` nesses dois campos — em dev vêm do `.env` (via `dotenv` implícito do Expo), em build EAS vêm das variáveis do perfil configurado no EAS.

### Setup manual obrigatório no dashboard (compartilhado com o web)

1. **Authentication → Sign In / Providers → Anonymous sign-ins: ON.** Sem isso, `signInAnonymously()` retorna 422 e ninguém entra em sala — em qualquer um dos dois apps.
2. Confirmar que `rooms`, `players` e `round_clues` estão na publication `supabase_realtime` (as migrations do web já fazem isso).

### Aplicar o schema

Não se faz a partir deste repositório — não há CLI do Supabase nem pasta `supabase/` aqui. A partir de `../impostor`:

```bash
npx supabase link --project-ref <ref>
npx supabase db push
```

### Gerar tipos após mudar o schema

Também a partir do web (que é o dono do schema); o resultado é copiado para cá:

```bash
npx supabase gen types typescript --local > src/lib/supabase/database.types.ts
```

## EAS (Expo Application Services)

`app.config.ts` já declara `eas.projectId` (fixo, não vindo de `process.env` — ver comentário no próprio arquivo sobre por que isso amarra o repositório a um projeto EAS específico) e `owner`. Nenhum build EAS foi gerado até 2026-09-03 (ver `.specs/project/STATE.md`). Quando existir, os segredos de assinatura e as variáveis de ambiente de build vivem no perfil do EAS, não neste repositório.

## Não integrado (e por quê)

- **Push notification:** fora de escopo do porte (ver `.specs/project/PROJECT.md`) — o app não avisa nada fora de si mesmo; a vibração já cobre "chegou sua vez" enquanto o app está aberto.
- **Analytics / Sentry:** projeto pessoal de estudos, sem necessidade nesta fase — mesma decisão do web.
- **Serviço de WebSocket dedicado:** Supabase Realtime já resolve, e um segundo canal criaria uma segunda fonte de verdade.
