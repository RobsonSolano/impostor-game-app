import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { AppState, StyleSheet, View } from 'react-native'
import type { AppStateStatus, StyleProp, ViewStyle } from 'react-native'
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle, G } from 'react-native-svg'
import { AppText } from '@/components/ui/Text'
import { haptics } from '@/lib/haptics'
import { colors } from '@/theme/colors'
import { radius, space } from '@/theme/tokens'

/** Passo da barra/anel (só estética — o número em si não depende disso). */
const TICK_MS = 100

/** Nos últimos N segundos o tom vira `destructive` e cada segundo vibra. */
const URGENT_SECONDS = 3

/** Cor crua, para o traço do SVG e o preenchimento da barra (não são texto). */
const TONES = {
  primary: colors.primary,
  violet: colors.violet,
  destructive: colors.destructive,
} as const

/** Mesmo tom, no vocabulário de `tone` do `AppText` (que chama "danger", não "destructive"). */
const APP_TEXT_TONES = {
  primary: 'primary',
  violet: 'violet',
  destructive: 'danger',
} as const

/** Diâmetro/espessura do anel — bespoke deste componente, não um token de layout. */
const RING_SIZE = 128
const STROKE_WIDTH = 10
const RING_RADIUS = (RING_SIZE - STROKE_WIDTH) / 2
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

type CountdownProps = {
  /** Prazo vindo do banco (`turn_deadline`, `guess_deadline`), ISO. */
  deadline: string | null
  /** Duração cheia, para desenhar anel/barra e limitar relógio adiantado. */
  totalMs: number
  onExpire: () => void
  tone?: keyof typeof TONES
  /** Anel em vez de barra. Default 'ring'. */
  shape?: 'ring' | 'bar'
  style?: StyleProp<ViewStyle>
}

/** `deadline - Date.now()`, limitado a `totalMs` — nunca negativo, nunca maior que o prazo cheio. */
function computeRemaining(deadline: string | null, totalMs: number): number {
  const target = deadline ? new Date(deadline).getTime() : 0
  return Math.min(Math.max(target - Date.now(), 0), totalMs)
}

/**
 * Contagem regressiva de um prazo do banco.
 *
 * **Monte sempre com `key={deadline}`.** O restante inicial vem do
 * inicializador de `useState` (calculado uma vez só); um prazo novo sem troca de
 * `key` faria esta instância continuar contando a partir do valor do prazo
 * anterior, em vez de reiniciar.
 *
 * Regra herdada do web: o restante é calculado UMA vez (`deadline - Date.now()`,
 * limitado a `totalMs`) e conta para baixo localmente a partir daí. Reler o
 * relógio a cada tique deixaria o contador refém de um celular com a hora
 * errada — e celular com hora errada não é raro. Quem decide de verdade se o
 * prazo venceu é a função SQL (`SECURITY DEFINER` com lock na sala); este
 * componente só dá o feedback visual/tátil enquanto isso.
 *
 * Diferença do celular que o web não tinha: o sistema operacional suspende
 * timers de JS com o app em segundo plano (tela bloqueada, app trocado). Sem
 * correção, ao voltar o contador retomaria de onde parou e mostraria mais
 * tempo do que realmente resta (ou pior: mais do que o prazo já vencido no
 * banco), deixando a mesa esperando um número que não bate mais com a verdade.
 * Por isso, e só nessa borda — a transição para `active` do `AppState` — o
 * restante é RECALCULADO a partir do `deadline`, sem violar a regra acima (que
 * é sobre não reler o relógio a cada tique, não sobre nunca recalibrar).
 */
