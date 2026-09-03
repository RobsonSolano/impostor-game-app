import AsyncStorage from '@react-native-async-storage/async-storage'
import { AppState, type AppStateStatus } from 'react-native'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import Constants from 'expo-constants'
import type { Database } from '@/lib/supabase/database.types'

/**
 * Cliente do Supabase, singleton.
 *
 * Singleton importa: cada `createClient` instancia um GoTrue próprio, e dois
 * deles competindo pelo mesmo storage de sessão produzem logout aleatório no
 * meio da partida. (Mesma razão do web.)
 *
 * Três diferenças do web, todas obrigatórias em React Native:
 *
 * 1. **`storage: AsyncStorage`.** Sem `localStorage` no RN, o GoTrue não tem onde
 *    guardar a sessão e o jogador vira um usuário anônimo novo a cada abertura do
 *    app — perdendo o vínculo com o `players.user_id` da sala em que já estava.
 * 2. **`detectSessionInUrl: false`.** Não existe URL de callback aqui; deixar
 *    ligado faz o GoTrue procurar fragmento de hash que nunca vem.
 * 3. **`autoRefreshToken` controlado pelo AppState** (ver abaixo).
 */

function readExtra(key: 'supabaseUrl' | 'supabaseAnonKey'): string {
  // `expoConfig.extra` é a via que funciona nos dois mundos: no dev server vem do
  // `.env` via app.config.ts, e no build do EAS vem das variáveis do perfil.
  const fromExtra = Constants.expoConfig?.extra?.[key] as string | undefined
  if (fromExtra) return fromExtra

  // Rede de segurança: `EXPO_PUBLIC_*` é inlinado pelo Metro no bundle.
  const fromEnv =
    key === 'supabaseUrl'
      ? process.env.EXPO_PUBLIC_SUPABASE_URL
      : process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  if (fromEnv) return fromEnv

  throw new Error(
    `Configuração do Supabase ausente (${key}). Copie o .env.example para .env e ` +
      'preencha EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY.',
  )
}

let cached: SupabaseClient<Database> | null = null

export function getSupabaseClient(): SupabaseClient<Database> {
  if (!cached) {
    cached = createClient<Database>(readExtra('supabaseUrl'), readExtra('supabaseAnonKey'), {
      auth: {
        storage: AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
    startAutoRefreshBridge(cached)
  }
  return cached
}

/**
 * Liga e desliga o refresh de token junto com o ciclo de vida do app.
 *
 * O timer de refresh do GoTrue não roda com o app em segundo plano — o SO
 * suspende os timers. Sem esta ponte, um celular que ficou 40 minutos no bolso
 * volta com token expirado e a primeira RPC falha por 401, o que na tela parece
 * "o jogo travou". Recomendação oficial do Supabase para React Native.
 */
function startAutoRefreshBridge(client: SupabaseClient<Database>) {
  const handle = (status: AppStateStatus) => {
    if (status === 'active') {
      void client.auth.startAutoRefresh()
    } else {
      void client.auth.stopAutoRefresh()
    }
  }

  handle(AppState.currentState)
  AppState.addEventListener('change', handle)
}

/** A sessão guardada já foi conferida contra o servidor nesta execução? */
let sessionValidated = false

async function createAnonSession() {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.auth.signInAnonymously()
  if (error) {
    throw new Error(
      'Não foi possível criar uma sessão anônima. Confirme que "Anonymous sign-ins" ' +
        `está habilitado no painel do Supabase. (${error.message})`,
    )
  }
  sessionValidated = true
  return data.session
}

/**
 * Garante uma identidade antes de qualquer RPC.
 *
 * Toda função de jogo começa com `require_uid()`, então sem sessão nada funciona.
 * `signInAnonymously()` exige *Anonymous sign-ins* habilitado no painel do
 * Supabase — sem isso a chamada volta 422 e ninguém entra em sala.
 *
 * A sessão guardada é conferida com `getUser()`, que consulta o servidor, e não
 * apenas com `getSession()`, que só lê o storage. Um JWT pode ter assinatura
 * válida e prazo em aberto apontando para um usuário que não existe mais (banco
 * recriado, usuários podados). `getSession()` aceita esse token, e o jogador
 * recebe um erro de foreign key em `players_user_id_fkey` que NUNCA se resolve
 * tentando de novo — porque a sessão ruim continua no AsyncStorage. Aqui a sessão
 * inválida é descartada e uma nova nasce na hora.
 *
 * No app isso pesa mais que no web: o AsyncStorage sobrevive a fechar e reabrir o
 * aplicativo, então uma sessão órfã ficaria presa por semanas.
 */
export async function ensureAnonSession() {
  const supabase = getSupabaseClient()

  const { data } = await supabase.auth.getSession()
  if (!data.session) return createAnonSession()

  if (sessionValidated) return data.session

  const { error } = await supabase.auth.getUser()
  if (!error) {
    sessionValidated = true
    return data.session
  }

  await supabase.auth.signOut()
  return createAnonSession()
}
