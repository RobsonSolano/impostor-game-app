import type { ReactNode } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { alpha, colors } from '@/theme/colors'
import { ACTION_HEIGHT, space } from '@/theme/tokens'

/** Largura de conteúdo em tablet — sem isso a coluna vira uma faixa gigante de ponta a ponta. */
const CONTENT_MAX_WIDTH = 520

type ScreenProps = {
  children: ReactNode
  /** Rola o conteúdo. Default true. */
  scroll?: boolean
  /** Ação fixa na base, na zona do polegar. */
  action?: ReactNode
  style?: StyleProp<ViewStyle>
  contentStyle?: StyleProp<ViewStyle>
}

/**
 * Moldura estrutural de tela — o que sobra do `PhaseShell` do web depois de
 * tirar o conteúdo específico de fase (eyebrow/title/aside, que viraram
 * responsabilidade do `PhaseShell` daqui, montado por cima deste).
 *
 * Não pinta fundo próprio: o gradiente do app já vem do `_layout.tsx` (o
 * "gesture root"), e uma cor sólida aqui o esconderia atrás de cada tela.
 *
 * `useSafeAreaInsets()` e nunca `Dimensions.get('window')` (regra 11 do
 * AGENTS.md) — o respiro tem que reagir a notch, barra de gestos e rotação,
 * não a uma medida de tela lida uma vez só no import.
 */
export function Screen({ children, scroll = true, action, style, contentStyle }: ScreenProps) {
  const insets = useSafeAreaInsets()

  // Reserva embaixo do scroll para o último item não ficar escondido atrás da
  // ação fixa — aproximação por altura de ação + respiro, já que medir a altura
  // real da ação exigiria `onLayout` e um segundo render só para isso.
  const scrollBottomSpace = action ? ACTION_HEIGHT + space[8] : space[4]
  // `Math.max`, não `||`: o respiro mínimo tem que valer mesmo com um inset
  // pequeno e positivo (ex.: 8px) — o `pt-safe` do web também é `max(...)`,
  // não "só usa o padrão quando o valor é zero".
  const topSpace = Math.max(insets.top, space[4])

  const content = scroll ? (
    <ScrollView
      style={styles.flex}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        styles.content,
        { paddingTop: topSpace, paddingBottom: scrollBottomSpace },
        contentStyle,
      ]}
    >
      {children}
    </ScrollView>
  ) : (
    <View
      style={[
        styles.flex,
        styles.content,
        { paddingTop: topSpace, paddingBottom: scrollBottomSpace },
        contentStyle,
      ]}
    >
      {children}
    </View>
  )

  const body = (
    <View style={[styles.root, style]}>
      {content}

      {action && (
        <View style={[styles.actionOuter, { paddingBottom: Math.max(insets.bottom, space[4]) }]}>
          {/* Degradê de `background` acima da ação (o `bg-gradient-to-t` do web):
              o conteúdo que rola por trás desbota antes de colidir com o botão. */}
          <LinearGradient
            colors={[alpha.transparent, colors.background]}
            style={styles.actionGradient}
            pointerEvents="none"
          />
          <View style={styles.actionInner}>{action}</View>
        </View>
      )}
    </View>
  )

  if (!action) return body

  return (
    // Só entra em cena quando há ação: sem botão fixo para proteger, o teclado
    // pode empurrar a rolagem à vontade sem custo de UX.
    //
    // No Android, `behavior={undefined}`, não `'height'`: esta tela (ao
    // contrário do `Sheet`) não vive dentro de um `Modal` — é conteúdo direto
    // da Activity, que já tem `adjustResize` e redimensiona sozinha quando o
    // teclado abre. Aplicar `'height'` aqui em cima disso encolheria o
    // conteúdo uma segunda vez, comprimindo mais do que o teclado realmente
    // precisa. O `Sheet` usa `'height'` porque o `Modal` do Android abre uma
    // Window própria, que NÃO herda o `adjustResize` da Activity — lá, sem o
    // `'height'`, ninguém redimensiona nada. São duas telas em situações
    // diferentes, não uma inconsistência.
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {body}
    </KeyboardAvoidingView>
  )
}

const GRADIENT_HEIGHT = space[8]

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1 },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: space[5],
  },
  actionOuter: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: space[5],
    paddingTop: space[4],
  },
  actionGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -GRADIENT_HEIGHT,
    height: GRADIENT_HEIGHT,
  },
  actionInner: {
    width: '100%',
  },
})
