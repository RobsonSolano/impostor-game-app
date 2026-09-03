# Estrutura de diretórios

Árvore real, checada em 2026-09-03.

```
.
├── .specs/                      # Fonte de verdade de planejamento (este conjunto de docs)
│   ├── CONTRACTS.md             # Assinaturas das peças compartilhadas — contrato entre agentes
│   ├── project/                 # PROJECT.md, STATE.md
│   └── codebase/                # STACK, ARCHITECTURE, CONVENTIONS, STRUCTURE, TESTING, INTEGRATIONS, CONCERNS
│
├── app/                         # Rotas do expo-router (arquivo = rota)
│   ├── _layout.tsx              # Shell: gradiente de fundo, tema de navegação, gesture root, splash, status bar
│   ├── index.tsx                # Rota inicial ("/") — monta HomeScreen
│   └── sala/
│       └── [code].tsx           # Rota da partida inteira ("/sala/CODE") — valida o código e monta GameRoom
│
├── assets/                      # Ícones (iOS/Android/adaptativo) e splash screen
│
├── src/
│   ├── components/
│   │   ├── game/                # Uma tela por fase da máquina de estados + orquestrador
│   │   │   ├── GameRoom.tsx     # Resolve sessão/sala, assina Realtime, faz o switch por rooms.status
│   │   │   ├── HomeScreen.tsx   # Criar sala / entrar com código
│   │   │   ├── LobbyPhase.tsx
│   │   │   ├── WordRevealPhase.tsx
│   │   │   ├── CluePhase.tsx    # Fase DISCUSSION — turnos de dica com prazo
│   │   │   ├── ClueDialog.tsx   # Popup de escrever a dica, aberto por CluePhase
│   │   │   ├── VotingPhase.tsx
│   │   │   ├── LastChancePhase.tsx
│   │   │   ├── GameOverPhase.tsx
│   │   │   ├── RoomExitButton.tsx  # "Sair"/"Encerrar", flutuante em toda fase
│   │   │   ├── types.ts         # PhaseProps — contrato comum de toda tela de fase
│   │   │   └── __tests__/
│   │   │
│   │   ├── shared/               # Peças reaproveitadas entre fases, sem regra de jogo própria
│   │   │   ├── Screen.tsx        # Moldura estrutural: safe area, scroll, KeyboardAvoidingView, ação fixa
│   │   │   ├── PhaseShell.tsx    # header (eyebrow/title/subtitle) → palco → aside → ação
│   │   │   ├── PlayerGrid.tsx    # Roster da mesa (coroa do host, selo de pronto, "(você)")
│   │   │   ├── PlayerAvatar.tsx  # Bolha de avatar (inicial sobre avatar_color do banco)
│   │   │   ├── Countdown.tsx     # Contagem regressiva de um prazo do banco (anel ou barra)
│   │   │   ├── HoldToReveal.tsx  # O card secreto — regra 8 do AGENTS.md
│   │   │   ├── WaitingPill.tsx   # "Aguardando o host…", repetido em quatro fases
│   │   │   ├── Confetti.tsx      # Chuva de confete no fim de partida vencida
│   │   │   └── __tests__/
│   │   │
│   │   └── ui/                   # Primitivas visuais sem conhecimento de regra de jogo
│   │       ├── Text.tsx          # AppText — única porta para texto no app
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       ├── Card.tsx
│   │       ├── Sheet.tsx         # Modal que sobe de baixo — substitui o Dialog do web
│   │       ├── Badge.tsx
│   │       ├── Spinner.tsx
│   │       └── __tests__/
│   │
│   ├── hooks/
│   │   ├── useGameAccess.ts      # useAnonSession, useRoomIdFromCode
│   │   ├── useRoomChannel.ts     # Assina rooms + players num canal só
│   │   ├── useMyCard.ts          # Busca player_cards por fase, sem Realtime (de propósito)
│   │   ├── useRoundClues.ts      # Busca + assina round_clues (com Realtime)
│   │   └── __tests__/
│   │
│   ├── lib/
│   │   ├── haptics.ts            # Vocabulário de vibração por intenção
│   │   ├── plural.ts             # Concordância de plural/verbo em PT-BR
│   │   ├── types.ts              # Reexporta tipos do banco + tipos de retorno de RPC
│   │   ├── game/
│   │   │   ├── actions.ts        # Uma função por RPC — camada fina, sem regra de jogo
│   │   │   ├── clue.ts           # Validação de formato da dica (espelha is_valid_clue do banco)
│   │   │   ├── errors.ts         # Códigos de erro IM001–IM005 → mensagem exibível
│   │   │   ├── room-code.ts      # Normalização/validação de código de sala e nickname
│   │   │   └── __tests__/
│   │   ├── supabase/
│   │   │   ├── client.ts         # Cliente singleton, sessão anônima, ponte de AppState
│   │   │   └── database.types.ts # GERADO — supabase gen types (no repositório web)
│   │   └── __tests__/            # Testes de haptics.ts
│   │
│   └── theme/
│       ├── colors.ts              # Paleta — mesmos valores de globals.css no web
│       ├── tokens.ts              # Raio, espaço, fonte, peso, glow, motion, tracking
│       └── navigation.ts          # Tema escuro explícito do expo-router (ver ARCHITECTURE.md)
│
├── AGENTS.md                     # As 11 regras invioláveis
├── app.config.ts                 # Config do Expo — .ts porque credenciais vêm de process.env
├── jest.config.js / jest.setup.js
└── tsconfig.json
```

## Onde colocar o quê

| Preciso de... | Vai em |
|---|---|
| Nova regra de jogo | **Não vai neste repositório.** Função SQL + teste pgTAP em `../impostor/supabase/` |
| Nova fase da partida | `src/components/game/` + case novo no switch de `GameRoom.tsx` |
| Peça reaproveitada entre fases (sem regra de jogo) | `src/components/shared/` |
| Primitiva visual genérica (sem conhecer `Room`/`Player`) | `src/components/ui/` |
| Lógica pura testável (validação, formatação, código de sala) | `src/lib/game/` ou `src/lib/` + teste Jest |
| Nova intenção de vibração | Uma função nova em `src/lib/haptics.ts` — nunca `Haptics.impactAsync` direto na tela |
| Cor, raio, espaço, fonte nova | `src/theme/` — nunca valor solto na tela |
| Assinatura de peça reaproveitada entre agentes | Conferir/atualizar `.specs/CONTRACTS.md` antes de implementar |

## Ausências deliberadas

- **`supabase/`** não existe neste repositório. O schema é do web (`../impostor/supabase/`) — ver `.specs/project/STATE.md`.
- **`src/app/`** (nome usado no web) não existe aqui — o expo-router usa `app/` na raiz do projeto, não dentro de `src/`.
- Não há diretório de "server" (`src/lib/supabase/server.ts` do web) — não existe Server Component nem cookie de sessão no cliente RN; a sessão vive em `AsyncStorage` via o mesmo cliente singleton usado em qualquer tela.
