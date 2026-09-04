import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg'
import Animated, { ZoomIn } from 'react-native-reanimated'
import { Globe, Lock, UserRoundSearch } from 'lucide-react-native'
import { AppText } from '@/components/ui/Text'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Screen } from '@/components/shared/Screen'
import { UpdatePrompt } from '@/components/shared/UpdatePrompt'
import { PublicRoomList } from '@/components/game/PublicRoomList'
import { iniciarAnuncios, mostrarInterstitial, precarregar } from '@/lib/ads'
import { colors } from '@/theme/colors'
import { TOUCH_TARGET, radius, space } from '@/theme/tokens'
import { haptics } from '@/lib/haptics'
import { createRoom, joinRoom } from '@/lib/game/actions'
import { toDisplayError } from '@/lib/game/errors'
import {
  NICKNAME_MAX_LENGTH,
  ROOM_CODE_LENGTH,
  isValidNickname,
  isValidRoomCode,
  normalizeNickname,
  normalizeRoomCode,
} from '@/lib/game/room-code'

type Mode = 'criar' | 'entrar'

/** Visibilidade da sala nova. Nasce privada por padrão (regra do banco). (IMP-40) */
type Visibility = 'privada' | 'publica'

/** Os dois jeitos de entrar numa sala: pelo código, ou escolhendo da lista aberta. (IMP-40) */
type EntrarSubMode = 'codigo' | 'salas'

/** Título de sala pública: 3 a 30 caracteres no banco. Só o teto é aplicado aqui
 * (`maxLength`) — o piso vira `IM004` do próprio banco se a pessoa digitar
 * menos, exibido como qualquer outro erro de regra. */
const ROOM_TITLE_MAX_LENGTH = 30

/** Canvas do halo em SVG — mesma técnica da smoke screen que esta tela substitui. */
const HALO_SIZE = 420

/**
 * Tela inicial — criar ou entrar numa sala.
 *
 * No web esta tela também serve desktop (herói e formulário lado a lado); aqui
 * só existe a faixa de celular, então o layout é uma coluna só, com o CTA fixo
 * na base, na zona do polegar. `Screen` já cuida da coluna de tablet, do
 * respiro seguro e do teclado — nada disso se repete aqui.
 */
