import * as Ads from 'react-native-google-mobile-ads'

/**
 * O que vale provar aqui é a invariante de produto, não a chamada do SDK:
 * **anúncio nunca prende o jogo**. `mostrarInterstitial` tem que resolver em
 * qualquer cenário — sem anúncio carregado, com erro, com `show()` rejeitando, e
 * com um SDK que simplesmente nunca responde.
 *
 * Se um destes testes travar por timeout, é exatamente o bug que ele existe para
 * pegar: o host ficaria olhando uma tela morta com a sala já criada.
 *
 * `__DEV__` é desligado porque o módulo é inerte em dev de propósito, e um teste
 * contra o módulo inerte não provaria nada.
 */
;(globalThis as unknown as { __DEV__: boolean }).__DEV__ = false

/**
 * O módulo guarda o anúncio pré-carregado em estado de MÓDULO — proposital: é um
 * singleton, existe um app por aparelho. Em teste isso vaza entre casos (um
 * `carregando = true` que nunca resolve deixa o caso seguinte inerte), então cada
 * teste recarrega o módulo do zero.
 */
function carregarAds() {
  let mod!: typeof import('@/lib/ads')
  jest.isolateModules(() => {
     
    mod = require('@/lib/ads') as typeof import('@/lib/ads')
  })
  return mod
}

const criar = jest.mocked(Ads.InterstitialAd.createForAdRequest)

/** Fabrica um anúncio falso com controle sobre os eventos que ele emite. */
function anuncioFalso(opcoes: { loaded: boolean; showRejeita?: boolean }) {
  const ouvintes: Record<string, ((p?: unknown) => void)[]> = {}
  return {
    ouvintes,
    anuncio: {
      loaded: opcoes.loaded,
      addAdEventListener: jest.fn((evento: string, cb: (p?: unknown) => void) => {
        ouvintes[evento] = [...(ouvintes[evento] ?? []), cb]
        return () => {
          ouvintes[evento] = (ouvintes[evento] ?? []).filter((f) => f !== cb)
        }
      }),
      load: jest.fn(),
      show: jest.fn(() =>
        opcoes.showRejeita ? Promise.reject(new Error('sem preenchimento')) : Promise.resolve(),
      ),
    },
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.useRealTimers()
})

describe('anúncio da criação de sala', () => {
  it('resolve na hora quando não há anúncio carregado — sem prender a navegação', async () => {
    const { anuncio } = anuncioFalso({ loaded: false })
    criar.mockReturnValue(anuncio as unknown as ReturnType<typeof criar>)

    const { mostrarInterstitial } = carregarAds()
    await expect(mostrarInterstitial()).resolves.toBe(false)
    expect(anuncio.show).not.toHaveBeenCalled()
  })

  it('resolve quando o anúncio fecha, e já prepara o próximo', async () => {
    const carregado = anuncioFalso({ loaded: true })
    criar.mockReturnValue(carregado.anuncio as unknown as ReturnType<typeof criar>)

    // Precarrega e finge o evento de "carregou", que é o que arma o anúncio.
    const { mostrarInterstitial, precarregar } = carregarAds()
    precarregar()
    carregado.ouvintes['loaded']?.forEach((cb) => cb())

    const promessa = mostrarInterstitial()
    // Aguarda um tique para os ouvintes de exibição serem registrados.
    await Promise.resolve()
    carregado.ouvintes['closed']?.forEach((cb) => cb())

    await expect(promessa).resolves.toBe(true)
    expect(carregado.anuncio.show).toHaveBeenCalled()
  })

  it('resolve quando o SDK devolve erro na exibição', async () => {
    const carregado = anuncioFalso({ loaded: true })
    criar.mockReturnValue(carregado.anuncio as unknown as ReturnType<typeof criar>)

    const { mostrarInterstitial, precarregar } = carregarAds()
    precarregar()
    carregado.ouvintes['loaded']?.forEach((cb) => cb())

    const promessa = mostrarInterstitial()
    await Promise.resolve()
    carregado.ouvintes['error']?.forEach((cb) => cb())

    await expect(promessa).resolves.toBe(false)
  })

  it('resolve quando o próprio show() rejeita', async () => {
    const carregado = anuncioFalso({ loaded: true, showRejeita: true })
    criar.mockReturnValue(carregado.anuncio as unknown as ReturnType<typeof criar>)

    const { mostrarInterstitial, precarregar } = carregarAds()
    precarregar()
    carregado.ouvintes['loaded']?.forEach((cb) => cb())

    await expect(mostrarInterstitial()).resolves.toBe(false)
  })

  it('resolve por PRAZO quando o SDK nunca responde — a rede de segurança', async () => {
    jest.useFakeTimers()
    const carregado = anuncioFalso({ loaded: true })
    criar.mockReturnValue(carregado.anuncio as unknown as ReturnType<typeof criar>)

    const { mostrarInterstitial, precarregar } = carregarAds()
    precarregar()
    carregado.ouvintes['loaded']?.forEach((cb) => cb())

    const promessa = mostrarInterstitial()
    await Promise.resolve()

    // Nenhum evento é emitido: é o caso do SDK travado. Só o prazo salva.
    await jest.advanceTimersByTimeAsync(9_000)
    await expect(promessa).resolves.toBe(false)
  })

  it('não explode quando o módulo nativo falha ao instanciar', async () => {
    criar.mockImplementation(() => {
      throw new Error('sem módulo nativo')
    })

    const { mostrarInterstitial, precarregar } = carregarAds()
    expect(() => precarregar()).not.toThrow()
    await expect(mostrarInterstitial()).resolves.toBe(false)
  })
})
