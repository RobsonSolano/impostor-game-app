import { StyleSheet, Text, View } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'
import type { Player } from '@/lib/types'
import { alpha } from '@/theme/colors'
import { font, weight } from '@/theme/tokens'

/**
 * Diâmetro e tamanho de fonte por tamanho — os `size-8/size-12/size-16` do web
 * (32/48/64px, 1rem = 16px). Fica só aqui: nenhum outro componente precisa
 * conhecer esses números.
 */
const SIZES = {
  sm: { box: 32, font: font.sm },
  md: { box: 48, font: font.lg },
  lg: { box: 64, font: font['2xl'] },
} as const

type PlayerAvatarProps = {
  player: Pick<Player, 'name' | 'avatar_color'>
  size?: keyof typeof SIZES
  style?: StyleProp<ViewStyle>
}

/**
 * Bolha de avatar: inicial do nome sobre a cor do banco (`pick_avatar_color`).
 *
 * A cor de FUNDO é dado do banco, não token — é a única cor do app que não sai de
 * `@/theme`, porque é escolhida por jogador em tempo de execução. O texto por
 * cima usa `alpha.onAvatar`, que existe justamente para este caso: preto
 * translúcido legível sobre qualquer cor da paleta de avatares, sem precisar
 * calcular contraste por jogador.
 */
export function PlayerAvatar({ player, size = 'md', style }: PlayerAvatarProps) {
  const initial = player.name.trim().charAt(0).toUpperCase() || '?'
  const { box, font: labelFont } = SIZES[size]

  return (
    <View
      style={[
        styles.circle,
        { width: box, height: box, borderRadius: box / 2, backgroundColor: player.avatar_color },
        style,
      ]}
    >
      <Text style={[labelFont, styles.label]}>{initial}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  label: {
    fontWeight: weight.bold,
    color: alpha.onAvatar,
  },
})