export function Countdown({
  deadline,
  totalMs,
  onExpire,
  tone = 'primary',
  shape = 'ring',
  style,
}: CountdownProps) {
  const [remaining, setRemaining] = useState(() => computeRemaining(deadline, totalMs))

  // Cadeia de setTimeout (não setInterval): o setState fica no callback, e a
  // contagem se encerra sozinha ao chegar em zero, sem precisar de um segundo
  // efeito para limpar o intervalo.
  useEffect(() => {
    if (remaining <= 0) return
    const id = setTimeout(() => setRemaining((prev) => Math.max(prev - TICK_MS, 0)), TICK_MS)
    return () => clearTimeout(id)
  }, [remaining])

  // `useEffectEvent`: lê sempre o `onExpire` mais recente sem entrar nas
  // dependências do efeito abaixo — do contrário, um `onExpire` recriado a
  // cada render (comum quando o pai o declara inline) re-executaria o efeito e
  // poderia disparar a expiração mais de uma vez.
  const expire = useEffectEvent(() => onExpire())

  useEffect(() => {
    if (remaining <= 0) expire()
  }, [remaining])

  // Ao voltar do segundo plano, recalibra pelo relógio — ver comentário do
  // cabeçalho sobre o timer suspenso pelo SO.
  useEffect(() => {
    function onChange(state: AppStateStatus) {
      if (state === 'active') setRemaining(computeRemaining(deadline, totalMs))
    }
    const sub = AppState.addEventListener('change', onChange)
    return () => sub.remove()
  }, [deadline, totalMs])

  const seconds = Math.ceil(remaining / 1000)
  const progress = totalMs > 0 ? remaining / totalMs : 0
  const urgent = seconds <= URGENT_SECONDS && seconds > 0
  const activeTone = urgent ? 'destructive' : tone
  const toneColor = TONES[activeTone]
  const appTextTone = APP_TEXT_TONES[activeTone]

  // Vibra uma vez por segundo (não por tique de 100ms — isso viraria zumbido)
  // nos últimos `URGENT_SECONDS` segundos.
  useEffect(() => {
    if (urgent) haptics.tick()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dispara por segundo exibido, não por `urgent` em si.
  }, [seconds])

  // Pulso do número a cada segundo que muda — feedback de "o tempo anda".
  const numberScale = useSharedValue(1)
  const previousSecondsRef = useRef(seconds)
  useEffect(() => {
    if (previousSecondsRef.current === seconds) return
    previousSecondsRef.current = seconds
    numberScale.value = withSequence(
      withTiming(1.35, { duration: 0 }),
      withTiming(1, { duration: 220 }),
    )
  }, [seconds, numberScale])
  const numberStyle = useAnimatedStyle(() => ({ transform: [{ scale: numberScale.value }] }))

  // Progresso animado suavemente entre tiques (linear, como o web) — evita que
  // a barra/anel "pule" a cada 100ms em vez de escorregar.
  const animatedProgress = useSharedValue(progress)
  useEffect(() => {
    animatedProgress.value = withTiming(progress, { duration: TICK_MS })
  }, [progress, animatedProgress])

  const barFillStyle = useAnimatedStyle(() => ({
    width: `${Math.max(animatedProgress.value, 0) * 100}%`,
  }))

  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: RING_CIRCUMFERENCE * (1 - animatedProgress.value),
  }))

  // O número de segundos muda sozinho, sem nenhum toque, e as duas
  // plataformas de leitor de tela só escutam uma prop cada: o VoiceOver (iOS)
  // anuncia por `accessibilityRole="alert"` e ignora `accessibilityLiveRegion`;
  // o TalkBack (Android) é o oposto. As duas juntas, nos dois lugares onde o
  // número é renderizado abaixo (anel e barra), é o que garante o anúncio nas
  // duas plataformas.
  return (
    <View style={[styles.wrap, style]}>
      {shape === 'ring' ? (
        <View style={styles.ringWrap}>
          <Svg width={RING_SIZE} height={RING_SIZE}>
            <G rotation={-90} originX={RING_SIZE / 2} originY={RING_SIZE / 2}>
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                stroke={colors.border}
                strokeWidth={STROKE_WIDTH}
                fill="none"
              />
              <AnimatedCircle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                stroke={toneColor}
                strokeWidth={STROKE_WIDTH}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={RING_CIRCUMFERENCE}
                animatedProps={ringProps}
              />
            </G>
          </Svg>
          <Animated.View style={[styles.ringCenter, numberStyle]}>
            <AppText
              variant="display"
              weight="black"
              tone={appTextTone}
              tabular
              align="center"
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              accessibilityLabel={`${seconds} segundos restantes`}
            >
              {seconds}
            </AppText>
          </Animated.View>
        </View>
      ) : (
        <Animated.View style={numberStyle}>
          <AppText
            variant="display"
            weight="black"
            tone={appTextTone}
            tabular
            align="center"
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            accessibilityLabel={`${seconds} segundos restantes`}
          >
            {seconds}
          </AppText>
        </Animated.View>
      )}

      {shape === 'bar' && (
        <View style={styles.track}>
          <Animated.View style={[styles.fill, barFillStyle, { backgroundColor: toneColor }]} />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignItems: 'center',
    gap: space[2],
  },
  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    width: '100%',
    height: space[2],
    borderRadius: radius.full,
    backgroundColor: colors.muted,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.full,
  },
})
