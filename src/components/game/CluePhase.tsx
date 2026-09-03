import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { FadeInDown, LinearTransition, ZoomIn } from 'react-native-reanimated'
import { Ban, MessagesSquare, PencilLine, RotateCcw, Vote } from 'lucide-react-native'
import { AppText } from '@/components/ui/Text'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PhaseShell } from '@/components/shared/PhaseShell'
import { PlayerGrid } from '@/components/shared/PlayerGrid'
import { PlayerAvatar } from '@/components/shared/PlayerAvatar'
import { Countdown } from '@/components/shared/Countdown'
import { WaitingPill } from '@/components/shared/WaitingPill'
import { ClueDialog } from '@/components/game/ClueDialog'
import { expireClueTurn, nextClueRound, openVoting } from '@/lib/game/actions'
import { toDisplayError } from '@/lib/game/errors'
import { countOf } from '@/lib/plural'
import { haptics } from '@/lib/haptics'
import { alpha, colors } from '@/theme/colors'
import { radius, space } from '@/theme/tokens'
import type { PhaseProps } from '@/components/game/types'
import type { Player, RoundClue, VoteTally } from '@/lib/types'

/**
 * Espelha `clue_turn_seconds` no banco: 15s para o primeiro da ordem (não tem
 * dica anterior para ler) e 20s para os seguintes, que na mesa é também o tempo
 * de comentar a dica que acabou de aparecer.
 */
function turnTotalMs(turnIndex: number) {
  return turnIndex === 0 ? 15_000 : 20_000
}

type CluePhaseProps = PhaseProps & {
  clues: RoundClue[]
}

/**
 * Fase de dicas escritas. (IMP-30 a IMP-37)
 *
 * A fase tem ritmo, mas não gerencia a conversa: enquanto o contador do próximo
 * corre, a mesa comenta à vontade. É isso que faz o mesmo fluxo servir
 * presencial e remoto (AGENTS.md regra 6) — nada aqui pede que alguém fale, nem
 * cronometra a discussão.
 *
 * Adaptações do web para RN que valem registrar:
 * - A lista de dicas usa `entering={FadeInDown}` por linha e
 *   `layout={LinearTransition}` no container, para a dica nova aparecer e os
 *   vizinhos abrirem espaço, em vez do `AnimatePresence`/`motion.li` do web.
 * - A palavra em si ganha `ZoomIn` só quando a linha passa de "aguardando" para
 *   respondida — a linha (com a `key` do jogador) não remonta nessa transição,
 *   então precisa da própria animação de entrada.
 * - Vibração: `haptics.suspense()` na transição para "chegou a sua vez" (o uso
 *   mais importante do app inteiro — o celular está na mesa, a pessoa olha para
 *   os amigos, não para a tela); `haptics.tap()` quando a dica de OUTRO jogador
 *   aparece; `haptics.error()` ao expirar um turno sem palavra. `haptics.success()`
 *   e `haptics.error()` do envio da dica vivem em `ClueDialog`, perto do
 *   resultado que os motiva.
 */
