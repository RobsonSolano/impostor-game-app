import type { ReactNode } from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { alpha, colors } from '@/theme/colors'
import { glows, radius, space, washes } from '@/theme/tokens'

export type CardTone = 'plain' | 'primary' | 'violet' | 'danger'

export type CardProps = {
  children: ReactNode
  /** Lavada diagonal + borda + glow combinando. */
  tone?: CardTone
  glow?: boolean
  /** default true (space[4]) */
  padded?: boolean
  style?: StyleProp<ViewStyle>
}

const TONE_BORDER: Record<CardTone, string> = {
  plain: colors.border,
  primary: alpha.primary40,
  violet: alpha.violet45,
  danger: alpha.danger45,
}

// Mesma família de cor da borda normal, só mais forte — é o que o Android usa
// no lugar da sombra colorida (ver comentário de `glows` em tokens.ts).
const TONE_BORDER_STRONG: Record<CardTone, string> = {
  plain: colors.border,
  primary: alpha.primary60,
  violet: alpha.violet60,
  danger: alpha.danger60,
}

const TONE_GLOW: Record<CardTone, ViewStyle> = {
  plain: glows.none,
  primary: glows.primary,
  violet: glows.violet,
  danger: glows.danger,
}

const TONE_WASH = {
  plain: null,
  primary: washes.primary,
  violet: washes.violet,
  danger: washes.danger,
} as const

/**
 * Card com lavada de gradiente diagonal (`card-wash*` do web), para não ficar
 * chapado.
 *
 * `overflow: 'hidden'` no container não é enfeite: no Android, `borderRadius`
 * no pai NÃO recorta um filho posicionado com `position: absolute` (o
 * `LinearGradient` da lavada) — sem isto, o gradiente vaza reto pelos cantos
 * arredondados do card, formando um quadrado atrás do card redondo.
 */
export function Card({ children, tone = 'plain', glow = false, padded = true, style }: CardProps) {
  const wash = TONE_WASH[tone]
  const glowStyle = glow ? TONE_GLOW[tone] : glows.none
  const hasVisualGlow = glowStyle !== glows.none

  // No Android a sombra colorida de `glows.*` vira `elevation: 0` de propósito
  // (ver tokens.ts) — ali o brilho só sobrevive como borda mais forte. No iOS a
  // sombra já entrega o "aceso"; reforçar a borda lá também dobraria o efeito.
  const borderColor = Platform.select({
    android: hasVisualGlow ? TONE_BORDER_STRONG[tone] : TONE_BORDER[tone],
    default: TONE_BORDER[tone],
  })
  const androidGlowBorder = Platform.select<ViewStyle | null>({
    android: hasVisualGlow ? { borderWidth: 2 } : null,
    default: null,
  })

  return (
    <View
      style={[
        styles.base,
        { borderColor },
        glowStyle,
        androidGlowBorder,
        padded ? styles.padded : null,
        style,
      ]}
    >
      {wash ? (
        <LinearGradient
          colors={wash.colors}
          start={wash.start}
          end={wash.end}
          locations={wash.locations}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  padded: {
    padding: space[4],
  },
})
