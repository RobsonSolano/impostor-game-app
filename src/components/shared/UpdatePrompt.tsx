import { Pressable, StyleSheet, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { ArrowDownToLine, RefreshCw, X } from 'lucide-react-native'
import { AppText } from '@/components/ui/Text'
import { Button } from '@/components/ui/Button'
import { useAppUpdate } from '@/hooks/useAppUpdate'
import { alpha, colors } from '@/theme/colors'
import { radius, space, TOUCH_TARGET } from '@/theme/tokens'

/**
 * Aviso de atualização disponível.
 *
 * Montado só na TELA INICIAL, de propósito. As duas ações que ele oferece
 * interrompem o app — reiniciar para aplicar OTA, ou sair para a loja — e
 * qualquer uma delas no meio de uma partida derruba o jogador da sala e parece
 * queda de conexão para o resto da mesa. Na tela inicial não existe partida para
 * atrapalhar.
 *
 * Aviso e não modal: atualizar é conveniência, não pré-requisito. Bloquear a
 * entrada do jogo por causa disso seria pior que a versão antiga.
 */
export function UpdatePrompt() {
  const { update, busy, aplicarOta, aplicarNativa, dispensar } = useAppUpdate()

  if (update.kind === 'none') return null

  const nativa = update.kind === 'native'

  return (
    <Animated.View entering={FadeInDown.duration(260)} style={styles.card}>
      <View style={styles.header}>
        <View style={styles.texto}>
          <AppText variant="label" weight="bold">
            {nativa ? 'Versão nova na Play Store' : 'Atualização pronta'}
          </AppText>
          <AppText variant="caption" tone="muted">
            {nativa
              ? // Diz o que a pessoa ganha, não o número da versão: "1.1.0" não
                // significa nada para quem só quer jogar.
                'Esta versão do app não recebe mais melhorias automáticas. Atualize pela loja para continuar recebendo.'
              : 'Já foi baixada. Reinicie o app para usar a versão nova.'}
          </AppText>
        </View>

        {/*
          Dispensar existe porque o aviso aparece na porta de entrada do jogo: se
          a mesa está esperando para jogar agora, atualizar pode ficar para
          depois. Volta na próxima abertura.
        */}
        <Pressable
          onPress={dispensar}
          hitSlop={space[2]}
          style={styles.fechar}
          accessibilityRole="button"
          accessibilityLabel="Dispensar aviso de atualização"
        >
          <X size={18} color={colors.mutedForeground} />
        </Pressable>
      </View>

      <Button
        label={nativa ? 'Atualizar na loja' : 'Reiniciar agora'}
        icon={nativa ? ArrowDownToLine : RefreshCw}
        onPress={() => void (nativa ? aplicarNativa() : aplicarOta())}
        variant="secondary"
        size="md"
        busy={busy}
        // A vibração é escolhida dentro do hook (junto da ação que ela confirma),
        // então o padrão do Button sairia em dobro.
        haptic={false}
        accessibilityLabel={
          nativa
            ? `Atualizar para a versão ${update.storeVersion} na Play Store`
            : 'Reiniciar o app para aplicar a atualização'
        }
      />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: alpha.primary40,
    borderRadius: radius.xl,
    padding: space[4],
    gap: space[3],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[3],
  },
  texto: {
    flex: 1,
    minWidth: 0,
    gap: space[1],
  },
  fechar: {
    minWidth: TOUCH_TARGET / 2,
    minHeight: TOUCH_TARGET / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
