import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, Linking, Platform } from 'react-native'
import * as Updates from 'expo-updates'
import Constants from 'expo-constants'
import { haptics } from '@/lib/haptics'

/**
 * Atualização do app — as DUAS que existem, e elas não são a mesma coisa.
 *
 * 1. **OTA (`expo-updates`)**: troca só o JavaScript. Chega sozinha, é grátis
 *    para o jogador e resolve a maioria dos ajustes (texto, tela, regra de
 *    cliente). Mas `runtimeVersion` é `appVersion` (ver `app.config.ts`), então
 *    OTA só alcança quem está na MESMA versão nativa.
 * 2. **Nativa (loja)**: troca o binário. É a única que entrega módulo nativo
 *    novo — e é exatamente o que o jogador na versão antiga PRECISA quando a
 *    `version` sobe, porque nesse momento ele para de receber OTA e não tem como
 *    saber disso.
 *
 * Quem sabe se existe versão nativa nova é a **própria Google Play**, via
 * In-App Updates API (`expo-in-app-updates`). Nada de tabela de versão nossa
 * para manter em sincronia com a loja: a loja é a fonte de verdade, e se a
 * publicação ainda está em revisão o jogador simplesmente não é avisado — que é
 * o comportamento correto.
 *
 * PRIORIDADE: nativa vence OTA. Se as duas aparecem, a nativa é a que resolve —
 * o OTA daquele runtime já não recebe nada de novo.
 *
 * NUNCA aplica sozinho. Reiniciar o app para aplicar OTA no meio de uma partida
 * derrubaria o jogador da sala e ainda pareceria queda de conexão para a mesa —
 * então este hook só INFORMA, e quem aplica é o toque do jogador, na tela
 * inicial (ver onde `UpdatePrompt` é montado).
 */

export type AppUpdate =
  | { kind: 'none' }
  /** Bundle novo já baixado, esperando um reinício para valer. */
  | { kind: 'ota' }
  /** Versão nativa nova publicada na loja. */
  | { kind: 'native'; storeVersion: string }

/**
 * As duas APIs são módulos NATIVOS: não existem no Expo Go nem em dev, onde
 * `Updates.isEnabled` é falso e a checagem da loja rejeita. Rodar isso ali só
 * produziria ruído no log, então o hook fica inerte fora de build de verdade.
 *
 * Avaliado na CHAMADA, não no carregamento do módulo: uma constante de topo é
 * decidida no primeiro `import` e depois é imutável, o que deixa a porta
 * impossível de exercitar em teste (`__DEV__` é sempre verdadeiro no Jest) e
 * cristaliza um valor que pode mudar durante a sessão.
 */
function podeChecar() {
  return !__DEV__ && Updates.isEnabled
}

/** A parte da API do `expo-in-app-updates` que este hook usa. */
type ApiLoja = {
  checkForUpdate: () => Promise<{ updateAvailable: boolean; storeVersion: string }>
  startUpdate: (isImmediate?: boolean) => Promise<boolean>
}

/**
 * Carrega `expo-in-app-updates` SOB DEMANDA, e nunca por `import` no topo.
 *
 * O `import` estático quebra o app inteiro onde o módulo nativo não existe — e
 * "não existe" inclui o Expo Go, que é onde o app é desenvolvido. O erro é
 * `Cannot find native module 'ExpoInAppUpdates'` e acontece na AVALIAÇÃO do
 * módulo: nenhum guard dentro de função chega a rodar, porque a tela nem monta.
 * Custou uma tela branca com stack de erro para descobrir; teste não pega, porque
 * ali o módulo está mockado.
 *
 * Com `require` tardio, um ambiente sem o módulo simplesmente não avisa de
 * atualização nativa — que é o fallback correto, e o mesmo que acontece num APK
 * instalado fora da loja.
 */
function carregarLoja(): ApiLoja | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- tem que ser `require`: `import` estático é avaliado no carregamento e derruba o app onde o módulo nativo não existe.
    return require('expo-in-app-updates') as ApiLoja
  } catch {
    return null
  }
}

/** Fallback quando o fluxo da Play não abre (APK de fora da loja, por exemplo). */
const PACOTE = Constants.expoConfig?.android?.package ?? 'com.robsonsolano.impostorapp'

