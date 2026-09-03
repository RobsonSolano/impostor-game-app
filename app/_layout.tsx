import 'react-native-url-polyfill/auto'

import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import { Stack, ThemeProvider } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { backgroundGradient, colors } from '@/theme/colors'
import { navigationTheme } from '@/theme/navigation'

/**
 * `react-native-url-polyfill/auto` é a PRIMEIRA linha do app de propósito.
 *
 * O `@supabase/supabase-js` monta as URLs de request com `URL`/`URLSearchParams`,
 * e a implementação do Hermes não cobre tudo que ele usa. Sem o polyfill, o
 * primeiro `signInAnonymously()` falha com erro de parsing — que parece problema
 * de rede e não é. Tem que carregar antes de qualquer import do Supabase.
 */

void SplashScreen.preventAutoHideAsync()

/**
 * Shell do app.
 *
 * O gradiente vertical do `body` no web vive aqui, atrás do Stack: é ele que dá
 * profundidade sem virar "fundo colorido". `pointerEvents="none"` porque a
 * camada cobre a tela inteira e não pode roubar toque de nada.
 *
 * `GestureHandlerRootView` tem que envolver TUDO e ter `flex: 1` — sem isso o
 * long-press do card secreto e os gestos do Reanimated não recebem eventos, e a
 * falha é silenciosa (o toque simplesmente não acontece).
 */
export default function RootLayout() {
  useEffect(() => {
    // O shell não espera fonte nem asset remoto: pode soltar a splash já.
    void SplashScreen.hideAsync()
  }, [])

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider value={navigationTheme}>
          <View style={styles.root}>
            <LinearGradient
              colors={backgroundGradient}
              locations={[0, 0.5, 1]}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />

            {/* `light` fixo: o app é sempre escuro, então os ícones da barra de
                status são sempre claros. */}
            <StatusBar style="light" />

            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: 'transparent' },
                // O fundo é o gradiente lá atrás; animação de push opaca esconderia
                // ele por um frame e piscaria preto na troca de tela.
                animation: 'fade',
              }}
            />
          </View>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
})
