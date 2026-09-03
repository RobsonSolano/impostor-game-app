import { fireEvent, render, screen } from '@testing-library/react-native'
import { Text } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { Sheet } from '@/components/ui/Sheet'

const CONTEUDO = 'conteúdo do sheet'

/**
 * `Sheet` lê `useSafeAreaInsets()` sem fallback — fora de um
 * `<SafeAreaProvider>` com métricas, o hook lança. Mesmo wrapper usado em
 * `HomeScreen.test.tsx` para o mesmo problema.
 */
function renderSheet(props: Partial<Parameters<typeof Sheet>[0]> = {}) {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <Sheet open={false} onClose={() => {}} {...props}>
        <Text>{CONTEUDO}</Text>
      </Sheet>
    </SafeAreaProvider>,
  )
}

describe('Sheet', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('não mostra o conteúdo antes de abrir', () => {
    renderSheet({ open: false })
    expect(screen.queryByText(CONTEUDO)).toBeNull()
  })

  it('mostra o conteúdo quando open é true', () => {
    renderSheet({ open: true })
    expect(screen.getByText(CONTEUDO)).toBeTruthy()
  })

  it('esconde o conteúdo depois de fechar', () => {
    const { rerender } = renderSheet({ open: true })
    expect(screen.getByText(CONTEUDO)).toBeTruthy()

    rerender(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
        }}
      >
        <Sheet open={false} onClose={() => {}}>
          <Text>{CONTEUDO}</Text>
        </Sheet>
      </SafeAreaProvider>,
    )
    jest.advanceTimersByTime(2000)

    expect(screen.queryByText(CONTEUDO)).toBeNull()
  })

  it('toque no fundo chama onClose quando dismissable (default)', () => {
    const onClose = jest.fn()
    renderSheet({ open: true, onClose })

    fireEvent.press(screen.getByLabelText('Fechar'))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('toque no fundo NÃO chama onClose quando dismissable={false}', () => {
    const onClose = jest.fn()
    renderSheet({ open: true, onClose, dismissable: false })

    fireEvent.press(screen.getByLabelText('Fechar'))

    expect(onClose).not.toHaveBeenCalled()
  })

  /**
   * NÃO escrevemos aqui o teste da corrida "reabrir durante a mola de saída"
   * (o bug documentado no comentário de `Sheet.tsx`, seção "REABERTURA DURANTE
   * A SAÍDA"): verificamos empiricamente que ele é inobservável sob o mock
   * global de `react-native-reanimated` (`jest.setup.js`).
   *
   * O mock oficial da lib (`react-native-reanimated/mock`) resolve `withSpring`
   * de forma SÍNCRONA e INCONDICIONAL — a cada chamada, o callback de
   * conclusão dispara na hora, com `finished: true`, sem qualquer noção de
   * "cancelar a mola anterior por reentrância" (o mecanismo real por trás da
   * correção). Isso colapsa a janela de "mola de saída ainda em andamento" a
   * zero: no momento em que o teste chama `rerender(open=true)`, o `visible`
   * já virou `false` de forma síncrona no `rerender(open=false)` anterior —
   * não existe estado intermediário para a reabertura interromper.
   *
   * Confirmamos isso na prática montando, à parte (fora da suíte, descartado),
   * uma versão deliberadamente SEM a correção (reabertura só fazia
   * `setVisible(true)`, sem reemitir `withSpring(0, ...)` para cancelar a mola
   * de saída) e rodando a mesma sequência (abre → fecha → avança parcial →
   * reabre → avança bem além da mola) contra ela: o conteúdo reaparecia do
   * mesmo jeito. Ou seja, esse teste passaria igual com o bug presente — é
   * exatamente o "teste que passa por acidente" que não deve existir. Ver
   * relatório desta tarefa para os detalhes.
   */
})