export function useAppUpdate() {
  const [update, setUpdate] = useState<AppUpdate>({ kind: 'none' })
  const [busy, setBusy] = useState(false)
  const [dispensado, setDispensado] = useState(false)

  /** Evita checar em paralelo quando o app entra e sai do primeiro plano rápido. */
  const checando = useRef(false)
  const montado = useRef(true)

  const checar = useCallback(async () => {
    if (!podeChecar() || checando.current) return
    checando.current = true

    try {
      // Nativa primeiro: é a que manda quando as duas existem.
      try {
        const api = carregarLoja()
        if (!api) throw new Error('sem módulo nativo de in-app updates')
        const loja = await api.checkForUpdate()
        if (loja.updateAvailable) {
          if (montado.current) {
            setUpdate({ kind: 'native', storeVersion: loja.storeVersion })
          }
          return
        }
      } catch {
        // App instalado fora da loja, Play Services ausente, ou sem rede. Não é
        // erro do jogo: só significa que não há como saber, e seguimos para OTA.
      }

      const disponivel = await Updates.checkForUpdateAsync()
      if (!disponivel.isAvailable) return

      // Baixa em silêncio. O jogador só é avisado quando já está pronta, para o
      // aviso não virar "espere aí" no meio de uma partida.
      await Updates.fetchUpdateAsync()
      if (montado.current) setUpdate({ kind: 'ota' })
    } catch {
      // Rede ruim, servidor de update fora, aparelho sem espaço. Atualização é
      // conveniência: nada aqui pode atrapalhar quem só quer jogar.
    } finally {
      checando.current = false
    }
  }, [])

  useEffect(() => {
    montado.current = true

    // Microtask e não chamada direta: `checar` faz `setState`, e disparar isso no
    // corpo do efeito rende render em cascata (é a mesma queixa que o
    // `useRoomChannel` resolve do mesmo jeito). Adiar um tique põe o primeiro
    // setState depois do flush de render.
    void Promise.resolve().then(() => checar())

    // Recheca ao voltar do segundo plano: é quando o jogador pode ter ficado
    // horas sem abrir, e é o momento natural de descobrir que saiu versão nova.
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') void checar()
    })

    return () => {
      montado.current = false
      sub.remove()
    }
  }, [checar])

  /** Reinicia com o bundle novo. Só chamado por toque do jogador. */
  const aplicarOta = useCallback(async () => {
    setBusy(true)
    haptics.press()
    try {
      await Updates.reloadAsync()
      // Daqui não volta: o app reinicia.
    } catch {
      if (montado.current) setBusy(false)
    }
  }, [])

  /**
   * Manda para a atualização nativa.
   *
   * `startUpdate(false)` = update FLEXÍVEL: a Play baixa por baixo e o jogador
   * continua usando o app. Escolhido em vez do imediato de propósito — o
   * imediato prende a tela numa barra de progresso em tela cheia, e se isso
   * pegar alguém no meio de uma partida a mesa perde o jogador.
   *
   * Se o fluxo da Play não abre (APK instalado por fora, Play Services ausente),
   * cai para a página do app na loja. É o "manda pra loja" garantido: um caminho
   * ou o outro sempre leva o jogador ao lugar de atualizar.
   */
  const aplicarNativa = useCallback(async () => {
    setBusy(true)
    haptics.press()
    try {
      const api = carregarLoja()
      const comecou = api ? await api.startUpdate(false) : false
      if (comecou) return
    } catch {
      // Cai para a loja abaixo.
    }

    try {
      // `market://` abre o app da Play direto; o https é o plano B para aparelho
      // sem a loja instalada (que aí abre no navegador).
      const nativo = `market://details?id=${PACOTE}`
      const web =
        Platform.OS === 'android'
          ? `https://play.google.com/store/apps/details?id=${PACOTE}`
          : 'https://apps.apple.com/'

      if (await Linking.canOpenURL(nativo)) {
        await Linking.openURL(nativo)
      } else {
        await Linking.openURL(web)
      }
    } catch {
      // Sem loja e sem navegador. Nada mais a tentar.
    } finally {
      if (montado.current) setBusy(false)
    }
  }, [])

  /**
   * Esconde o aviso nesta sessão.
   *
   * Não persiste de propósito: se o jogador dispensar para sempre, ele fica numa
   * versão que não recebe mais OTA e sem lembrete nenhum. Abrir o app de novo é
   * um custo aceitável para o aviso voltar.
   */
  const dispensar = useCallback(() => {
    haptics.tap()
    setDispensado(true)
  }, [])

  return {
    update: dispensado ? ({ kind: 'none' } as AppUpdate) : update,
    busy,
    aplicarOta,
    aplicarNativa,
    dispensar,
  }
}
