import { Platform, Pressable, StyleSheet } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import type { LucideIcon } from 'lucide-react-native'
import { alpha, colors } from '@/theme/colors'
import { ACTION_HEIGHT, TOUCH_TARGET, font, glows, motion, radius, space, weight } from '@/theme/tokens'
import { haptics } from '@/lib/haptics'
import { AppText } from './Text'
import { Spinner } from './Spinner'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'lg' | 'md'
type ButtonHaptic = 'press' | 'tap' | 'select' | false

export type ButtonProps = {
  label: string
  onPress: () => void
  variant?: ButtonVariant
  size?: ButtonSize
  disabled?: boolean
  /** Troca conteúdo por spinner, mantém a largura. */
  busy?: boolean
  /** Componente de `lucide-react-native`. */
  icon?: LucideIcon
  /** Default: true em `primary`. */
  glow?: boolean
  /** Vibração no toque. Default 'press'. `false` desliga. */
  haptic?: ButtonHaptic
  fullWidth?: boolean
  style?: StyleProp<ViewStyle>
  accessibilityLabel?: string
}

const VARIANT_BG: Record<ButtonVariant, ViewStyle> = {
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.secondary },
  ghost: { backgroundColor: alpha.transparent, borderWidth: 1, borderColor: colors.border },
  danger: { backgroundColor: alpha.danger15, borderWidth: 1, borderColor: alpha.danger30 },
}

const VARIANT_FG: Record<ButtonVariant, string> = {
  primary: colors.primaryForeground,
  secondary: colors.secondaryForeground,
  ghost: colors.foreground,
  danger: colors.destructive,
}

const VARIANT_GLOW: Record<ButtonVariant, ViewStyle> = {
  primary: glows.primary,
  secondary: glows.none,
  ghost: glows.none,
  danger: glows.danger,
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

/**
 * Botão com feedback físico: encolhe no toque (spring, não `TouchableOpacity` —
 * a opacidade genérica dela não combina com o resto da identidade, toda em
 * escala e brilho) e vibra ANTES de chamar `onPress`. A vibração é a confirmação
 * do toque; se disparasse depois (por exemplo após um `await` dentro do
 * handler), o dedo já teria saído da tela e a confirmação chegaria tarde demais
 * para significar alguma coisa.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  disabled = false,
  busy = false,
  icon: Icon,
  glow,
  haptic = 'press',
  fullWidth = true,
  style,
  accessibilityLabel,
}: ButtonProps) {
  const scale = useSharedValue(1)
  const interactionDisabled = disabled || busy
  const shouldGlow = glow ?? variant === 'primary'
  const glowStyle = shouldGlow ? VARIANT_GLOW[variant] : glows.none
  const hasVisualGlow = glowStyle !== glows.none

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  function handlePressIn() {
    scale.value = withSpring(0.97, motion.spring)
  }

  function handlePressOut() {
    scale.value = withSpring(1, motion.spring)
  }

  function handlePress() {
    if (haptic !== false) {
      if (haptic === 'tap') haptics.tap()
      else if (haptic === 'select') haptics.select()
      else haptics.press()
    }
    onPress()
  }

  const height = size === 'lg' ? ACTION_HEIGHT : TOUCH_TARGET

  // `glows.*` já resolve por plataforma (ver comentário em tokens.ts): no
  // Android a sombra colorida vira `elevation: 0` de propósito, porque
  // `elevation` só desenha sombra preta e sujaria o fundo escuro de cinza. Sem
  // este reforço de borda, um botão "brilhante" no Android ficaria idêntico a
  // um botão comum — o único traço do brilho que sobrevive na plataforma é a
  // borda mais forte.
  const androidGlowBorder = Platform.select<ViewStyle | null>({
    android: hasVisualGlow
      ? { borderWidth: 2, borderColor: variant === 'danger' ? alpha.danger60 : alpha.primary60 }
      : null,
    default: null,
  })

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={interactionDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: interactionDisabled, busy }}
      style={[
        fullWidth ? styles.fullWidth : styles.autoWidth,
        styles.base,
        { height },
        VARIANT_BG[variant],
        glowStyle,
        androidGlowBorder,
        disabled ? styles.disabled : null,
        animatedStyle,
        style,
      ]}
    >
      {busy ? (
        <Spinner size={20} color={VARIANT_FG[variant]} />
      ) : (
        <>
          {Icon ? <Icon size={20} color={VARIANT_FG[variant]} style={styles.icon} /> : null}
          <AppText
            numberOfLines={1}
            style={[font.base, { fontWeight: weight.bold, color: VARIANT_FG[variant] }]}
          >
            {label}
          </AppText>
        </>
      )}
    </AnimatedPressable>
  )
}

const styles = StyleSheet.create({
  fullWidth: { width: '100%' },
  autoWidth: { alignSelf: 'flex-start' },
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    paddingHorizontal: space[5],
  },
  icon: {
    marginRight: space[2],
  },
  disabled: {
    opacity: 0.5,
  },
})
