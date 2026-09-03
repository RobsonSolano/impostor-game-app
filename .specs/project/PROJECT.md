# Jogo do Impostor — mobile

**Visão:** porte para React Native (Expo) do [Jogo do Impostor](../../../impostor) web — jogo de dedução social onde todos recebem a mesma palavra secreta, exceto um impostor que precisa blefar para não ser descoberto. Mesmo banco, mesmas regras, mesma identidade visual do web; a superfície nova é o celular, e o que o celular acrescenta é vibração como canal de informação.

**Para:** grupos de 3 a 12 pessoas, com celular. Serve tanto a mesa de bar (um aparelho passando de mão em mão, todos fisicamente juntos) quanto o grupo remoto (cada um com o seu, numa call ou no Discord) — com o fluxo idêntico nos dois casos.

**Resolve:** o web já resolve distribuição secreta, apuração de votos e desempate sem exigir cartas físicas ou narrador. O mobile resolve o problema específico de jogar numa mesa real: a tela do celular fica longe de quem não está com ele, o ambiente é barulhento, e ninguém consegue ficar checando a tela esperando a própria vez. A vibração avisa "chegou sua vez" sem que a mesa inteira precise prestar atenção no aparelho.

## Objetivos

- Mesmo tempo de partida do web: sala aberta a resultado em poucos minutos, sem tutorial.
- A vibração tem que chegar no momento certo e nunca no momento errado — é o único sinal que funciona com o celular guardado ou a tela apagada, mas é decorativa por contrato: nenhuma regra de jogo depende dela.
- Paridade visual com o web: quem já jogou numa tela reconhece a identidade (verde neon, fundo escuro, glow) na outra.
- Zero regra de jogo duplicada no cliente — a mesma garantia do web, na mesma medida.
- O app funciona em celular dobrável, tablet e com teclado aberto, sem depender de uma medida de tela fixa.

## Stack

Ver [`.specs/codebase/STACK.md`](../codebase/STACK.md) para a lista de dependências com versão e papel. Resumo: Expo SDK 57, React Native 0.86, React 19.2, expo-router, Reanimated 4 + Gesture Handler, Supabase (mesmo banco do web), Jest + `jest-expo`.

## Escopo

**Dentro do escopo deste porte:**

- Todas as fases da máquina de estados do web: `LOBBY → WORD_REVEAL → DISCUSSION → VOTING → (DISCUSSION ↺ VOTING) → LAST_CHANCE → GAME_OVER`, incluindo o ciclo de turnos de dica com prazo (15s primeiro turno, 20s os seguintes) e a rodada extra quando a votação empata ou "pular" vence.
- 3 a 12 jogadores por sala, código de sala de 4 caracteres.
- Pontuação acumulada por partida na mesma sala: verdadeiros +1 cada, impostor descoberto 0, impostor não descoberto +2, impostor que rouba a vitória na Última Chance (acertando a palavra em 5 segundos entre 4 opções) +3. "Jogar Novamente" mantém sala e placar, sorteia palavra e impostor novos.
- Modo Anti-Bisbilhoteiro adaptado para toque: segurar 2 segundos para revelar o card, soltar esconde na hora (`HoldToReveal`).
- Vibração por intenção em cada momento de jogo relevante (ver `src/lib/haptics.ts` e o README).
- Compatibilidade com celular dobrável, tablet e teclado aberto (sem `Dimensions.get`).

**Explicitamente fora de escopo:**

- Banco próprio. O schema, as migrations, a RLS e os testes de regra de jogo são do repositório web (`../impostor`); este app é só cliente. Não existe pasta `supabase/` aqui de propósito.
- Contas persistentes, login social, histórico entre sessões — mesma decisão do web, só autenticação anônima.
- Chat de texto ou voz no app — as dicas e a conversa continuam sendo faladas ou digitadas fora do app conforme o grupo prefira.
- Gerenciar ordem da mesa ou "sua vez de falar" — o app dá ritmo à dica **escrita**, nunca à conversa (regra 6 herdada do web).
- Notificação push, deep link de convite, ou qualquer superfície de distribuição além de abrir o app e digitar o código.
- Build de produção assinado e publicado nas lojas — ver `.specs/project/STATE.md` para o que falta antes disso.

## Restrições

- **Técnicas:** as mesmas do web — o segredo não pode trafegar para quem não deveria vê-lo (RLS é por linha, não por coluna), e toda transição de fase é atômica no banco.
- **Técnicas, próprias do celular:** o segredo revelado por toque não pode sobreviver ao dedo soltar a tela nem a uma troca de app em segundo plano (ver regra 8 do `AGENTS.md` e `HoldToReveal` em `.specs/codebase/ARCHITECTURE.md`). O SO suspende timers e WebSocket com o app em segundo plano sem avisar — o app tem que se recuperar sozinho ao voltar para o primeiro plano.
- **Recursos:** projeto pessoal de estudos, um desenvolvedor (mais agentes trabalhando em paralelo no código), sem orçamento para serviço de notificação ou conta paga de loja de app.
- **Produto:** a tela é usada em pé ou na mesa, numa mão, num ambiente barulhento — decisões de UI privilegiam alvo de toque grande e feedback tátil sobre densidade de informação.
