import { useEffect } from 'react'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle } from 'react-native-svg'
import { colors } from '@/theme/colors'

export type SpinnerProps = {
  size?: number
  color?: string
}

/**
 * Spinner próprio em `Svg` + Reanimated, não o `ActivityIndicator` nativo: o
 * `size` do `ActivityIndicator` só aceita `'small' | 'large'` — um número cru
 * funciona apenas no iOS. Não dá para pedir, por exemplo, um spinner de 20px
 * consistente nas duas plataformas com o componente nativo. Um arco em `Svg`
 * girando resolve tamanho e cor de forma idêntica em iOS e Android, e reaproveita
 * uma lib que o app já carrega (sem dependência nova).
 */
export function Spinner({ size = 20, color = colors.primary }: SpinnerProps) {
  const rotation = useSharedValue(0)

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 700, easing: Easing.linear }),
      -1,
      false,
    )
  }, [rotation])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }))

  const strokeWidth = Math.max(2, size / 8)
  const arcRadius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * arcRadius

  return (
    <Animated.View style={[{ width: size, height: size }, animatedStyle]}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={arcRadius}
          stroke={color}
          strokeWidth={strokeWidth}
          // Arco de 1/4 de volta: o giro contínuo é o que lê como "carregando",
          // um círculo fechado giraria e pareceria parado.
          strokeDasharray={`${circumference * 0.25} ${circumference * 0.75}`}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    </Animated.View>
  )
}
