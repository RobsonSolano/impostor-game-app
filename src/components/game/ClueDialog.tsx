import { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { TriangleAlert } from 'lucide-react-native'
import { AppText } from '@/components/ui/Text'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Sheet } from '@/components/ui/Sheet'
import { Countdown } from '@/components/shared/Countdown'
import { submitClue } from '@/lib/game/actions'
import { CLUE_MAX_LENGTH, clueProblem, isValidClue, normalizeClue } from '@/lib/game/clue'
import { toDisplayError } from '@/lib/game/errors'
import { haptics } from '@/lib/haptics'
import { colors } from '@/theme/colors'
import { space } from '@/theme/tokens'

type ClueDialogProps = {
  roomId: string
  deadline: string | null
  totalMs: number
  onExpire: () => void
  /** Fechado pelo jogador para consultar as dicas anteriores. */
  onDismiss: () => void
  open: boolean
}

/**
 * Popup de escrever a dica. (IMP-31 a IMP-34)
 *
 * **Monte com `key` no turno** (feito por quem chama, em `CluePhase`): input,
 * erro e faltas são estado local, e um turno novo precisa começar limpo. Sem a
 * key, a mensagem de palavrão do turno anterior apareceria no seguinte.
 *
 * É dispensável de propósito: para escolher uma boa dica a pessoa precisa poder
 * olhar as dicas que já estão na mesa. Fechar não desiste do turno — o prazo
 * continua correndo e o botão de reabrir fica na ação da tela (`CluePhase`
 * decide isso, este componente só avisa via `onDismiss`).
 *
 * Repare que este componente NÃO recebe a palavra secreta como prop. Isso é de
 * propósito (IMP-33, AGENTS.md regra 7): sem o segredo em mãos, é estruturalmente
 * impossível comparar a dica com ele aqui — a validação de formato
 * (`clueProblem`/`isValidClue`) é a única checagem no cliente, e o aviso abaixo é
 * preventivo, nunca um bloqueio.
 */
export function ClueDialog({
  roomId,
  deadline,
  totalMs,
  onExpire,
  onDismiss,
  open,
}: ClueDialogProps) {
  const [word, setWord] = useState('')
  const [busy, setBusy] = useState(false)
  const [profanity, setProfanity] = useState<{ strikes: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const problem = word.length > 0 ? clueProblem(word) : null
  const canSubmit = isValidClue(word) && !busy

  async function send() {
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    setProfanity(null)

    try {
      const result = await submitClue(roomId, normalizeClue(word))

      if (!result.ok && result.reason === 'PROFANITY') {
        // Palavra vulgar volta como resposta (`ok: false`), não como exceção: o
        // banco precisa PERSISTIR a falta, e uma exceção em plpgsql desfaria o
        // incremento junto com a transação. Por isso este ramo NÃO passa pelo
        // `catch` — é resultado, não erro técnico.
        //
        // A falta já está gravada no banco. Se o jogador foi expulso, o
        // Realtime traz o novo estado (`is_alive: false`) e esta tela sai de
        // cena por conta própria — não navegamos à mão.
        // `warn` e não `error`: pelo vocabulário de `lib/haptics.ts`, isto é
        // "aviso sem falha". O turno NÃO acabou — a pessoa pode digitar outra
        // palavra e ainda cumprir o prazo. O que ela precisa sentir é a
        // advertência, não um fim.
        haptics.warn()
        setProfanity({ strikes: result.strikes ?? 1 })
        setWord('')
        setBusy(false)
        return
      }

      // Sucesso: o turno já passou no banco, e o Realtime fecha este popup
      // (a próxima `key` de turno em `CluePhase` nem monta este componente).
      haptics.success()
    } catch (err) {
      setError(toDisplayError(err))
      setBusy(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onDismiss}
      title={
        <AppText variant="title">
          Escreva{' '}
          <AppText variant="title" tone="primary">
            uma
          </AppText>{' '}
          palavra relacionada a palavra secreta
        </AppText>
      }
      description={
        <View style={styles.warningRow}>
          <TriangleAlert size={14} color={colors.warn} />
          <AppText variant="caption" tone="warn" style={styles.warningText}>
            Cuidado para não entregar a palavra secreta
          </AppText>
        </View>
      }
    >
      {/*
        Sem `KeyboardAvoidingView` próprio aqui: o `Sheet` já envolve
        `children` num `KeyboardAvoidingView` com o `behavior` certo por
        plataforma (inclusive o `'height'` do Android, porque o `Modal` abre
        uma Window própria e não herda o `adjustResize` da Activity).
        Duplicar o wrapper aqui só somaria um segundo deslocamento por cima do
        primeiro, empurrando o conteúdo mais do que o necessário.
      */}
      <View style={styles.content}>
        <Countdown
          key={deadline ?? 'sem-prazo'}
          deadline={deadline}
          totalMs={totalMs}
          onExpire={onExpire}
          tone="primary"
        />

        <Input
          autoFocus
          value={word}
          onChangeText={setWord}
          placeholder="ex.: tromba"
          maxLength={CLUE_MAX_LENGTH}
          autoCorrect={false}
          spellCheck={false}
          autoCapitalize="none"
          returnKeyType="send"
          onSubmitEditing={() => void send()}
          invalid={Boolean(problem)}
          emphasis="clue"
        />

        {profanity && (
          <Animated.View entering={FadeInDown}>
            <AppText tone="danger" weight="semibold" variant="label" accessibilityRole="alert">
              Proibido utilizar palavras vulgares. Se continuar, será expulso da sala.
              {'\n'}
              <AppText tone="danger" variant="caption" weight="normal">
                {profanity.strikes === 1
                  ? 'Primeira ocorrência. Na terceira você é expulso.'
                  : 'Segunda ocorrência. Na próxima você é expulso.'}
              </AppText>
            </AppText>
          </Animated.View>
        )}

        {problem && !profanity && <AppText variant="subtitle">{problem}</AppText>}

        {error && (
          <AppText tone="danger" weight="medium" variant="label" accessibilityRole="alert">
            {error}
          </AppText>
        )}

        <Button
          label="Pronto"
          onPress={() => void send()}
          disabled={!canSubmit}
          busy={busy}
          size="lg"
        />

        <Pressable
          accessibilityRole="button"
          onPress={onDismiss}
          hitSlop={8}
          style={styles.dismissLink}
        >
          <AppText tone="muted" variant="caption" style={styles.dismissText}>
            Ver as dicas da mesa
          </AppText>
        </Pressable>
      </View>
    </Sheet>
  )
}

const styles = StyleSheet.create({
  warningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[1.5],
  },
  warningText: {
    flex: 1,
    flexShrink: 1,
  },
  content: {
    gap: space[3],
  },
  dismissLink: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: space[10],
  },
  dismissText: {
    textDecorationLine: 'underline',
  },
})
