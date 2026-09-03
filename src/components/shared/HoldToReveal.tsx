import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AppState, Pressable, StyleSheet, View } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { Eye, EyeOff } from 'lucide-react-native'
import { AppText } from '@/components/ui/Text'
import { haptics } from '@/lib/haptics'
import { colors, alpha } from '@/theme/colors'
import { radius, space, glows } from '@/theme/tokens'

/**
 * Passo do progresso — fixo (não `Date.now()`), para o teste poder controlar o
 * tempo com `jest.advanceTimersByTime` e travar em valores exatos. Mesma
 * constante do `HoldToReveal.test.tsx` do impostor-web.
 */
const TICK_MS = 40

/**
 * Altura mínima do card — o `min-h-64` do web (16rem a 16px de raiz = 256px).
 * Não é espaçamento de layout (por isso não vem de `space`), é a proporção do
 * card do segredo.
 */
const CARD_MIN_HEIGHT = 256

type HoldToRevealProps = {
  children: ReactNode
  holdMs?: number
  hint?: string
  onReveal?: () => void
  style?: StyleProp<ViewStyle>
}

/**
 * Modo Anti-Bisbilhoteiro — o card secreto (regra 8 do AGENTS.md).
 *
 * O conteúdo só existe na árvore de componentes ENQUANTO o dedo está
 * pressionado, e desmonta ao soltar — por isso é `revealed ? children : hint`
 * (render condicional), nunca `opacity`/`display`/blur. Um segredo renderizado
 * e só escondido por estilo está a um inspetor de componentes de distância; um
 * segredo que nunca chegou a montar não tem o que inspecionar.
 *
 * Por que `Pressable.onPressIn/onPressOut` e não Gesture Handler: o RN já
 * resolve os dois vazamentos que importam aqui dentro do próprio
 * `onPressOut` — (1) o dedo escorregar para fora da área (o responder é
 * liberado ao sair do retângulo de toque) e (2) uma interrupção do sistema
 * como ligação entrando (o RN termina o responder e chama `onPressOut` do
 * mesmo jeito). Cobrir os dois num só handler, sem um segundo caminho de
 * cancelamento para esquecer, é mais fácil de auditar — e mais fácil de
 * testar: `fireEvent(el, 'pressOut')` no RNTL não exige simular o motor
 * nativo do Gesture Handler.
 *
 * `Pressable` também já reivindica o responder no toque inicial, então uma
 * pressão parada (o gesto normal de "segurar") não é disputada pelo
 * `ScrollView` por trás — só se o dedo de fato arrastar uma distância
 * perceptível, e nesse caso perder a revelação é o comportamento certo (quem
 * está arrastando não está mais "segurando parado").
 *
 * Android: nada aqui usa `Text selectable` nem dispara `onLongPress` nativo,
 * então não existe o menu de seleção de texto que o toque longo abre em
 * conteúdo selecionável — o toque some no nosso handler antes de qualquer
 * reconhecedor de sistema entrar em cena.
 */
export function HoldToReveal({
  children,
  holdMs = 2000,
  hint = 'Segure para ver',
  onReveal,
  style,
}: HoldToRevealProps) {
  const [holding, setHolding] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  const progress = Math.min(elapsed / holdMs, 1)
  const revealed = elapsed >= holdMs

  // Quantos quartos de progresso (0–4) já dispararam `haptics.soft()`, para
  // pulsar uma vez por faixa de 25% — não um pulso por tique de 40ms, que
  // viraria zumbido contínuo em vez de "carregando o segredo".
  const pulsedQuarterRef = useRef(0)
  // Evita repetir `thud`/`onReveal` em re-renders enquanto `revealed` continua true.
  const revealedFiredRef = useRef(false)

  useEffect(() => {
    if (!holding || revealed) return

    const id = setInterval(() => {
      setElapsed((prev) => Math.min(prev + TICK_MS, holdMs))
    }, TICK_MS)

    return () => clearInterval(id)
  }, [holding, revealed, holdMs])

  useEffect(() => {
    const quarter = Math.floor(progress * 4)
    if (quarter > pulsedQuarterRef.current && quarter < 4) {
      pulsedQuarterRef.current = quarter
      haptics.soft()
    }
  }, [progress])

  useEffect(() => {
    if (revealed && !revealedFiredRef.current) {
      revealedFiredRef.current = true
      haptics.thud()
      onReveal?.()
    }
  }, [revealed, onReveal])

  function press() {
    setHolding(true)
  }

  function release() {
    setHolding(false)
    setElapsed(0)
    pulsedQuarterRef.current = 0
    revealedFiredRef.current = false
  }

  /**
   * Terceira porta de vazamento, e a única que só existe no celular.
   *
   * Dedo escorregando para fora e chamada entrando já são cobertos: os dois
   * terminam o responder, e o RN converte isso em `onPressOut`. Mas o gesto de
   * app switcher (ou o botão de bloqueio) com o dedo AINDA na tela não cancela o
   * toque — não há `onPressOut`, `revealed` continua `true`, e a palavra secreta
   * continua montada exatamente quando o SO tira o snapshot do app para o
   * multitarefa. O segredo fica no preview, para quem pegar o celular depois.
   *
   * Por isso o esconder também é amarrado ao ciclo de vida do app, e não só ao
   * toque.
   */
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (status !== 'active') release()
    })
    return () => subscription.remove()
  }, [])

  return (
    <Pressable
      testID="hold-to-reveal"
      onPressIn={press}
      onPressOut={release}
      accessibilityRole="button"
      accessibilityState={{ expanded: revealed }}
      accessibilityLabel={revealed ? 'Palavra revelada. Solte para ocultar.' : hint}
      style={[
        styles.card,
        revealed ? [styles.cardRevealed, glows.primary] : styles.cardHidden,
        style,
      ]}
    >
      {revealed ? (
        // `entering`: remonta a cada revelação (o conteúdo é condicional), então
        // o fade roda de novo em cada hold — não precisa de estado extra.
        <Animated.View entering={FadeIn.duration(220)} style={styles.content}>
          {children}
        </Animated.View>
      ) : (
        <View style={styles.hintWrap}>
          {holding ? (
            <Eye size={40} color={colors.primary} />
          ) : (
            <EyeOff size={40} color={colors.mutedForeground} />
          )}
          <AppText variant="subtitle" align="center">
            {hint}
          </AppText>
          <AppText variant="caption" tone="muted" align="center" style={styles.helper}>
            Ninguém mais pode olhar. Solte o dedo para esconder na hora.
          </AppText>
        </View>
      )}

      {/* Barra de progresso — só aparece durante a pressão, antes de revelar. */}
      {holding && !revealed && (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    minHeight: CARD_MIN_HEIGHT,
    borderRadius: radius['3xl'],
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: space[6],
  },
  cardHidden: {
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: alpha.card60,
  },
  cardRevealed: {
    // `borderStyle: 'solid'` explícito, e não confiando na ausência de
    // `'dashed'`: quando o estilo do tracejado sai da árvore, o Android não
    // volta a borda para cheia sozinho — o card revelado continuava com moldura
    // tracejada, que lê como "ainda escondido" no exato momento em que o
    // conteúdo está à mostra.
    borderStyle: 'solid',
    borderColor: alpha.primary60,
    backgroundColor: colors.card,
  },
  content: {
    alignItems: 'center',
    gap: space[3],
  },
  hintWrap: {
    alignItems: 'center',
    gap: space[4],
  },
  helper: {
    maxWidth: 220,
  },
  progressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: space[1.5],
    backgroundColor: alpha.transparent,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
})
