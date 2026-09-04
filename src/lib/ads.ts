import { Platform } from 'react-native'
import Constants from 'expo-constants'

/**
 * Anúncio — UM por partida criada, e nada além disso.
 *
 * A regra de produto: o único ponto de interrupção aceitável é o instante em que
 * o host cria a sala. Dali em diante a jornada é intocada — card secreto, dicas,
 * votação e desfecho não têm anúncio nenhum. Motivo: a tela é COMPARTILHADA numa
 * mesa. Um anúncio no meio da partida não interrompe um jogador, interrompe cinco
 * ao mesmo tempo, e é o tipo de coisa que faz a mesa desinstalar o app.
 *
 * Três invariantes que este módulo garante:
 *
 * 1. **O anúncio nunca é pré-requisito da sala.** Quem cria a sala é a RPC, e ela
 *    roda ANTES. Se o anúncio não carregou, não existe, ou falhou, o jogo segue
 *    como se ele não existisse — igual à vibração (ver AGENTS.md, regra 9).
 * 2. **Nada aqui pode prender a navegação.** `mostrarInterstitial` resolve por
 *    fechamento do anúncio OU por prazo, o que vier primeiro. Sem isso, um SDK
 *    travado deixaria o host olhando uma tela morta com a sala já criada.
 * 3. **Fora de build nativo o módulo é inerte.** O SDK do AdMob é nativo e não
 *    existe no Expo Go; o `require` é tardio pelo mesmo motivo do
 *    `expo-in-app-updates` (import estático derruba o app inteiro onde o módulo
 *    não existe).
 */

/** Além disso o anúncio é abandonado e a navegação segue. */
const PRAZO_EXIBICAO_MS = 8_000

/** Tempo máximo que vale esperar um anúncio ainda carregando. */
const PRAZO_CARREGAMENTO_MS = 2_500

/**
 * IDs de teste oficiais do Google.
 *
 * Servem como padrão de propósito: o SDK do AdMob **derruba o app na abertura**
 * se o App ID no manifest estiver ausente ou malformado, então um placeholder
 * inventado seria pior que nenhum anúncio. Com os IDs de teste, o app roda e
 * mostra anúncio de teste até os IDs reais entrarem por variável de ambiente.
 */
const TESTE_INTERSTITIAL_ANDROID = 'ca-app-pub-3940256099942544/1033173712'
const TESTE_INTERSTITIAL_IOS = 'ca-app-pub-3940256099942544/4411468910'

type ModuloAds = {
  MobileAds: () => { initialize: () => Promise<unknown> }
  InterstitialAd: {
    createForAdRequest: (
      unitId: string,
      opcoes?: { requestNonPersonalizedAdsOnly?: boolean },
    ) => AnuncioInterstitial
  }
  AdEventType: { LOADED: string; CLOSED: string; ERROR: string }
}

type AnuncioInterstitial = {
  addAdEventListener: (evento: string, cb: (payload?: unknown) => void) => () => void
  load: () => void
  show: () => Promise<void>
  loaded: boolean
}

function carregarModulo(): ModuloAds | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- `import` estático avalia o módulo no carregamento e derruba o app onde o SDK nativo não existe (Expo Go).
    return require('react-native-google-mobile-ads') as ModuloAds
  } catch {
    return null
  }
}

function unitId(): string {
  const doAmbiente =
    Platform.OS === 'android'
      ? process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID
      : process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS
  if (doAmbiente) return doAmbiente

  const doExtra = Constants.expoConfig?.extra?.admobInterstitial as string | undefined
  if (doExtra) return doExtra

  return Platform.OS === 'android' ? TESTE_INTERSTITIAL_ANDROID : TESTE_INTERSTITIAL_IOS
}

/** Anúncio já carregado, esperando o próximo "Criar sala". */
let pronto: AnuncioInterstitial | null = null
let carregando = false
let iniciado = false

