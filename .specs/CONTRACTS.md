# Contratos das peças compartilhadas

Este arquivo é o **contrato entre agentes**: quem implementa a peça segue a
assinatura daqui à letra, e quem consome escreve contra ela antes de a peça
existir. Divergir de uma assinatura aqui quebra outras telas.

Se um contrato estiver errado, **avise em vez de mudar sozinho** — a mudança tem
que valer para todos os consumidores ao mesmo tempo.

Todos os caminhos usam o alias `@/` → `src/`.

---

## `@/theme/colors` — já existe

```ts
export const colors: {
  background: string; backgroundMid: string; foreground: string
  card: string; cardForeground: string; popover: string; popoverForeground: string
  primary: string; primaryForeground: string
  secondary: string; secondaryForeground: string
  muted: string; mutedForeground: string
  accent: string; accentForeground: string
  destructive: string; destructiveForeground: string
  border: string; input: string; ring: string
  violet: string; violetSoft: string; accentSoft: string; accentDeep: string
  warn: string; info: string
}

/** Translúcidos em rgba: `alpha.primary40`, `alpha.danger15`, `alpha.violet30`… */
export const alpha: Record<string, string>
export const backgroundGradient: readonly [string, string, string]
export const AVATAR_FALLBACK: string
```

## `@/theme/tokens` — já existe

```ts
export const radius: { sm; md; lg; xl; '2xl'; '3xl'; '4xl'; full }        // números px
export const space: { 0;1;1.5;2;2.5;3;4;5;6;7;8;10;12;16;20 }            // números px
export const font: { xs;sm;base;lg;xl;'2xl';'3xl';'4xl';'5xl';'6xl';'7xl' }
                                        // { fontSize, lineHeight }, espalhe com `...font.lg`
export const weight: { normal;medium;semibold;bold;black }               // string de fontWeight
export const TOUCH_TARGET: number       // 48
export const ACTION_HEIGHT: number      // 56 — altura da ação primária
export const glows: { primary; primaryStrong; violet; danger; none }     // estilo de sombra
export const washes: { primary; violet; danger }  // { colors, start, end, locations } p/ LinearGradient
export const motion: { spring; springSnappy; springSoft; fast; base; slow }
export const tracking: { eyebrow; wide; code }   // letterSpacing
```

## `@/lib/haptics` — já existe

```ts
export const haptics: {
  tap(): void       // alvo secundário
  select(): void    // seleção mudou (aba, suspeito, opção)
  press(): void     // ação primária confirmada
  thud(): void      // algo pesado (card revelado, eliminação)
  success(): void   // deu certo
  warn(): void      // aviso sem falha (prazo acabando)
  error(): void     // deu errado (regra, expulsão, tempo esgotado)
  tick(): void      // tique de contagem
  soft(): void      // revelação progressiva
  suspense(): void  // 3 pulsos crescentes (drumroll)
  fanfare(): void   // vitória
  defeat(): void    // derrota
}
```

Nunca `await`. Nunca dentro de worklet (`runOnJS` primeiro).

## `@/lib/supabase/client` — já existe

```ts
export function getSupabaseClient(): SupabaseClient<Database>
export function ensureAnonSession(): Promise<Session | null>
```

---

## Onda 1 — camada de dados (agente `dados`)

### `@/lib/types`

Reexporta os tipos do banco. Cópia fiel de `../impostor/src/lib/types.ts`:

```ts
export type Room, Player, PlayerCard, Word, RoundClue
export type RoomStatus, GameOutcome, WordCategory
export type JoinResult = { room_id: string; player_id: string; code: string }
export type ClueResult = { ok: boolean; reason?: 'PROFANITY'; strikes?: number; kicked?: boolean; word?: string }
export type GuessResult = { correct: boolean; word: string }
export type VoteTally = { cycle: number; skip: number; top: number; players: Record<string, number> }
export const CATEGORY_LABELS: Record<WordCategory, string>
export const OUTCOME_LABELS: Record<GameOutcome, string>
```

### `@/lib/game/actions`

Uma função por RPC, nada mais. Assinaturas idênticas ao web:

```ts
createRoom(name: string): Promise<JoinResult>
joinRoom(code: string, name: string): Promise<JoinResult>
startGame(roomId: string): Promise<void>
confirmWordSeen(roomId: string): Promise<void>
openVoting(roomId: string): Promise<void>
castVote(roomId: string, targetPlayerId: string | null): Promise<void>   // null = pular
submitClue(roomId: string, word: string): Promise<ClueResult>
expireClueTurn(roomId: string): Promise<void>
nextClueRound(roomId: string): Promise<void>
submitGuess(roomId: string, word: string): Promise<GuessResult>
expireLastChance(roomId: string): Promise<void>
playAgain(roomId: string): Promise<void>
leaveRoom(roomId: string): Promise<void>
closeRoom(roomId: string): Promise<void>
```

### `@/lib/game/errors`

