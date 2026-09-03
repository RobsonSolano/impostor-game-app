import { Text } from 'react-native'
import type { TextProps as RNTextProps, TextStyle } from 'react-native'
import { colors } from '@/theme/colors'
import { font, weight as weightTokens, tracking } from '@/theme/tokens'

export type AppTextVariant =
  | 'eyebrow'
  | 'title'
  | 'subtitle'
  | 'body'
  | 'label'
  | 'caption'
  | 'display'

export type AppTextTone =
  | 'default'
  | 'muted'
  | 'primary'
  | 'danger'
  | 'violet'
  | 'warn'
  | 'onPrimary'

export type AppTextProps = RNTextProps & {
  variant?: AppTextVariant
  tone?: AppTextTone
  weight?: keyof typeof weightTokens
  align?: 'left' | 'center' | 'right'
  /** Números de código e placar alinhados em coluna (`font-variant-numeric`). */
  tabular?: boolean
}

type VariantPreset = {
  font: TextStyle
  weight: keyof typeof weightTokens
  tone: AppTextTone
  uppercase?: true
  letterSpacing?: number
}

/**
 * Mapa de variante → tipografia, espelhando a hierarquia do `PhaseShell` e da
 * `HomeScreen` do web (eyebrow em caixa alta e espaçada, título grande e em
 * negrito, subtítulo discreto em `muted`). Sem breakpoint aqui: o celular só
 * tem um tamanho de tela por vez, ao contrário do `md:`/`lg:` do web.
 */
const VARIANT_PRESET: Record<AppTextVariant, VariantPreset> = {
  eyebrow: {
    font: font.xs,
    weight: 'bold',
    tone: 'primary',
    uppercase: true,
    letterSpacing: tracking.eyebrow,
  },
  display: { font: font['4xl'], weight: 'bold', tone: 'default' },
  title: { font: font['2xl'], weight: 'bold', tone: 'default' },
  subtitle: { font: font.sm, weight: 'normal', tone: 'muted' },
  body: { font: font.base, weight: 'normal', tone: 'default' },
  label: { font: font.sm, weight: 'semibold', tone: 'default' },
  caption: { font: font.xs, weight: 'normal', tone: 'muted' },
}

const TONE_COLOR: Record<AppTextTone, string> = {
  default: colors.foreground,
  muted: colors.mutedForeground,
  primary: colors.primary,
  danger: colors.destructive,
  violet: colors.violet,
  warn: colors.warn,
  onPrimary: colors.primaryForeground,
}

/**
 * Única porta para texto no app.
 *
 * O `Text` cru do React Native não herda fonte nem cor de lugar nenhum — cada
 * tela que o usasse direto reescreveria a paleta à mão, e a identidade visual
 * divergiria tela a tela sem ninguém perceber. Toda tipografia do app passa por
 * aqui, e cada variante já nasce com a cor e o peso certos.
 */
export function AppText({
  variant = 'body',
  tone,
  weight: weightProp,
  align,
  tabular = false,
  style,
  ...rest
}: AppTextProps) {
  const preset = VARIANT_PRESET[variant]
  const resolvedTone = tone ?? preset.tone
  const resolvedWeight = weightProp ?? preset.weight

  return (
    <Text
      {...rest}
      style={[
        preset.font,
        {
          fontWeight: weightTokens[resolvedWeight],
          color: TONE_COLOR[resolvedTone],
        },
        preset.uppercase ? { textTransform: 'uppercase' } : null,
        preset.letterSpacing !== undefined ? { letterSpacing: preset.letterSpacing } : null,
        align ? { textAlign: align } : null,
        // Equivalente ao `font-variant-numeric: tabular-nums` do web: os
        // dígitos do código de sala e do placar ficam de largura fixa, então o
        // número não "dança" a cada atualização vinda do Realtime.
        tabular ? { fontVariant: ['tabular-nums'] as const } : null,
        style,
      ]}
    />
  )
}
