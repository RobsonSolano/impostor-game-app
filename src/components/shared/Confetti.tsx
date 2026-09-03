import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View, useWindowDimensions } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import { colors } from '@/theme/colors'

/** Sem lib nova — só Reanimated, como pedido. */
const PARTICLE_COUNT = 24
const FALL_DURATION_MS = 2200
const MAX_START_DELAY_MS = 500
/** Tamanho base do confete, variado por partícula — decorativo, não um token de layout. */
const BASE_SIZE = 10

const PALETTES = {
  primary: [colors.primary, colors.accentSoft, colors.violet],
  danger: [colors.destructive, colors.warn],
} as const

type ConfettiProps = {
  active: boolean
  tone?: keyof typeof PALETTES
}

type ParticleSpec = {
  key: number
  /** Posição horizontal, fração 0–1 da largura do contêiner. */
  startX: number
  delay: number
  /** Deslocamento horizontal ao longo da queda (px). */
  drift: number
  /** Voltas completas de rotação até o fim da queda. */
  rotations: number
  color: string
  size: number
}

function makeParticles(tone: keyof typeof PALETTES): ParticleSpec[] {
  const palette = PALETTES[tone]
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    key: i,
    startX: Math.random(),
    delay: Math.random() * MAX_START_DELAY_MS,
    drift: (Math.random() - 0.5) * 160,
    rotations: 1 + Math.random() * 2,
    // `noUncheckedIndexedAccess`: o índice calculado não prova, em tempo de
    // compilação, que cai dentro da paleta — mesmo sendo sempre verdade aqui.
    color: palette[i % palette.length] ?? colors.primary,
    size: BASE_SIZE * (0.7 + Math.random() * 0.6),
  }))
}

/** Uma partícula — hook próprio por componente, não um array de shared values no pai. */
function Particle({ spec, fallDistance }: { spec: ParticleSpec; fallDistance: number }) {
  const t = useSharedValue(0)

  useEffect(() => {
    t.value = withDelay(spec.delay, withTiming(1, { duration: FALL_DURATION_MS, easing: Easing.linear }))
    // `spec` é estável por partícula (gerado uma vez em `makeParticles`); só
    // precisa rodar de novo se a shared value em si mudar de identidade.
  }, [spec, t])

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: -BASE_SIZE * 2 + t.value * fallDistance },
      { translateX: t.value * spec.drift },
      { rotate: `${t.value * spec.rotations * 360}deg` },
    ],
    // Desbota só no último quarto da queda, para não "piscar" sumindo de vez.
    opacity: 1 - Math.max(t.value - 0.75, 0) * 4,
  }))

  return (
    <Animated.View
      style={[
        styles.particle,
        style,
        {
          left: `${spec.startX * 100}%`,
          width: spec.size,
          height: spec.size,
          backgroundColor: spec.color,
        },
      ]}
    />
  )
}

/**
 * Chuva de confete — só no fim de partida (`GameOverPhase`).
 *
 * Partículas em Reanimated puro, sem lib nova: cada uma cai com deriva
 * horizontal e rotação, calculadas uma vez em `makeParticles` e animadas por
 * uma `shared value` própria (0→1 de queda) via `withTiming`.
 *
 * Dispara UMA vez quando `active` vira `true` — a borda de subida é vigiada
 * por `wasActiveRef`, para um re-render qualquer com `active` continuando
 * `true` não relançar a chuva do zero. `pointerEvents="none"` para o confete
 * não roubar o toque do botão "jogar de novo" por baixo. O `setTimeout` que
 * desmonta as partículas ao fim da queda é limpo tanto ao disparar de novo
 * quanto ao desmontar o componente — sem isso, um `GameOverPhase` fechado no
 * meio da animação vazaria o timer.
 */
export function Confetti({ active, tone = 'primary' }: ConfettiProps) {
  const { height } = useWindowDimensions()
  const [particles, setParticles] = useState<ParticleSpec[] | null>(null)
  const wasActiveRef = useRef(false)
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (active && !wasActiveRef.current) {
      setParticles(makeParticles(tone))

      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = setTimeout(() => {
        setParticles(null)
      }, MAX_START_DELAY_MS + FALL_DURATION_MS)
    }
    wasActiveRef.current = active
  }, [active, tone])

  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
    }
  }, [])

  if (!particles) return null

  const fallDistance = height + BASE_SIZE * 4

  return (
    <View style={styles.container} pointerEvents="none">
      {particles.map((spec) => (
        <Particle key={spec.key} spec={spec} fallDistance={fallDistance} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  // Cobre a tela inteira sem depender de `Dimensions.get` (regra 11): o RN
  // já resolve isso com posição absoluta e as quatro bordas a zero.
  container: {
    ...StyleSheet.absoluteFill,
    // `zIndex` explícito além da ordem de render: no Android a ordem de pintura
    // também responde a `elevation` de irmãos, e um card com elevação poderia
    // subir na frente do confete. Aqui a festa é sempre a camada de cima.
    zIndex: 100,
  },
  particle: {
    position: 'absolute',
    top: 0,
    borderRadius: 2,
  },
})
