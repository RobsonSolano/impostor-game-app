import { HomeScreen } from '@/components/game/HomeScreen'

/**
 * Rota inicial — criar ou entrar numa sala.
 *
 * Substitui a smoke screen provisória: a cadeia nativa (Reanimated, SVG,
 * lucide, haptics, tokens, Supabase) já foi provada por ela: agora é a tela
 * de verdade.
 */
export default function IndexScreen() {
  return <HomeScreen />
}
