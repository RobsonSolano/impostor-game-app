import { StyleSheet, TextInput, View } from 'react-native'
import type { TextInputProps as RNTextInputProps } from 'react-native'
import { alpha, colors } from '@/theme/colors'
import { ACTION_HEIGHT, TOUCH_TARGET, font, space, radius, tracking, weight } from '@/theme/tokens'
import { AppText } from './Text'

export type InputProps = RNTextInputProps & {
  label?: string
  invalid?: boolean
  /** Centralizado e enorme, para código de sala e dica. */
  emphasis?: 'normal' | 'code' | 'clue'
}

/**
 * Campo de texto do app.
 *
 * `placeholderTextColor` e `selectionColor` são aplicados DEPOIS de espalhar
 * `...rest`, de propósito: o padrão do RN pinta os dois de azul de sistema, que
 * destoa da identidade neon. Aqui eles são sempre os tokens da paleta, não uma
 * sugestão que a tela de cima possa sobrescrever sem querer.
 */
export function Input({
  label,
  invalid = false,
  emphasis = 'normal',
  style,
  ...rest
}: InputProps) {
  return (
    <View style={label ? styles.withLabel : undefined}>
      {label ? <AppText variant="label">{label}</AppText> : null}
      <TextInput
        {...rest}
        {...(emphasis === 'code'
          ? {
              // Teclado já abre certo para código de sala: maiúsculas, sem
              // corretor, sem sugestão — ROOM_CODE_ALPHABET não tem minúscula.
              autoCapitalize: 'characters' as const,
              autoCorrect: false,
              spellCheck: false,
            }
          : null)}
        placeholderTextColor={colors.mutedForeground}
        selectionColor={colors.primary}
        style={[
          styles.base,
          emphasis === 'code' ? styles.code : null,
          emphasis === 'clue' ? styles.clue : null,
          invalid ? styles.invalid : null,
          style,
        ]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  withLabel: {
    gap: space[2],
  },
  base: {
    minHeight: TOUCH_TARGET,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.input,
    backgroundColor: alpha.transparent,
    paddingHorizontal: space[4],
    color: colors.foreground,
    ...font.base,
  },
  code: {
    height: ACTION_HEIGHT,
    textAlign: 'center',
    textTransform: 'uppercase',
    ...font['3xl'],
    fontWeight: weight.bold,
    letterSpacing: tracking.code,
  },
  clue: {
    height: ACTION_HEIGHT,
    textAlign: 'center',
    ...font.xl,
    fontWeight: weight.bold,
  },
  invalid: {
    borderColor: colors.destructive,
  },
})
