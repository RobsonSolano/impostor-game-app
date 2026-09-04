import type { ExpoConfig } from 'expo/config'

/**
 * Configuração do app.
 *
 * É `.ts` e não `.json` porque as credenciais do Supabase entram por `extra`,
 * lidas de `.env` em desenvolvimento e das variáveis do EAS no build. JSON não
 * lê `process.env`.
 */
const config: ExpoConfig = {
  name: 'Impostor',
  slug: 'impostor-app',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'impostor',
  // O jogo é sempre escuro: mesa de bar à noite, e tela clara na cara de todos
  // atrapalha a partida. Mesma decisão do web (`<html className="dark">`).
  userInterfaceStyle: 'dark',
  backgroundColor: '#07080b',
  // Sem `newArchEnabled`: a New Architecture é a única no SDK 57 e a chave saiu
  // do schema.
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.robsonsolano.impostorapp',
  },
  android: {
    package: 'com.robsonsolano.impostorapp',
    // Sem `edgeToEdgeEnabled`: a partir do SDK 54 o edge-to-edge é o padrão do
    // Android e a chave saiu do schema. O respiro de notch/barra de gestos vem
    // do `react-native-safe-area-context` nas telas.
    predictiveBackGestureEnabled: false,
    adaptiveIcon: {
      backgroundColor: '#07080b',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
  },
  web: {
    favicon: './assets/favicon.png',
  },
  /**
   * OTA (EAS Update).
   *
   * `runtimeVersion` com política `appVersion`: o runtime é a própria `version`
   * do app, então uma atualização OTA só chega a quem está na MESMA versão
   * nativa. É o que impede o pior cenário de OTA — mandar JS que chama um módulo
   * nativo que o aparelho não tem, e o app abrir e fechar na cara do jogador.
   *
   * Consequência a entender: subir a `version` significa que os clientes antigos
   * param de receber OTA e passam a precisar de atualização pela loja. É
   * justamente por isso que existe o aviso de atualização nativa (ver
   * `src/hooks/useAppUpdate.ts`), que usa a In-App Updates API do próprio Google
   * Play — a loja é a fonte de verdade da versão nativa, não uma tabela nossa.
   */
  updates: {
    url: 'https://u.expo.dev/eada121e-ff8e-4bf4-a8d7-cff45d0622f5',
    // Não bloqueia a abertura esperando a rede: o app sobe com o bundle que já
    // tem e a atualização é aplicada na próxima abertura. Num jogo de mesa,
    // segurar a splash por causa de rede ruim é pior que abrir desatualizado.
    fallbackToCacheTimeout: 0,
  },
  runtimeVersion: {
    policy: 'appVersion',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#07080b',
        image: './assets/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  // O `owner` é obrigatório porque a conta tem acesso a mais de uma organização
  // na Expo: sem ele, o EAS não sabe quem é o dono do projeto e recusa o build.
  owner: 'robsonsolano',
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    eas: {
      // Fixo, e não vindo de `process.env`: este id amarra o repositório ao
      // projeto no EAS. Vindo do ambiente, um build feito de outra máquina (ou de
      // CI sem a variável) criaria um projeto novo em silêncio, e as credenciais
      // de assinatura ficariam no lugar errado.
      projectId: 'eada121e-ff8e-4bf4-a8d7-cff45d0622f5',
    },
  },
}

export default config
