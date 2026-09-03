import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native'
import type { LayoutChangeEvent } from 'react-native'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { alpha, colors } from '@/theme/colors'
import { motion, radius, space } from '@/theme/tokens'
import { AppText } from './Text'

export type SheetProps = {
  open: boolean
  onClose: () => void
  title?: ReactNode
  description?: ReactNode
  children: ReactNode
  /** Fechar por toque no fundo / gesto. Default true. */
  dismissable?: boolean
}

/**
 * Salto inicial (posição "fora da tela") usado só ANTES da primeira medição do
 * próprio conteúdo via `onLayout`. É um chute generoso, nunca `Dimensions.get(
 * 'window')` — proibido para layout pela regra 11 do AGENTS.md (o app roda em
 * dobrável, tablet, teclado aberto). Assim que `onLayout` mede a altura real do
 * sheet, ela substitui este valor, que deixa de importar.
 */
const OFFSCREEN_FALLBACK = 640

/**
 * Substitui o `Dialog` do web. Modal que sobe de baixo — é onde o polegar está.
 *
 * Por que `Modal` nativo com `animationType="none"` + animação própria em
 * Reanimated, em vez do `animationType="slide"` embutido: o slide do RN usa uma
 * curva fixa do sistema operacional, sem spring — destoaria do resto do app,
 * todo animado com `motion.spring` (ver `Button`). Então o `Modal` só cuida de
 * empilhar por cima de tudo e bloquear o botão físico "voltar"; o `translateY`
 * de entrada/saída é nosso, com o mesmo spring do resto da identidade.
 *
 * O `Modal` só é desmontado (`visible=false`) depois que o spring de SAÍDA
 * termina: se derrubássemos `visible` na hora que `open` vira `false`, o RN
 * cortaria o sheet no frame seguinte e a animação de descida nunca apareceria.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  dismissable = true,
}: SheetProps) {
  const insets = useSafeAreaInsets()
  const [visible, setVisible] = useState(open)
  const translateY = useSharedValue(OFFSCREEN_FALLBACK)
  const measuredHeight = useRef(0)
  const hasEntered = useRef(false)

  useEffect(() => {
    if (open) {
      if (visible) {
        // REABERTURA DURANTE A SAÍDA. A mola de descida ainda está correndo, e o
        // callback dela chamaria `setVisible(false)` — fechando o Modal com
        // `open === true`. O sheet ficaria preso fechado, e como `open` não muda
        // mais, nada o traria de volta: no turno de dica isso custa os 15–20
        // segundos inteiros, com o jogador tocando num botão que não responde.
        //
        // Os dois botões que provocam isso ("Ver as dicas da mesa" e "Escrever
        // minha palavra") ficam ambos na zona do polegar, então o toque apressado
        // é o caso comum, não o exótico.
        //
        // Reanimar para 0 resolve os dois lados: cancela a mola anterior (cujo
        // callback passa a receber `finished: false` e não fecha nada) e traz o
        // sheet de volta para a tela.
        hasEntered.current = true
        translateY.value = withSpring(0, motion.spring)
      } else {
        setVisible(true)
        // Força um novo "salto" para fora na próxima medição de layout: é assim
        // que a entrada volta a animar de baixo para cima.
        hasEntered.current = false
      }
    } else if (visible) {
      const target = measuredHeight.current || OFFSCREEN_FALLBACK
      translateY.value = withSpring(target, motion.spring, (finished) => {
        'worklet'
        if (finished) runOnJS(setVisible)(false)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- este efeito só pode reagir à mudança de `open`; incluir `visible` ou `translateY` nas deps (ambos lidos e escritos aqui dentro) faria o efeito rodar de novo no meio da própria animação de entrada/saída que ele acabou de disparar, cancelando a mola em andamento.
  }, [open])

  function handleLayout(event: LayoutChangeEvent) {
    const height = event.nativeEvent.layout.height
    measuredHeight.current = height
    if (open && !hasEntered.current) {
      hasEntered.current = true
      translateY.value = height // salta para fora da tela, sem animar
      translateY.value = withSpring(0, motion.spring) // e entra de baixo
    }
  }

  function handleBackdropPress() {
    if (dismissable) onClose()
  }

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }))

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => {
        // Botão físico "voltar" do Android: só fecha se o sheet permitir — um
        // sheet não-dismissable (ex.: aguardando resultado de uma RPC) não pode
        // ser escapado por trás do app decidir a regra.
        if (dismissable) onClose()
      }}
    >
      <View style={StyleSheet.absoluteFill}>
        <Pressable
          style={[StyleSheet.absoluteFill, styles.backdrop]}
          onPress={handleBackdropPress}
          accessibilityRole="button"
          accessibilityLabel="Fechar"
        />
        <KeyboardAvoidingView
          style={styles.avoidingArea}
          pointerEvents="box-none"
          // O `Modal` do Android abre uma Window própria, que NÃO herda o
          // `adjustResize` da Activity — sem o "height" aqui, o teclado sobe por
          // cima do conteúdo (e do botão "Pronto", com o prazo da dica correndo)
          // em vez de empurrá-lo para cima.
          behavior={Platform.select({ ios: 'padding', android: 'height' })}
        >
          <Animated.View
            onLayout={handleLayout}
            style={[
              styles.sheet,
              { paddingBottom: insets.bottom + space[4] },
              sheetAnimatedStyle,
            ]}
          >
            {title || description ? (
              <View style={styles.header}>
                {title ? (
                  typeof title === 'string' ? (
                    <AppText variant="title">{title}</AppText>
                  ) : (
                    title
                  )
                ) : null}
                {description ? (
                  typeof description === 'string' ? (
                    <AppText variant="subtitle" tone="muted">
                      {description}
                    </AppText>
                  ) : (
                    description
                  )
                ) : null}
              </View>
            ) : null}
            {children}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    // Não existe token dedicado de "véu" de modal no tema — `card80` é o alpha
    // mais próximo (mesma cor quase preta do `card`, só translúcida). O web usa
    // `bg-black/10` porque conta com `backdrop-blur`, que a RN não tem sem lib
    // nova; sem blur, 10% de opacidade não separaria o sheet do fundo.
    backgroundColor: alpha.card80,
  },
  avoidingArea: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.popover,
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    paddingHorizontal: space[5],
    paddingTop: space[5],
    gap: space[4],
  },
  header: {
    gap: space[1.5],
  },
})
