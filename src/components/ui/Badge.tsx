import { StyleSheet, View } from 'react-native'
import { alpha, colors } from '@/theme/colors'
import { radius, space } from '@/theme/tokens'
import { AppText, type AppTextTone } from './Text'

export type BadgeVariant = 'default' | 'primary' | 'danger' | 'violet' | 'warn'

export type BadgeProps = {
  variant?: BadgeVariant
  label: string
}

const VARIANT_CONTAINER: Record<BadgeVariant, { backgroundColor: string; borderColor: string }> = {
  default: { backgroundColor: colors.secondary, borderColor: alpha.transparent },
  primary: { backgroundColor: colors.primary, borderColor: alpha.transparent },
  danger: { backgroundColor: alpha.danger15, borderColor: alpha.danger30 },
  violet: { backgroundColor: alpha.violet13, borderColor: alpha.violet30 },
  // Não há `alpha.warn30` no tema (só `warn15`) — pílula sem borda em vez de
  // inventar um token que não é meu para criar.
  warn: { backgroundColor: alpha.warn15, borderColor: alpha.transparent },
}

const VARIANT_TONE: Record<BadgeVariant, AppTextTone> = {
  default: 'default',
  primary: 'onPrimary',
  danger: 'danger',
  violet: 'violet',
  warn: 'warn',
}

/** Selo de status pequeno — mesmo espírito do `Badge` do web (`variant` + `label`). */
export function Badge({ variant = 'default', label }: BadgeProps) {
  const container = VARIANT_CONTAINER[variant]

  return (
    <View style={[styles.base, container]}>
      <AppText variant="caption" weight="semibold" tone={VARIANT_TONE[variant]}>
        {label}
      </AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: space[2],
    paddingVertical: space[1],
  },
})