```ts
export const GAME_ERROR_CODES: { FORBIDDEN:'IM001'; WRONG_PHASE:'IM002'; NOT_FOUND:'IM003'; INVALID_INPUT:'IM004'; CONFLICT:'IM005' }
export type GameErrorCode
export function toDisplayError(error: unknown): string
export function isGameRuleError(error: unknown, code?: GameErrorCode): boolean
```

### `@/lib/game/clue`

```ts
export const CLUE_MIN_LENGTH: 2
export const CLUE_MAX_LENGTH: 20
export function normalizeClue(raw: string): string
export function isValidClue(raw: string): boolean
export function clueProblem(raw: string): string | null   // null = válida
```

### `@/lib/game/room-code`

```ts
export const ROOM_CODE_ALPHABET: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const ROOM_CODE_LENGTH: 4
export const NICKNAME_MAX_LENGTH: 20
export function normalizeRoomCode(raw: string): string
export function isValidRoomCode(raw: string): boolean
export function normalizeNickname(raw: string): string
export function isValidNickname(raw: string): boolean
```

### Hooks

```ts
// @/hooks/useGameAccess
export function useAnonSession(): { userId: string | null; ready: boolean; error: string | null }
export function useRoomIdFromCode(code: string, enabled: boolean):
  { roomId: string | null; loading: boolean; isMember: boolean }

// @/hooks/useRoomChannel
export function useRoomChannel(roomId: string | null): {
  room: Room | null; players: Player[]
  loading: boolean; connected: boolean; error: string | null
}

// @/hooks/useMyCard
export function useMyCard(roundId: string | null, playerId: string | null):
  { card: PlayerCard | null; loading: boolean }

// @/hooks/useRoundClues
export function useRoundClues(roundId: string | null): RoundClue[]
```

---

## Onda 1 — primitivas e peças visuais (agente `ui`)

### `@/components/ui/Text`

```tsx
type AppTextProps = RNTextProps & {
  variant?: 'eyebrow' | 'title' | 'subtitle' | 'body' | 'label' | 'caption' | 'display'
  tone?: 'default' | 'muted' | 'primary' | 'danger' | 'violet' | 'warn' | 'onPrimary'
  weight?: keyof typeof weight
  align?: 'left' | 'center' | 'right'
  /** Números de código e placar alinhados em coluna (`font-variant-numeric`). */
  tabular?: boolean
}
export function AppText(props: AppTextProps): JSX.Element
```

### `@/components/ui/Button`

```tsx
type ButtonProps = {
  label: string
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'lg' | 'md'          // lg = ACTION_HEIGHT
  disabled?: boolean
  busy?: boolean              // troca conteúdo por spinner, mantém a largura
  icon?: LucideIcon           // componente de `lucide-react-native`
  glow?: boolean              // default: true em primary
  /** Vibração no toque. Default 'press'. `false` desliga. */
  haptic?: 'press' | 'tap' | 'select' | false
  fullWidth?: boolean         // default true
  style?: StyleProp<ViewStyle>
  accessibilityLabel?: string
}
export function Button(props: ButtonProps): JSX.Element
```

Comportamento: `whileTap` com spring (escala 0.97), opacidade 0.5 quando
`disabled`, vibra ANTES de chamar `onPress`.

### `@/components/ui/Input`

```tsx
type InputProps = RNTextInputProps & {
  label?: string
  invalid?: boolean
  /** Centralizado e enorme, para código de sala e dica. */
  emphasis?: 'normal' | 'code' | 'clue'
}
export function Input(props: InputProps): JSX.Element
```

Sempre `placeholderTextColor={colors.mutedForeground}` e
`selectionColor={colors.primary}` — o padrão do RN é azul de sistema e destoa.

### `@/components/ui/Card`

```tsx
type CardProps = {
  children: ReactNode
  /** Lavada diagonal + borda + glow combinando. */
  tone?: 'plain' | 'primary' | 'violet' | 'danger'
  glow?: boolean
  padded?: boolean            // default true (space[4])
  style?: StyleProp<ViewStyle>
}
export function Card(props: CardProps): JSX.Element
```

### `@/components/ui/Sheet`

Substitui o `Dialog` do web. Modal que sobe de baixo (é onde o polegar está).

```tsx
type SheetProps = {
  open: boolean
  onClose: () => void
  title?: ReactNode
  description?: ReactNode
  children: ReactNode
  /** Fechar por toque no fundo / gesto. Default true. */
  dismissable?: boolean
}
export function Sheet(props: SheetProps): JSX.Element
```

### `@/components/ui/Spinner`

```tsx
export function Spinner(props: { size?: number; color?: string }): JSX.Element
```

### `@/components/shared/PlayerAvatar`

```tsx
export function PlayerAvatar(props: {
  player: Pick<Player, 'name' | 'avatar_color'>
  size?: 'sm' | 'md' | 'lg'          // 32 / 48 / 64
  style?: StyleProp<ViewStyle>
}): JSX.Element
```

Inicial maiúscula sobre `avatar_color`, círculo, texto escuro.

### `@/components/shared/PlayerGrid`

```tsx
export function PlayerGrid(props: {
  players: Player[]
  hostPlayerId?: string | null
  myPlayerId?: string | null
  readyIds?: Set<string>
  readyLabel?: string                 // default 'pronto'
  showScore?: boolean
}): JSX.Element
```

