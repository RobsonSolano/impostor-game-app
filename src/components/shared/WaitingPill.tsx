import { StyleSheet, View } from 'react-native'
import type { LucideIcon } from 'lucide-react-native'
import { AppText } from '@/components/ui/Text'
import { Spinner } from '@/components/ui/Spinner'
import { colors } from '@/theme/colors'
import { ACTION_HEIGHT, radius, space } from '@/theme/tokens'

type WaitingPillProps = {
  label: string
  icon?: LucideIcon
}

/**
 * O bloco "aguardando o host" — repetido em quatro fases (lobby, votação,
 * apuração, entre rodadas de dica), por isso mora aqui em vez de em cada tela.
 *
 * Sem `icon`, o spinner à esquerda já comunica "algo está em andamento"; um
 * ícone estático entra só quando a fase quer nomear O QUE está pendente (ex.:
 * um relógio para "aguardando prazo"), sem competir com o spinner.
 *
 * `label` costuma trazer uma contagem que muda sozinha (ex.: "3 de 5
 * prontos"), atualizada pelo Realtime sem nenhum toque de quem está olhando a
 * tela. `accessibilityRole="alert"` é o que o VoiceOver (iOS) usa para
 * anunciar a mudança; `accessibilityLiveRegion="polite"` é o que o TalkBack
 * (Android) usa para o mesmo fim — cada plataforma ignora a propriedade da
 * outra, então os dois props precisam ir juntos para o anúncio funcionar nas
 * duas. `"polite"` (não `"assertive"`) porque isto é progresso, não erro: não
 * deve interromper o que o leitor de tela já estiver narrando.
 */
export function WaitingPill({ label, icon: Icon }: WaitingPillProps) {
  return (
    <View style={styles.pill}>
      {Icon ? <Icon size={20} color={colors.mutedForeground} /> : <Spinner size={20} />}
      <AppText
        variant="body"
        tone="muted"
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
      >
        {label}
      </AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  pill: {
    height: ACTION_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[3],
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: space[4],
  },
})
