import { Platform } from 'react-native'
import { colors, alpha } from '@/theme/colors'

/**
 * Raios — o `--radius: 1rem` do web e sua escala derivada.
 *
 * O web calcula `calc(var(--radius) * 1.4)` e afins; aqui os valores já vêm
 * resolvidos em px (1rem = 16px). Cantos generosos porque o app é todo card
 * grande em tela de celular.
 */
export const radius = {
  sm: 10, // 16 * 0.6
  md: 13, // 16 * 0.8
  lg: 16, // --radius
  xl: 22, // * 1.4
  '2xl': 29, // * 1.8
  '3xl': 35, // * 2.2
  '4xl': 42, // * 2.6
  full: 9999,
} as const

/** Escala de espaço (múltiplos de 4, como o Tailwind). */
export const space = {
  0: 0,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
} as const

/**
 * Tamanho de fonte, espelhando a escala do Tailwind usada no web.
 * `lineHeight` explícito: o padrão do RN por plataforma difere, e título grande
 * sem entrelinha controlada fica apertado no Android.
 */
export const font = {
  xs: { fontSize: 12, lineHeight: 16 },
  sm: { fontSize: 14, lineHeight: 20 },
  base: { fontSize: 16, lineHeight: 24 },
  lg: { fontSize: 18, lineHeight: 26 },
  xl: { fontSize: 20, lineHeight: 28 },
  '2xl': { fontSize: 24, lineHeight: 30 },
  '3xl': { fontSize: 30, lineHeight: 36 },
  '4xl': { fontSize: 36, lineHeight: 40 },
  '5xl': { fontSize: 48, lineHeight: 50 },
  '6xl': { fontSize: 60, lineHeight: 62 },
  '7xl': { fontSize: 72, lineHeight: 74 },
} as const

/**
 * Peso de fonte.
 *
 * No Android, `fontWeight` acima de `700` só rende se a família tiver o corte —
 * com a fonte de sistema, `800`/`900` cai em bold e nada quebra. Ficam aqui como
 * intenção de design, iguais às classes `font-black` do web.
 */
export const weight = {
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  black: '900',
} as const satisfies Record<string, '400' | '500' | '600' | '700' | '900'>

/** Área de toque mínima confortável para dedo (não 32px de mouse). */
export const TOUCH_TARGET = 48

/** Altura das ações primárias — o `h-14` do web. */
export const ACTION_HEIGHT = 56

/**
 * Brilho (glow) — o traço mais característico da identidade.
 *
 * No web é `box-shadow` colorido. Em React Native, sombra colorida exige
 * `shadowColor` no iOS e, no Android, `elevation` (que ignora a cor) — daí o
 * `Platform.select`: no Android o glow vem de `borderColor` mais forte nos
 * componentes, não da sombra.
 *
 * `shadowOffset` positivo no eixo Y para o brilho cair para baixo, como no web
 * (`0 8px 24px -6px`).
 */
function glow(color: string, opacity: number, radiusPx: number, offsetY = 0) {
  return Platform.select({
    ios: {
      shadowColor: color,
      shadowOpacity: opacity,
      shadowRadius: radiusPx,
      shadowOffset: { width: 0, height: offsetY },
    },
    android: {
      // `elevation` desenha sombra preta no Android; para não sujar o fundo
      // escuro com um halo cinza, o brilho ali é responsabilidade da borda.
      elevation: 0,
    },
    default: {
      shadowColor: color,
      shadowOpacity: opacity,
      shadowRadius: radiusPx,
      shadowOffset: { width: 0, height: offsetY },
    },
  })!
}

export const glows = {
  /** Ação primária: parece acesa. */
  primary: glow(colors.primary, 0.45, 14, 6),
  primaryStrong: glow(colors.primary, 0.7, 20, 4),
  violet: glow(colors.violet, 0.55, 16, 2),
  danger: glow(colors.destructive, 0.55, 16, 2),
  none: {},
} as const

/**
 * Lavada diagonal dentro de um card, para ele não parecer chapado.
 * Equivale às utilities `card-wash*` do web; consumido por `<LinearGradient>`.
 */
export const washes = {
  primary: {
    colors: [alpha.primary07, 'rgba(57, 255, 20, 0)'] as const,
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
    locations: [0, 0.65] as const,
  },
  violet: {
    colors: [alpha.violet13, 'rgba(139, 92, 246, 0)'] as const,
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
    locations: [0, 0.65] as const,
  },
  danger: {
    colors: [alpha.danger12, 'rgba(244, 63, 94, 0)'] as const,
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
    locations: [0, 0.65] as const,
  },
} as const

/**
 * Curvas de animação.
 *
 * `spring` é o mesmo par stiffness/damping do Motion no web, que o Reanimated
 * aceita com os mesmos nomes.
 */
export const motion = {
  spring: { stiffness: 260, damping: 20, mass: 1 },
  springSnappy: { stiffness: 420, damping: 18, mass: 0.8 },
  springSoft: { stiffness: 180, damping: 22, mass: 1 },
  fast: 140,
  base: 200,
  slow: 320,
} as const

/** Letra espaçada dos rótulos em caixa alta (`tracking-[0.18em]` do web). */
export const tracking = {
  eyebrow: 2,
  wide: 1.2,
  code: 8,
} as const