Lista de uma coluna. Coroa (`Crown`, cor `warn`) no host, selo de pronto
(`Check`, cor `primary`), `(você)` ao lado do próprio nome, opacidade 0.4 em quem
não está `is_alive`. Entrada de jogador novo animada (`LinearTransition` /
`entering`) — a mesa vendo alguém chegar é metade da graça do lobby.

### `@/components/shared/Countdown`

```tsx
export function Countdown(props: {
  deadline: string | null       // ISO vindo do banco
  totalMs: number
  onExpire: () => void
  tone?: 'primary' | 'violet' | 'destructive'
  /** Anel em vez de barra. Default 'ring'. */
  shape?: 'ring' | 'bar'
  style?: StyleProp<ViewStyle>
}): JSX.Element
```

**Monte sempre com `key={deadline}`.** O restante inicial vem do inicializador de
estado, então prazo novo precisa de instância nova.

Regra herdada do web: o restante é calculado **uma vez** (`deadline - Date.now()`,
limitado a `totalMs`) e conta para baixo localmente. Reler o relógio a cada tique
deixaria o contador refém de celular com hora errada. Quem decide se o prazo
venceu é a função SQL.

Gamificação: nos últimos 3 segundos, `haptics.tick()` a cada segundo e o número
pulsa; o anel muda para `destructive`. Um tique só por segundo — vibrar a cada
100ms vira zumbido.

### `@/components/shared/HoldToReveal`

```tsx
export function HoldToReveal(props: {
  children: ReactNode
  holdMs?: number               // default 2000
  hint?: string                 // default 'Segure para ver'
  onReveal?: () => void
  style?: StyleProp<ViewStyle>
}): JSX.Element
```

O conteúdo **só existe na árvore enquanto pressionado** e sai ao soltar. Use
`LongPressGestureHandler`/`Gesture.LongPress` do Gesture Handler ou
`onPressIn`/`onPressOut` — mas cubra dedo escorregando para fora e chamada
entrando (`onPressOut` cobre os dois no RN).

Gamificação: `haptics.soft()` a cada ~25% do progresso e `haptics.thud()` na
revelação. Barra/anel de progresso durante a pressão.

### `@/components/shared/Screen`

Substitui a moldura do `PhaseShell` no que é estrutura de tela.

```tsx
export function Screen(props: {
  children: ReactNode
  /** Rola o conteúdo. Default true. */
  scroll?: boolean
  /** Ação fixa na base, na zona do polegar. */
  action?: ReactNode
  style?: StyleProp<ViewStyle>
  contentStyle?: StyleProp<ViewStyle>
}): JSX.Element
```

Aplica `useSafeAreaInsets()` no topo e na base, `KeyboardAvoidingView` quando há
`action` (senão o teclado cobre o botão de enviar dica), e um degradê de
`background` acima da ação para o conteúdo não colidir com ela.

### `@/components/shared/PhaseShell`

```tsx
export function PhaseShell(props: {
  eyebrow?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  children?: ReactNode
  /** Contexto secundário: mesa, placar. Empilhado abaixo do palco. */
  aside?: ReactNode
  action?: ReactNode
  scroll?: boolean
}): JSX.Element
```

Ordem: header (eyebrow/title/subtitle) → palco (`children`) → `aside` → ação na
base. No celular não existe layout de duas colunas: o `aside` do web vira seção
empilhada.

### `@/components/shared/Confetti`

```tsx
export function Confetti(props: { active: boolean; tone?: 'primary' | 'danger' }): JSX.Element
```

Partículas em Reanimated (sem lib nova). Dispara uma vez quando `active` vira
true. Só no fim de partida.

### `@/components/shared/WaitingPill`

O bloco "aguardando o host" repetido em quatro fases.

```tsx
export function WaitingPill(props: { label: string; icon?: LucideIcon }): JSX.Element
```

Altura `ACTION_HEIGHT`, fundo `card`, borda, spinner à esquerda, texto `muted`.

---

## Onda 2 — telas (agentes `home`, `lobby`, `dicas`, `desfecho`)

### `@/components/game/types`

```ts
export type PhaseProps = {
  room: Room
  players: Player[]
  me: Player          // garantido não-nulo pelo GameRoom
  isHost: boolean
}
```

### Componentes de fase

Todos recebem `PhaseProps`, mais o que a fase precisa:

```tsx
LobbyPhase(props: PhaseProps)
WordRevealPhase(props: PhaseProps & { card: PlayerCard | null })
CluePhase(props: PhaseProps & { clues: RoundClue[] })
VotingPhase(props: PhaseProps)
LastChancePhase(props: PhaseProps & { card: PlayerCard | null })
GameOverPhase(props: PhaseProps)

ClueDialog(props: {
  roomId: string
  deadline: string | null
  totalMs: number
  onExpire: () => void
  onDismiss: () => void
  open: boolean
})

RoomExitButton(props: { roomId: string; isHost: boolean })
GameRoom(props: { code: string })
HomeScreen(props: {})
```
