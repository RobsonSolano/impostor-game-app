import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg'
import Animated, { ZoomIn } from 'react-native-reanimated'
import { UserRoundSearch } from 'lucide-react-native'
import { AppText } from '@/components/ui/Text'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Screen } from '@/components/shared/Screen'
import { UpdatePrompt } from '@/components/shared/UpdatePrompt'
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
    isValidNickname(name) && (mode === 'criar' || isValidRoomCode(code)) && !busy

  function selectMode(next: Mode) {
    if (next === mode) return
    haptics.select()
    setMode(next)
    setError(null)
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

  async function submit() {
    if (!canSubmit) return
    setBusy(true)
    setError(null)

    try {
      // Normaliza o nome antes de enviar (o código já sai normalizado do
      // `onChangeText`): teclado de celular emenda espaço e maiúscula
      // automática com mais frequência que o desktop, e mandar isso cru faria
      // o `create_room`/`join_room` rejeitar por um detalhe invisível na tela.
      const cleanName = normalizeNickname(name)
      const result =
        mode === 'criar' ? await createRoom(cleanName) : await joinRoom(code, cleanName)
      haptics.success()

      /*
       * ORDEM IMPORTA: a sala já está criada neste ponto.
       *
       * O anúncio é uma pausa antes de navegar, nunca um pré-requisito — se
       * viesse antes da RPC, um carregamento lento pareceria travamento e o host
       * acharia que a sala não foi criada. E só na CRIAÇÃO: quem entra numa sala
       * já existente está sendo esperado pela mesa, e fazer essa pessoa ver
       * anúncio atrasaria a partida dos outros.
       *
       * `mostrarInterstitial` resolve sempre (por fechamento, erro ou prazo),
       * então a navegação abaixo nunca fica presa.
       */
      if (mode === 'criar') await mostrarInterstitial()

      router.push(`/sala/${result.code}`)
    } catch (err) {
      haptics.error()
      setError(toDisplayError(err))
      setBusy(false)
    }
  }

  return (
    <Screen
      action={
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
          onChangeText={setName}
          placeholder="Como a mesa te chama"
          maxLength={NICKNAME_MAX_LENGTH}
          autoComplete="name"
          returnKeyType={mode === 'criar' ? 'go' : 'next'}
          enterKeyHint={mode === 'criar' ? 'go' : 'next'}
          onSubmitEditing={() => {
            // No modo "criar" o nome é o último campo: o teclado já pode
            // enviar. No modo "entrar" ainda falta o código.
            if (mode === 'criar') void submit()
          }}
        />

        {mode === 'entrar' && (
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
})