export function CluePhase({ room, players, me, isHost, clues }: CluePhaseProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /**
   * Turno em que o jogador fechou o popup para consultar a mesa.
   *
   * Guarda QUAL turno foi dispensado, não um booleano: um booleano continuaria
   * verdadeiro no turno seguinte, e o popup deixaria de abrir sozinho na
   * próxima vez da pessoa. Derivar por comparação evita ter que limpar dentro
   * de efeito.
   */
  const [dismissedTurn, setDismissedTurn] = useState<string | null>(null)
  const expireRequested = useRef<string | null>(null)
  const wasMyTurn = useRef(false)
  const seenAnsweredIds = useRef<Set<string> | null>(null)

  const byId = useMemo(() => new Map(players.map((player) => [player.id, player])), [players])
  const roundClues = useMemo(
    () => clues.filter((clue) => clue.discussion_round === room.discussion_round),
    [clues, room.discussion_round],
  )
  const previous = useMemo(
    () => clues.filter((clue) => clue.discussion_round < room.discussion_round),
    [clues, room.discussion_round],
  )

  const myClue = roundClues.find((clue) => clue.player_id === me.id)
  const currentClue = roundClues.find((clue) => clue.turn_index === room.clue_turn_index)
  const currentPlayer = currentClue ? byId.get(currentClue.player_id) : undefined

  // O banco zera `turn_deadline` quando não há mais turno a cumprir.
  const turnsDone = room.turn_deadline === null
  const isMyTurn = !turnsDone && myClue?.turn_index === room.clue_turn_index
  const tally = room.last_vote_tally as VoteTally | null

  const turnKey = `${room.discussion_round}:${room.clue_turn_index}`
  const dismissed = dismissedTurn === turnKey

  /**
   * O Postgres não dispara nada sozinho: quem fecha o turno vencido é um
   * cliente cujo contador zerou. A função é idempotente, então todos chamando
   * é inofensivo — o ref só evita repetir a chamada DESTE aparelho para o
   * MESMO prazo (um turno novo tem prazo novo e pode ser expirado de novo).
   */
  const handleExpire = useCallback(() => {
    const deadline = room.turn_deadline
    if (!deadline || expireRequested.current === deadline) return
    expireRequested.current = deadline
    // `error` e não `warn`: pelo vocabulário de `lib/haptics.ts`, "tempo esgotado
    // sem resposta" é falha. O turno foi perdido e não volta — quem estava
    // escrevendo precisa sentir que acabou, não que está acabando.
    haptics.error()
    void expireClueTurn(room.id).catch(() => {
      // Outro cliente chegou primeiro. O Realtime traz o turno seguinte.
    })
  }, [room.id, room.turn_deadline])

  // Chegou a SUA vez: a vibração mais importante do app inteiro. Só na
  // TRANSIÇÃO (comparada por ref), nunca a cada render — do contrário
  // qualquer novo render enquanto ainda é minha vez vibraria de novo.
  useEffect(() => {
    if (isMyTurn && !wasMyTurn.current) {
      haptics.suspense()
    }
    wasMyTurn.current = isMyTurn
  }, [isMyTurn])

  // Dica de outro jogador aparecendo na mesa: um toque curto. A primeira
  // leitura (montagem da fase) só registra o que já está na mesa sem vibrar —
  // senão entrar na fase com dicas já dadas vibraria por todas de uma vez.
  useEffect(() => {
    const answeredByOthers = new Set(
      roundClues
        .filter((clue) => clue.word !== null && clue.player_id !== me.id)
        .map((clue) => clue.player_id),
    )

    if (seenAnsweredIds.current === null) {
      seenAnsweredIds.current = answeredByOthers
      return
    }

    const previouslySeen = seenAnsweredIds.current
    const hasNewClue = [...answeredByOthers].some((id) => !previouslySeen.has(id))
    if (hasNewClue) haptics.tap()
    seenAnsweredIds.current = answeredByOthers
  }, [roundClues, me.id])

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(toDisplayError(err))
    } finally {
      setBusy(false)
    }
  }

  // Expulso por faltas (IMP-34) ou fora da partida: sem turno, mas continua vendo.
  if (!me.is_alive) {
    return (
      <PhaseShell
        eyebrow={`Rodada ${room.discussion_round}`}
        title="Você está fora desta partida"
        subtitle="Continua acompanhando as dicas, mas sem turno para escrever."
        aside={<Mesa room={room} players={players} me={me} />}
      >
        <Card tone="danger" style={styles.expelledCard}>
          <Ban size={40} color={colors.destructive} />
          <AppText tone="muted" align="center" style={styles.expelledText}>
            Palavras vulgares foram usadas três vezes nesta sala com o seu nome.
          </AppText>
        </Card>

        <ClueBoard
          roundClues={roundClues}
          previous={previous}
          byId={byId}
          currentTurnIndex={room.clue_turn_index}
          turnsDone={turnsDone}
        />
      </PhaseShell>
    )
  }

  const title = turnsDone
    ? 'Todos deram a dica'
    : isMyTurn
      ? 'Sua vez de dar a dica'
      : `Vez de ${currentPlayer?.name ?? '…'}`

  const subtitle = turnsDone
    ? isHost
      ? 'Você decide: mais uma rodada de dicas, ou já para a votação.'
      : 'O host decide se vem outra rodada de dicas ou a votação.'
    : 'Enquanto o contador corre, comentem as dicas à vontade — o app não interrompe.'

  return (
    <>
      {isMyTurn && (
        // `key` no turno: input, erro e faltas são estado local do popup e
        // precisam nascer limpos a cada vez (ver cabeçalho de `ClueDialog`).
        <ClueDialog
          key={turnKey}
          roomId={room.id}
          deadline={room.turn_deadline}
          totalMs={turnTotalMs(room.clue_turn_index)}
          onExpire={handleExpire}
          onDismiss={() => setDismissedTurn(turnKey)}
          open={!dismissed}
        />
      )}

      <PhaseShell
        eyebrow={`Rodada ${room.discussion_round}`}
        title={title}
        subtitle={subtitle}
        aside={<Mesa room={room} players={players} me={me} />}
        action={
          turnsDone ? (
            isHost ? (
              <View style={styles.hostActions}>
                {error && (
                  <AppText
                    tone="danger"
                    weight="medium"
                    variant="label"
                    accessibilityRole="alert"
                  >
                    {error}
                  </AppText>
                )}
                <Button
                  label="Abrir votação"
                  icon={Vote}
                  size="lg"
                  busy={busy}
                  disabled={busy}
                  onPress={() => void run(() => openVoting(room.id))}
                />
                <Button
                  label="Nova rodada de dicas"
                  icon={RotateCcw}
                  variant="secondary"
                  size="md"
                  disabled={busy}
                  onPress={() => void run(() => nextClueRound(room.id))}
                />
              </View>
            ) : (
              <WaitingPill label="Aguardando a decisão do host" />
            )
          ) : isMyTurn ? (
            /*
             * Fechar o popup para ler a mesa não pode custar a noção de tempo. O
             * `Countdown` vive DENTRO do `ClueDialog`, então ele desmonta junto —
             * e com ele os tiques de vibração dos 3 segundos finais. Sem esta
             * contagem aqui, o primeiro sinal de que o turno acabou seria o
             * `haptics.error()` do expirar, quando já não há o que fazer.
             *
             * Barra e não anel: aqui a contagem acompanha um botão, não é o
             * assunto da tela.
             */
            <View style={styles.myTurnAction}>
              <Countdown
                key={room.turn_deadline ?? 'sem-prazo'}
                deadline={room.turn_deadline}
                totalMs={turnTotalMs(room.clue_turn_index)}
                onExpire={handleExpire}
                shape="bar"
              />
              <Button
                label="Escrever minha palavra"
                icon={PencilLine}
                size="lg"
                onPress={() => setDismissedTurn(null)}
              />
            </View>
          ) : (
            <Card style={styles.writingCard}>
              {currentPlayer && (
                <View style={styles.writingRow}>
                  <PlayerAvatar player={currentPlayer} size="sm" />
                  <AppText weight="semibold">{currentPlayer.name}</AppText>
                  <AppText tone="muted">está escrevendo…</AppText>
                </View>
              )}
              <Countdown
                key={room.turn_deadline ?? 'sem-prazo'}
                deadline={room.turn_deadline}
                totalMs={turnTotalMs(room.clue_turn_index)}
                onExpire={handleExpire}
              />
            </Card>
          )
        }
      >
        <ClueBoard
          roundClues={roundClues}
          previous={previous}
          byId={byId}
          currentTurnIndex={room.clue_turn_index}
          turnsDone={turnsDone}
        />

        {/* Só depois de um ciclo indeciso: explica POR QUE a mesa voltou às
            dicas. */}
        {room.discussion_round > 1 && tally && (
          <Card>
            <AppText weight="semibold">Votação anterior</AppText>
            <AppText tone="muted" style={styles.previousVoteText}>
              {tally.skip >= tally.top
                ? `A maioria preferiu pular (${countOf(tally.skip, 'voto', 'votos')}). Ninguém foi eliminado.`
                : 'Houve empate no topo. Ninguém foi eliminado.'}
            </AppText>
          </Card>
        )}
      </PhaseShell>
    </>
  )
}

