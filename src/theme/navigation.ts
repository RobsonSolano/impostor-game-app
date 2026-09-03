import { DarkTheme, type Theme } from 'expo-router'
import { colors } from '@/theme/colors'

/**
 * Tema de navegação do app.
 *
 * Sem isto o app abre com FUNDO BRANCO, e a falha é traiçoeira: o gradiente
 * escuro do `_layout` renderiza normalmente, mas o container de tela do
 * expo-router pinta a cor do tema por cima — e o tema padrão é claro. O sintoma é
 * texto branco em fundo branco, com os cards escuros aparecendo, então parece
 * "erro de cor em alguns componentes" em vez de tema errado.
 *
 * `contentStyle: transparent` no `Stack` não resolve sozinho: quem pinta é o
 * tema, não o contentStyle.
 *
 * `card` fica TRANSPARENTE de propósito, e não em `colors.background`: é o
 * gradiente vertical do shell que tem que aparecer atrás das telas. Pintar o card
 * de preto chapado apagaria a profundidade que o gradiente dá.
 */
export const navigationTheme: Theme = {
  ...DarkTheme,
  dark: true,
  colors: {
    ...DarkTheme.colors,
    primary: colors.primary,
    background: 'transparent',
    card: 'transparent',
    text: colors.foreground,
    border: colors.border,
    notification: colors.destructive,
  },
}
