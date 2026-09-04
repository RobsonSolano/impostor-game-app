# Material da Play Store

Tudo aqui é gerado a partir dos tokens de `src/theme/` e dos componentes de
produção — o ícone é o mesmo `UserRoundSearch` que o app desenha na tela
inicial, e os prints são as telas reais rodando no emulador, não mockups.

## Arquivos

| Arquivo | Onde entra no Console | Requisito |
|---|---|---|
| `play-icon-512.png` | Ícone do app | 512×512, PNG 32-bit, **sem** transparência |
| `play-feature-graphic-1024x500.png` | Gráfico de destaque | 1024×500, obrigatório |
| `screenshots/*.png` | Capturas de celular | 1080×1920 (16:9), de 2 a 8 imagens |

O ícone da loja é achatado sobre `#07080b` de propósito: a Play recompõe o ícone
sobre fundos próprios em várias vitrines, e um PNG com alpha aparece com halo
cinza em volta.

## Os prints, na ordem

Servem como narrativa — quem desliza entende o jogo sem ler a descrição.

1. `01-home` — a porta de entrada, com nome preenchido
2. `02-lobby` — o código de 4 letras que a mesa lê em voz alta
3. `03-card` — **a palavra secreta revelada**, o coração do jogo
4. `04-dicas` — a ordem sorteada, a dica dada e o contador correndo
5. `05-votacao` — o carimbo de SUSPEITO
6. `06-drumroll` — a apuração, antes de revelar
7. `07-fim` — o impostor, a palavra e o confete

Os prints saem em 1080×1920 porque a resolução nativa do emulador (1080×2400)
tem proporção 1:2,22 e **estoura o limite de 2:1 da Play**. O emulador foi
ajustado com `adb shell wm size 1080x1920` antes de capturar.

## Como regerar

Ícones e gráfico de destaque:

```bash
node <caminho>/gerar.js   # o script fica no scratchpad da sessão
```

Se o script não estiver mais por aí, o essencial dele é: renderizar o glifo
`UserRoundSearch` do lucide (24×24, traço 2, ponta redonda) sobre `#07080b` com
halo radial em `#39ff14`, usando `sharp` para SVG → PNG. A camada de frente do
ícone adaptativo tem que caber na zona segura (glifo de 300 num canvas de 512),
porque o Android recorta a frente num círculo de ~66% do lado.

Prints: montar uma rota temporária que renderize cada fase com dados fabricados,
ajustar o emulador para 16:9 e capturar com `adb exec-out screencap`.

## Texto da ficha (rascunho para o Console)

**Nome:** Impostor

**Descrição curta** (até 80 caracteres):
> Todos recebem a mesma palavra. Menos um. Descubram quem está blefando.

**Descrição completa:**

> Todos recebem a mesma palavra secreta. Menos um.
>
> O impostor não sabe qual é a palavra, e tem que blefar a partir das dicas que
> os outros escrevem — sem se entregar. Os outros têm que achar o impostor sem
> entregar a palavra de graça.
>
> COMO FUNCIONA
>
> • Alguém cria a sala e passa o código de 4 letras para a mesa.
> • Cada um vê seu card secreto segurando o dedo na tela. Solta, esconde na hora.
> • O app sorteia a ordem e cada um escreve UMA palavra relacionada à secreta,
>   com 30 segundos para escrever. A dica aparece no celular de todos.
> • Terminada a volta, o host escolhe: mais uma rodada de dicas, ou a votação.
> • Eliminaram um inocente? O impostor ganha. Acertaram o impostor? Ele ainda tem
>   5 segundos para adivinhar a palavra e roubar a vitória.
>
> DE 3 A 12 JOGADORES
>
> Serve na mesa do bar, com os celulares passando de mão em mão, e serve a
> distância, cada um com o seu. O mesmo fluxo funciona nos dois: o app dá ritmo à
> dica escrita e nunca interrompe a conversa.
>
> O CELULAR AVISA A SUA VEZ
>
> Numa mesa, ninguém fica olhando a tela esperando a própria vez. O jogo usa
> vibração para isso: você sente quando chega a sua vez de escrever, quando o
> tempo está acabando e quando a partida termina.
>
> SEM CADASTRO
>
> Não pede e-mail, senha nem login social. Abre e joga.

**Categoria:** Jogos → Quebra-cabeça (ou Casual)
**Classificação de conteúdo:** responder o questionário como jogo social sem
conteúdo sensível; o app tem **texto escrito por usuários** (a dica), com filtro
de palavras vulgares e expulsão na terceira ocorrência — isso precisa ser
declarado no questionário.

## Política de privacidade — o que precisa constar

A Play exige URL de política mesmo para app sem cadastro. O que este app de fato
faz, e que a política tem que dizer:

- Cria uma **sessão anônima** no Supabase (sem e-mail, sem nome real obrigatório,
  sem login social). O identificador é gerado pelo servidor e fica guardado no
  aparelho.
- Guarda, enquanto a sala existe: o **apelido** digitado, a cor de avatar
  sorteada, as **dicas escritas** e os votos.
- **Exibe anúncio** (Google AdMob), um único interstitial no momento em que o
  host cria a sala. Para isso o SDK do Google acessa o **identificador de
  publicidade do aparelho** e dados de dispositivo. Isso **precisa** estar
  declarado no formulário de Segurança dos Dados da Play e na política — é o item
  que muda o formulário de "não coleta nada" para "coleta e compartilha com
  terceiro".
- O consentimento é coletado pela UMP do próprio Google antes da primeira
  requisição de anúncio.
- Não coleta contatos, localização nem dados de uso próprios. Não há analytics
  de terceiros além do necessário ao AdMob.
- A `anon key` do Supabase é pública por design; o acesso aos dados é restrito
  por RLS no banco (cada jogador só lê a própria linha do card secreto).
