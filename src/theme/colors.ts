/**
 * Paleta — os MESMOS valores de `src/app/globals.css` no impostor-web.
 *
 * Preto profundo em camadas, verde neon como ação, violeta como segundo acento,
 * rosa para perigo. Herdada do Nutrion.
 *
 * O app roda sempre escuro (`userInterfaceStyle: 'dark'` no app.config), então
 * não existe variante clara: um token só, sem `useColorScheme`.
 *
 * Se um valor aqui divergir do web, a identidade quebra em silêncio — a tela
 * continua funcionando, só deixa de ser o mesmo jogo. Ao mudar um token,
 * mude nos dois.
 */
export const colors = {
  /* Fundos em camadas, do mais profundo ao mais elevado. */
  background: '#07080b',
  backgroundMid: '#0b0d12',
  foreground: '#f4f5f7',
  card: '#12141a',
  cardForeground: '#f4f5f7',
  popover: '#0f1115',
  popoverForeground: '#f4f5f7',

  /* Ação: verde neon com texto escuro em cima. */
  primary: '#39ff14',
  primaryForeground: '#0a0b0e',

  secondary: '#1a1d25',
  secondaryForeground: '#f4f5f7',

  muted: '#0b0d12',
  mutedForeground: '#a1a6b2',

  /* `accent` é estado de hover/seleção, não cor de marca (herança do shadcn). */
  accent: '#1a1d25',
  accentForeground: '#f4f5f7',

  destructive: '#f43f5e',
  destructiveForeground: '#f4f5f7',

  border: '#1f232b',
  input: '#2b313c',
  ring: '#39ff14',

  /* Acentos extras da identidade, usados direto nos componentes. */
  violet: '#8b5cf6',
  violetSoft: '#a78bfa',
  accentSoft: '#7bff5c',
  accentDeep: '#1db954',
  warn: '#f59e0b',
  info: '#38bdf8',
} as const

/**
 * Versões translúcidas.
 *
 * No web isso era `bg-primary/10`, `border-primary/40`. Em React Native não
 * existe a barra de opacidade do Tailwind, e aplicar `opacity` no nó apagaria os
 * filhos junto — então a transparência vive na própria cor, em `rgba`.
 */
export const alpha = {
  primary04: 'rgba(57, 255, 20, 0.04)',
  primary07: 'rgba(57, 255, 20, 0.07)',
  primary10: 'rgba(57, 255, 20, 0.10)',
  primary13: 'rgba(57, 255, 20, 0.13)',
  primary25: 'rgba(57, 255, 20, 0.25)',
  primary40: 'rgba(57, 255, 20, 0.40)',
  primary60: 'rgba(57, 255, 20, 0.60)',

  violet10: 'rgba(139, 92, 246, 0.10)',
  violet13: 'rgba(139, 92, 246, 0.13)',
  violet30: 'rgba(139, 92, 246, 0.30)',
  violet45: 'rgba(139, 92, 246, 0.45)',
  violet60: 'rgba(139, 92, 246, 0.60)',

  danger10: 'rgba(244, 63, 94, 0.10)',
  danger12: 'rgba(244, 63, 94, 0.12)',
  danger15: 'rgba(244, 63, 94, 0.15)',
  danger30: 'rgba(244, 63, 94, 0.30)',
  danger45: 'rgba(244, 63, 94, 0.45)',
  danger60: 'rgba(244, 63, 94, 0.60)',

  warn15: 'rgba(245, 158, 11, 0.15)',
  /**
   * Borda em `warn`, para o card de votação indecisa.
   *
   * Existe porque `colors.warn` sólido numa borda de card grande grita mais que
   * a informação que ele carrega — a votação não decidiu nada é aviso, não erro.
   * Mesma proporção usada em `primary40`/`violet45`/`danger45`.
   */
  warn40: 'rgba(245, 158, 11, 0.40)',

  card60: 'rgba(18, 20, 26, 0.60)',
  card80: 'rgba(18, 20, 26, 0.80)',
  border60: 'rgba(31, 35, 43, 0.60)',
  transparent: 'transparent',

  /**
   * Texto sobre a cor de avatar, que vem do banco (`pick_avatar_color`) e não é
   * conhecida em tempo de compilação.
   *
   * Preto translúcido, e não `colors.foreground`: a paleta de avatares do banco é
   * toda de cores claras e saturadas, então texto claro em cima desapareceria. O
   * translúcido deixa a cor do avatar atravessar um pouco a inicial, o que amarra
   * o nome ao círculo em vez de parecer um adesivo preto colado.
   */
  onAvatar: 'rgba(0, 0, 0, 0.80)',
} as const

/**
 * Gradiente de fundo do app — o `linear-gradient(180deg, …)` do `body` no web.
 *
 * Vive aqui como tupla porque `expo-linear-gradient` recebe array de cores, e a
 * assinatura dele exige no mínimo duas (tupla, não `string[]`).
 */
export const backgroundGradient = ['#07080b', '#0b0d12', '#07080b'] as const

/** Paleta de avatar do banco (`pick_avatar_color`), para preview e fallback. */
export const AVATAR_FALLBACK = '#a1a6b2'