export function HomeScreen() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('criar')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [visibility, setVisibility] = useState<Visibility>('privada')
  const [roomTitle, setRoomTitle] = useState('')
  const [entrarSubMode, setEntrarSubMode] = useState<EntrarSubMode>('codigo')
  // Fica `true` só quando alguém tenta entrar por uma sala da lista sem ter
  // preenchido o nome — destaca o campo em vez de deixar a tentativa em
  // silêncio (ver `PublicRoomList.onMissingName`).
  const [nameMissing, setNameMissing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Guarda o comprimento anterior do código para vibrar só na transição que
  // COMPLETA os 4 caracteres — repetir o aviso a cada tecla, ou ao apagar e
  // redigitar sem completar, ensinaria o dedo a ignorar a vibração.
  const prevCodeLength = useRef(0)

  /**
   * Prepara o anúncio da criação de sala enquanto o host ainda digita o nome.
   *
   * Pré-carregar aqui é o que faz o anúncio aparecer sem espera perceptível: se
   * o download só começasse ao tocar em "Criar sala", o host ficaria olhando
   * tela parada com a sala JÁ criada — a pior ordem possível. Inerte em dev e no
   * Expo Go (o SDK é nativo).
   */
  useEffect(() => {
    void iniciarAnuncios()
    precarregar()
  }, [])

  const canSubmit =
    isValidNickname(name) &&
    (mode === 'criar' || (entrarSubMode === 'codigo' && isValidRoomCode(code))) &&
    !busy

  // O CTA fixo da base é "criar" ou "entrar por código" — no sub-modo "Salas
  // abertas" quem entra é o toque na sala da lista, então um botão fixo sem
  // alvo (nenhum código escolhido ainda) só ocuparia espaço e confundiria.
  const showFixedCta = !(mode === 'entrar' && entrarSubMode === 'salas')

  function selectMode(next: Mode) {
    if (next === mode) return
    haptics.select()
    setMode(next)
    setError(null)
    setNameMissing(false)
  }

  function selectVisibility(next: Visibility) {
    if (next === visibility) return
    haptics.select()
    setVisibility(next)
  }

  function selectEntrarSubMode(next: EntrarSubMode) {
    if (next === entrarSubMode) return
    haptics.select()
    setEntrarSubMode(next)
    setError(null)
    setNameMissing(false)
  }

  function handleNameChange(raw: string) {
    setName(raw)
    if (nameMissing) setNameMissing(false)
  }

  function handleCodeChange(raw: string) {
    // Normaliza (maiúsculas, alfabeto do jogo) mas nunca rejeita enquanto a
    // pessoa digita — recusar caractere a caractere seria hostil.
    const normalized = normalizeRoomCode(raw)
    if (normalized.length === ROOM_CODE_LENGTH && prevCodeLength.current < ROOM_CODE_LENGTH) {
      haptics.success()
    }
    prevCodeLength.current = normalized.length
    setCode(normalized)
  }

  /** Alguém tocou numa sala da lista sem nome preenchido: sem isto o toque
   * chamaria `join_room` com nome vazio e voltaria um erro de banco que não
   * explica o problema real. */
  function handleMissingName() {
    setNameMissing(true)
    setError(null)
  }

  async function createRoomFlow() {
    setBusy(true)
    setError(null)

    try {
      // Normaliza o nome antes de enviar: teclado de celular emenda espaço e
      // maiúscula automática com mais frequência que o desktop, e mandar isso
      // cru faria o `create_room` rejeitar por um detalhe invisível na tela.
      const cleanName = normalizeNickname(name)
      const result = await createRoom(cleanName, {
        isPublic: visibility === 'publica',
        title: roomTitle.trim() || undefined,
      })
      haptics.success()

      /*
       * ORDEM IMPORTA: a sala já está criada neste ponto.
       *
       * O anúncio é uma pausa antes de navegar, nunca um pré-requisito — se
       * viesse antes da RPC, um carregamento lento pareceria travamento e o host
       * acharia que a sala não foi criada. `mostrarInterstitial` resolve sempre
       * (por fechamento, erro ou prazo), então a navegação abaixo nunca fica
       * presa.
       */
      await mostrarInterstitial()

      router.push(`/sala/${result.code}`)
    } catch (err) {
      haptics.error()
      setError(toDisplayError(err))
    } finally {
      setBusy(false)
    }
  }

  /**
   * Entra numa sala por código — chamada tanto pelo CTA fixo (sub-modo
   * "Código") quanto pelo toque numa sala da lista (`PublicRoomList.onJoin`).
   * Único caminho de entrada, como no web: nenhuma sala da lista usa RPC
   * diferente de `join_room`.
   */
  async function attemptJoin(codeToJoin: string) {
    if (busy) return
    setBusy(true)
    setError(null)

    try {
      const cleanName = normalizeNickname(name)
      const result = await joinRoom(codeToJoin, cleanName)
      haptics.success()
      router.push(`/sala/${result.code}`)
    } catch (err) {
      haptics.error()
      setError(toDisplayError(err))
    } finally {
      setBusy(false)
    }
  }

  async function submit() {
    if (mode === 'criar') {
      if (!canSubmit) return
      await createRoomFlow()
      return
    }

    if (entrarSubMode !== 'codigo' || !canSubmit) return
    await attemptJoin(code)
  }

  return (
    <Screen
      action={
        showFixedCta ? (
          <Button
            label={mode === 'criar' ? 'Criar sala' : 'Entrar na sala'}
            onPress={() => void submit()}
            disabled={!canSubmit}
            busy={busy}
            size="lg"
            // A vibração de sucesso/erro já cobre a intenção desta ação; o
            // `press` genérico do Button soaria redundante em cima dela.
            // Sem `haptic={false}`: a vibração do Button é a confirmação do TOQUE, e
            // ela tem que chegar antes da RPC. Em rede ruim, esperar o
            // `haptics.success()` da resposta deixa segundos de silêncio depois do
            // dedo — e a pessoa toca de novo achando que não pegou.
          />
        ) : undefined
      }
    >
      {/*
        Aviso de atualização, e só aqui: as ações dele interrompem o app
        (reiniciar, ou sair para a loja), e na tela inicial não há partida para
        atrapalhar. Acima do herói porque um aviso que precisa de rolagem para
        ser visto não é aviso.
      */}
      <UpdatePrompt />

      <View style={styles.hero}>
        {/* Renderizado ANTES dos irmãos de propósito: em RN, ordem de
            montagem decide empilhamento sem precisar de z-index negativo. */}
        <Svg width={HALO_SIZE} height={HALO_SIZE} style={styles.halo} pointerEvents="none">
          <Defs>
            <RadialGradient id="halo" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={colors.primary} stopOpacity={0.13} />
              <Stop offset="42%" stopColor={colors.accentDeep} stopOpacity={0.04} />
              <Stop offset="70%" stopColor={colors.background} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={HALO_SIZE / 2} cy={HALO_SIZE / 2} r={HALO_SIZE / 2} fill="url(#halo)" />
        </Svg>

        <Animated.View entering={ZoomIn.duration(320)}>
          <Card tone="primary" glow padded={false} style={styles.iconCard}>
            <UserRoundSearch size={48} color={colors.primary} />
          </Card>
        </Animated.View>

        {/* Uma palavra só, toda no verde da marca: é o nome do app, e dividir
            em duas cores só faria sentido se houvesse duas palavras. */}
        <AppText variant="display" weight="bold" tone="primary" align="center">
          Impostor
        </AppText>
        <AppText variant="body" tone="muted" align="center" style={styles.subtitle}>
          Todos recebem a mesma palavra secreta. Menos um. Conversem, desconfiem e votem.
        </AppText>
      </View>

      {/* Alternador de modo. Dois alvos grandes, lado a lado — nada de dropdown:
          é a primeira decisão da tela e tem que caber no polegar sem gesto fino. */}
      <View
        style={styles.toggle}
        accessibilityRole="tablist"
        accessibilityLabel="Criar ou entrar em sala"
      >
        {(['criar', 'entrar'] as const).map((option) => (
          <Pressable
            key={option}
            onPress={() => selectMode(option)}
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === option }}
            accessibilityLabel={option === 'criar' ? 'Criar sala' : 'Entrar em sala'}
            style={[styles.toggleTab, mode === option && styles.toggleTabActive]}
          >
            <AppText variant="label" weight="semibold" tone={mode === option ? 'default' : 'muted'}>
              {option === 'criar' ? 'Criar sala' : 'Entrar em sala'}
            </AppText>
          </Pressable>
        ))}
      </View>

      <View style={styles.form}>
        <Input
          label="Seu nome"
          value={name}
          onChangeText={handleNameChange}
          placeholder="Como a mesa te chama"
          maxLength={NICKNAME_MAX_LENGTH}
          autoComplete="name"
          invalid={nameMissing}
          returnKeyType={mode === 'criar' ? 'go' : entrarSubMode === 'codigo' ? 'next' : 'done'}
          enterKeyHint={mode === 'criar' ? 'go' : entrarSubMode === 'codigo' ? 'next' : 'done'}
          onSubmitEditing={() => {
            // No modo "criar" o nome é o último campo: o teclado já pode
            // enviar. Nos outros ainda falta o código, ou não existe CTA
            // nenhum para disparar (sub-modo "Salas abertas").
            if (mode === 'criar') void submit()
          }}
        />

        {nameMissing && (
          <AppText variant="caption" tone="danger" weight="medium" accessibilityLiveRegion="polite">
            Digite seu nome para entrar na sala.
          </AppText>
        )}

        {mode === 'criar' ? (
          <View style={styles.block}>
            {/* Mesmo padrão visual do alternador Criar/Entrar acima — dois
                alvos grandes, ícone deixando a consequência óbvia antes mesmo
                de ler o texto de apoio. */}
            <View
              style={styles.subToggle}
              accessibilityRole="tablist"
              accessibilityLabel="Visibilidade da sala"
            >
              {(['privada', 'publica'] as const).map((option) => {
                const Icon = option === 'privada' ? Lock : Globe
                const selected = visibility === option
                return (
                  <Pressable
                    key={option}
                    onPress={() => selectVisibility(option)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    accessibilityLabel={option === 'privada' ? 'Sala privada' : 'Sala pública'}
                    style={[styles.subToggleTab, selected && styles.subToggleTabActive]}
                  >
                    <Icon size={18} color={selected ? colors.foreground : colors.mutedForeground} />
                    <AppText variant="label" weight="semibold" tone={selected ? 'default' : 'muted'}>
                      {option === 'privada' ? 'Privada' : 'Pública'}
                    </AppText>
                  </Pressable>
                )
              })}
            </View>

            <AppText variant="caption" tone="muted">
              {visibility === 'privada'
                ? 'Só quem tem o código entra.'
                : 'Aparece na lista para qualquer pessoa.'}
            </AppText>

            {visibility === 'publica' && (
              <Input
                label="Nome da sala (opcional)"
                value={roomTitle}
                onChangeText={setRoomTitle}
                placeholder="Mesa do bar"
                maxLength={ROOM_TITLE_MAX_LENGTH}
                returnKeyType="go"
                enterKeyHint="go"
                onSubmitEditing={() => void submit()}
              />
            )}
          </View>
        ) : (
          <View style={styles.block}>
            <View
              style={styles.subToggle}
              accessibilityRole="tablist"
              accessibilityLabel="Como entrar na sala"
            >
              {(['codigo', 'salas'] as const).map((option) => {
                const selected = entrarSubMode === option
                return (
                  <Pressable
                    key={option}
                    onPress={() => selectEntrarSubMode(option)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    accessibilityLabel={option === 'codigo' ? 'Entrar por código' : 'Salas abertas'}
                    style={[styles.subToggleTab, selected && styles.subToggleTabActive]}
                  >
                    <AppText variant="label" weight="semibold" tone={selected ? 'default' : 'muted'}>
                      {option === 'codigo' ? 'Código' : 'Salas abertas'}
                    </AppText>
                  </Pressable>
                )
              })}
            </View>

            {entrarSubMode === 'codigo' ? (
              <Input
                label="Código da sala"
                value={code}
                onChangeText={handleCodeChange}
                placeholder="X9K2"
                // `emphasis="code"` já ativa maiúsculas/sem corretor/sem sugestão
                // dentro do `Input` — repetir esses três props aqui seria código
                // morto (o próprio componente os sobrescreve).
                emphasis="code"
                maxLength={ROOM_CODE_LENGTH}
                returnKeyType="go"
                enterKeyHint="go"
                onSubmitEditing={() => void submit()}
              />
            ) : (
              <PublicRoomList
                playerName={name}
                onJoin={(roomCode) => attemptJoin(roomCode)}
                onMissingName={handleMissingName}
              />
            )}
          </View>
        )}

        {error && (
          <AppText variant="caption" tone="danger" weight="medium" accessibilityLiveRegion="polite">
            {error}
          </AppText>
        )}
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  hero: {
    position: 'relative',
    alignItems: 'center',
    paddingTop: space[8],
    paddingBottom: space[6],
  },
  halo: {
    position: 'absolute',
    top: -space[20],
    alignSelf: 'center',
  },
  iconCard: {
    padding: space[5],
    marginBottom: space[7],
    borderRadius: radius['3xl'],
    borderWidth: 2,
  },
  subtitle: {
    marginTop: space[3],
    maxWidth: 280,
  },
  toggle: {
    flexDirection: 'row',
    gap: space[1],
    backgroundColor: colors.muted,
    borderRadius: radius.xl,
    padding: space[1],
    marginBottom: space[5],
  },
  toggleTab: {
    flex: 1,
    minHeight: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
  },
  toggleTabActive: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  form: {
    gap: space[4],
  },
  // Bloco de "criar" (visibilidade + título) ou "entrar" (código/lista): gap
  // mais curto que o do formulário porque aqui os itens pertencem ao mesmo
  // sub-assunto, não são campos independentes.
  block: {
    gap: space[3],
  },
  subToggle: {
    flexDirection: 'row',
    gap: space[1],
    backgroundColor: colors.muted,
    borderRadius: radius.xl,
    padding: space[1],
  },
  subToggleTab: {
    flex: 1,
    flexDirection: 'row',
    minHeight: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    borderRadius: radius.lg,
  },
  subToggleTabActive: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
})
