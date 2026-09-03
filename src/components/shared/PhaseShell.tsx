import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { Screen } from '@/components/shared/Screen'
import { AppText } from '@/components/ui/Text'
import { space } from '@/theme/tokens'

type PhaseShellProps = {
  /** Rótulo curto da fase, no topo. */
  eyebrow?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  /** Conteúdo principal — o "palco" da fase. */
  children?: ReactNode
  /** Contexto secundário: mesa, placar. Empilhado abaixo do palco. */
  aside?: ReactNode
  action?: ReactNode
  scroll?: boolean
}

/**
 * Esqueleto de todas as telas de fase.
 *
 * O web tinha quatro faixas responsivas (celular/sm/tablet/desktop) num DOM
 * só, com o `aside` virando coluna lateral a partir do desktop (`lg`). Aqui só
 * existe a faixa de celular: uma coluna sempre, e o `aside` é só mais uma
 * seção empilhada — a mesma ordem de leitura que o web já usava na sua faixa
 * mobile.
 *
 * Ordem fixa: header (eyebrow/title/subtitle) → palco (`children`) → `aside` →
 * ação na base. A moldura em si (respiro seguro, rolagem, teclado, degradê
 * acima da ação) é toda do `Screen`; este componente só decide o que entra em
 * cada faixa da coluna.
 */
export function PhaseShell({
  eyebrow,
  title,
  subtitle,
  children,
  aside,
  action,
  scroll,
}: PhaseShellProps) {
  return (
    <Screen scroll={scroll} action={action}>
      <View style={styles.header}>
        {eyebrow && (
          <AppText variant="eyebrow" tone="primary" weight="bold">
            {eyebrow}
          </AppText>
        )}
        <AppText variant="title" weight="bold">
          {title}
        </AppText>
        {subtitle && (
          <AppText variant="subtitle" tone="muted">
            {subtitle}
          </AppText>
        )}
      </View>

      {children && <View style={styles.stage}>{children}</View>}

      {aside && <View style={styles.aside}>{aside}</View>}
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: {
    gap: space[1.5],
    marginBottom: space[5],
    /**
     * Reserva a faixa do `RoomExitButton`, que flutua no topo direito em TODAS as
     * fases, com fundo opaco e `zIndex` acima do conteúdo.
     *
     * Sem isto a primeira linha do título passa por baixo da pílula
     * "Sair"/"Encerrar" e simplesmente desaparece — e some justamente nos títulos
     * que carregam informação: "Vez de <nome>", "<nome> era o impostor!". A faixa
     * do botão (topo do inset + 48px de altura) cai exatamente sobre a linha do
     * título tanto no iPhone quanto no Android.
     *
     * É o `pr-32` do web, que existe lá com o mesmo comentário.
     */
    paddingRight: space[20] + space[8],
  },
  stage: {
    gap: space[4],
  },
  aside: {
    marginTop: space[6],
    gap: space[3],
  },
})
