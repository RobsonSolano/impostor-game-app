import { StyleSheet, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { Scale } from 'lucide-react-native'
import { AppText } from '@/components/ui/Text'
import { countOf } from '@/lib/plural'
import { alpha, colors } from '@/theme/colors'
import { radius, space } from '@/theme/tokens'
import type { Player, VoteTally } from '@/lib/types'

type VotingOutcomeProps = {
  tally: VoteTally | null
  players: Player[]
  round: number
  /** Dentro do anúncio em tela cheia a moldura já existe: só o conteúdo. */
  bare?: boolean
}

/**
 * Resultado da votação que não decidiu nada. (IMP-13, IMP-39)
 *
 * Nasceu de um bug de campo, não de regra: uma família jogando votou, deu 2 a
 * 2, confirmou — e a tela voltou direto para os turnos sem explicação. Para a
 * mesa, parecia que o app tinha quebrado. A regra estava certa (empate no topo
 * não elimina, IMP-13); o que faltava era DIZER isso, e no lugar certo. O
 * aviso antigo ficava no fim do conteúdo e no celular caía fora da tela — aqui
 * isso é ainda mais grave que no web, por isso este componente abre o
 * conteúdo, antes do quadro de dicas.
 *
 * Mostra NOMES e contagem, não só "houve empate": a mesa precisa ver que o 2 a
 * 2 aconteceu de verdade, senão parece que o voto se perdeu. Os votos já estão
 * apurados neste ponto, então exibi-los não vaza nada.
 */
export function VotingOutcome({ tally, players, round, bare = false }: VotingOutcomeProps) {
  if (round <= 1 || !tally) return null

  const pulou = tally.skip >= tally.top
  const empatados = players
    .filter((player) => tally.top > 0 && (tally.players[player.id] ?? 0) === tally.top)
    .map((player) => `${player.name} ${tally.players[player.id] ?? 0}`)

  const contagem = pulou ? `${countOf(tally.skip, 'voto', 'votos')} para pular.` : empatados.join('  ·  ')

  if (bare) {
    return (
      <View style={styles.bareWrap}>
        <AppText variant="title" weight="bold" align="center">
          {contagem}
        </AppText>
        <AppText tone="muted" align="center" style={styles.bareSubtitle}>
          Deem mais uma dica cada um e votem de novo.
        </AppText>
      </View>
    )
  }

  return (
    <Animated.View entering={FadeInDown} style={styles.framed}>
      <View style={styles.headerRow}>
        <Scale size={16} color={colors.warn} />
        <AppText tone="warn" weight="bold" variant="label">
          {pulou ? 'A mesa preferiu pular' : 'Deu empate na votação'}
        </AppText>
      </View>

      <AppText weight="semibold" variant="label" style={styles.countText}>
        {contagem}
      </AppText>

      <AppText tone="muted" variant="label" style={styles.footerText}>
        Ninguém foi eliminado. Deem mais uma dica cada um e votem de novo.
      </AppText>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  bareWrap: {
    alignItems: 'center',
  },
  bareSubtitle: {
    marginTop: space[2],
  },
  /**
   * `Card` não tem tom `warn` (só plain/primary/violet/danger) — moldura em
   * token direto, mesma cor do aviso do turno (`ClueDialog`).
   *
   * Não há alpha de BORDA para `warn` em `@/theme/colors` (só `warn15`, de
   * fundo); a borda usa `colors.warn` sólido, o token mais próximo disponível.
   */
  framed: {
    borderWidth: 1,
    borderColor: alpha.warn40,
    backgroundColor: alpha.warn15,
    borderRadius: radius['2xl'],
    padding: space[4],
    marginBottom: space[5],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  countText: {
    marginTop: space[2],
  },
  footerText: {
    marginTop: space[1],
  },
})