function Mesa({ room, players, me }: Pick<CluePhaseProps, 'room' | 'players' | 'me'>) {
  return (
    <View>
      <AppText variant="title" weight="semibold" style={styles.mesaHeading}>
        Na mesa
      </AppText>
      <PlayerGrid
        players={players}
        hostPlayerId={room.host_player_id}
        myPlayerId={me.id}
        showScore={room.games_played > 0}
      />
    </View>
  )
}

type ClueBoardProps = {
  roundClues: RoundClue[]
  previous: RoundClue[]
  byId: Map<string, Player>
  currentTurnIndex: number
  turnsDone: boolean
}

/** Ordem sorteada e dicas dadas, com as rodadas anteriores acumuladas (IMP-37). */
function ClueBoard({ roundClues, previous, byId, currentTurnIndex, turnsDone }: ClueBoardProps) {
  const previousRounds = useMemo(
    () => [...new Set(previous.map((clue) => clue.discussion_round))].sort((a, b) => a - b),
    [previous],
  )

  return (
    <View style={styles.board}>
      {roundClues.length === 0 ? (
        <Card style={styles.emptyCard}>
          <MessagesSquare size={16} color={colors.mutedForeground} />
          <AppText tone="muted">Sorteando a ordem…</AppText>
        </Card>
      ) : (
        <View style={styles.clueList}>
          {roundClues.map((clue) => {
            const player = byId.get(clue.player_id)
            const isNow = !turnsDone && clue.turn_index === currentTurnIndex
            const answered = clue.word !== null
            const faded = !answered && !isNow && !clue.timed_out

            return (
              <Animated.View key={clue.player_id} entering={FadeInDown} layout={LinearTransition}>
                <Card
                  tone={isNow ? 'primary' : 'plain'}
                  glow={isNow}
                  style={faded ? styles.clueCardFaded : undefined}
                >
                  <View style={styles.clueRow}>
                    <AppText tabular tone="muted" weight="bold" style={styles.clueIndex}>
                      {clue.turn_index + 1}
                    </AppText>

                    {player && <PlayerAvatar player={player} size="sm" />}

                    <AppText weight="medium" numberOfLines={1} style={styles.clueName}>
                      {player?.name ?? 'Jogador'}
                    </AppText>

                    {answered ? (
                      <Animated.View entering={ZoomIn} style={styles.clueWordWrap}>
                        <AppText tone="primary" weight="bold" numberOfLines={1}>
                          {clue.word}
                        </AppText>
                      </Animated.View>
                    ) : clue.timed_out ? (
                      <AppText tone="muted" variant="caption">
                        sem palavra
                      </AppText>
                    ) : isNow ? (
                      <AppText tone="primary" variant="caption" weight="semibold">
                        escrevendo…
                      </AppText>
                    ) : (
                      <AppText tone="muted" variant="caption">
                        aguardando
                      </AppText>
                    )}
                  </View>
                </Card>
              </Animated.View>
            )
          })}
        </View>
      )}

      {/* Rodadas anteriores continuam visíveis: é sobre o acumulado que a mesa
          desconfia. (IMP-37) */}
      {previousRounds.map((roundNumber) => (
        <View key={roundNumber} style={styles.previousRound}>
          <AppText variant="eyebrow" tone="muted" weight="semibold">
            Rodada {roundNumber}
          </AppText>
          <View style={styles.previousChips}>
            {previous
              .filter((clue) => clue.discussion_round === roundNumber)
              .map((clue) => (
                <View key={`${roundNumber}:${clue.player_id}`} style={styles.previousChip}>
                  <AppText tone="muted" variant="caption">
                    {byId.get(clue.player_id)?.name ?? '—'}
                  </AppText>
                  <AppText weight="semibold">{clue.word ?? '—'}</AppText>
                </View>
              ))}
          </View>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  mesaHeading: {
    marginBottom: space[3],
  },
  hostActions: {
    gap: space[2],
  },
  myTurnAction: {
    gap: space[3],
  },
  writingCard: {
    alignItems: 'center',
    gap: space[3],
  },
  writingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  expelledCard: {
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[8],
  },
  expelledText: {
    maxWidth: 260,
  },
  previousVoteText: {
    marginTop: space[1],
  },
  board: {
    gap: space[5],
  },
  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    paddingVertical: space[8],
  },
  clueList: {
    gap: space[2],
  },
  clueCardFaded: {
    opacity: 0.5,
  },
  clueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  clueIndex: {
    width: space[5],
    textAlign: 'center',
  },
  clueName: {
    flex: 1,
    minWidth: 0,
  },
  /**
   * A dica é o conteúdo da linha, não um adorno: ela não pode ser comprimida
   * para caber ao lado do nome.
   *
   * O limite e o `flexShrink: 0` vivem no INVÓLUCRO, não no texto. Duas razões:
   * porcentagem em RN resolve contra a largura do pai, e o `Animated.View` não
   * tem largura própria — `maxWidth: '45%'` aplicado no texto resolvia contra um
   * pai sem medida e colapsava a palavra em "p…". E sem `flexShrink: 0` o
   * invólucro encolhe antes do nome (todo filho de flex encolhe por padrão),
   * então quem cede espaço passava a ser a dica em vez do nome — o contrário do
   * que a tela precisa. Quem trunca é o nome, com `flex: 1`.
   */
  clueWordWrap: {
    flexShrink: 0,
    maxWidth: '45%',
  },
  previousRound: {
    gap: space[2],
  },
  previousChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  previousChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    backgroundColor: alpha.card60,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    paddingHorizontal: space[3],
    paddingVertical: space[1.5],
  },
})