/**
 * Inicializa o SDK e pede consentimento, uma vez por execução.
 *
 * O consentimento (UMP) não é enfeite jurídico: sem ele, o AdMob serve anúncio
 * não personalizado na Europa e, na política atual do Google, a conta fica em
 * risco. O formulário só aparece para quem a UMP considerar necessário — no
 * Brasil, na prática, ninguém vê nada.
 */
export async function iniciarAnuncios(): Promise<void> {
  if (iniciado || __DEV__) return
  const mod = carregarModulo()
  if (!mod) return
  iniciado = true

  try {
    // O consentimento vem ANTES do initialize: é o que o SDK espera para decidir
    // entre anúncio personalizado e não personalizado na primeira requisição.
    const { AdsConsent } = carregarModulo() as unknown as {
      AdsConsent?: { gatherConsent: () => Promise<unknown> }
    }
    if (AdsConsent?.gatherConsent) await AdsConsent.gatherConsent()
  } catch {
    // Sem consentimento resolvido, o SDK cai em não personalizado por conta
    // própria. Não é motivo para deixar de anunciar nem para travar o app.
  }

  try {
    await mod.MobileAds().initialize()
    precarregar()
  } catch {
    // Sem SDK, sem anúncio. O jogo não muda.
  }
}

/**
 * Deixa um anúncio pronto para o próximo "Criar sala".
 *
 * Pré-carregar é o que permite o anúncio aparecer sem espera perceptível. Sem
 * isto, o host esperaria o download DEPOIS de tocar no botão, com a sala já
 * criada — a pior das duas ordens possíveis.
 */
export function precarregar(): void {
  if (__DEV__ || carregando || pronto?.loaded) return
  const mod = carregarModulo()
  if (!mod) return

  carregando = true
  try {
    const anuncio = mod.InterstitialAd.createForAdRequest(unitId(), {
      requestNonPersonalizedAdsOnly: true,
    })

    const limpaCarregado = anuncio.addAdEventListener(mod.AdEventType.LOADED, () => {
      pronto = anuncio
      carregando = false
      limpaCarregado()
    })
    const limpaErro = anuncio.addAdEventListener(mod.AdEventType.ERROR, () => {
      pronto = null
      carregando = false
      limpaErro()
    })

    anuncio.load()
  } catch {
    carregando = false
  }
}

/**
 * Mostra o interstitial da criação de sala, se houver um pronto.
 *
 * Resolve SEMPRE, e resolve rápido: por fechamento do anúncio, por erro, ou por
 * prazo. Quem chama usa isto como "pausa antes de navegar", nunca como condição.
 *
 * Devolve `true` se o anúncio de fato apareceu — só para telemetria futura; a
 * navegação não deve depender do valor.
 */
export async function mostrarInterstitial(): Promise<boolean> {
  if (__DEV__) return false
  const mod = carregarModulo()
  if (!mod) return false

  // Deu tempo de carregar? Espera um pouco, mas pouco: sala criada e host
  // olhando tela parada é pior que anúncio nenhum.
  if (!pronto?.loaded && carregando) {
    await new Promise((r) => setTimeout(r, PRAZO_CARREGAMENTO_MS))
  }

  const anuncio = pronto
  if (!anuncio?.loaded) {
    precarregar() // deixa pronto para a próxima
    return false
  }

  pronto = null

  return new Promise<boolean>((resolve) => {
    let resolvido = false
    const encerra = (mostrou: boolean) => {
      if (resolvido) return
      resolvido = true
      limpaFechado()
      limpaErro()
      clearTimeout(prazo)
      // Já prepara o próximo enquanto o host lê o código da sala.
      precarregar()
      resolve(mostrou)
    }

    const limpaFechado = anuncio.addAdEventListener(mod.AdEventType.CLOSED, () =>
      encerra(true),
    )
    const limpaErro = anuncio.addAdEventListener(mod.AdEventType.ERROR, () => encerra(false))
    const prazo = setTimeout(() => encerra(false), PRAZO_EXIBICAO_MS)

    try {
      void anuncio.show().catch(() => encerra(false))
    } catch {
      encerra(false)
    }
  })
}
