# Atualização e publicação

Duas atualizações existem, e confundi-las é a fonte de quase todo problema de OTA.

| | OTA (EAS Update) | Nativa (Play Store) |
|---|---|---|
| Troca | só o JavaScript | o binário inteiro |
| Chega | sozinha, em segundos | pela loja, com revisão |
| Entrega módulo nativo novo? | **não** | sim |
| Custa dado do jogador | pouco (só o bundle) | o app inteiro |
| Alcance | quem está na mesma `version` | todos |

## Como o runtime amarra as duas

`app.config.ts` define `runtimeVersion: { policy: 'appVersion' }` — o runtime **é** a
`version` do app. Consequência que precisa estar clara antes de qualquer release:

- Publicar OTA na mesma `version` → chega para quem já tem o app. É o caso comum.
- Subir a `version` e buildar → aquele runtime muda, e **os clientes antigos param
  de receber OTA**. Eles não têm como saber disso sozinhos.

É esse "não têm como saber" que o aviso de atualização nativa resolve.

Sem a política de runtime, o cenário ruim é concreto: um OTA com JS que chama um
módulo nativo que o aparelho não tem faz o app abrir e fechar na cara do jogador,
e ele não tem como voltar — o bundle ruim já está gravado.

## Aviso de atualização nativa

`src/hooks/useAppUpdate.ts` + `src/components/shared/UpdatePrompt.tsx`.

Quem sabe se existe versão nova é a **própria Google Play**, pela In-App Updates
API (`expo-in-app-updates`). Não existe tabela de versão nossa: a loja é a fonte
de verdade, e enquanto a publicação está em revisão o jogador simplesmente não é
avisado — que é o comportamento correto.

Decisões que estão no código e valem repetir:

- **Nativa vence OTA.** Se as duas aparecem, só a nativa resolve; o runtime
  antigo já não recebe nada de novo. Existe teste travando essa prioridade.
- **OTA só é anunciada depois de baixada.** Anunciar antes transformaria o aviso
  em "espere aí".
- **Nunca aplica sozinho.** Reiniciar para aplicar OTA no meio de uma partida
  derruba o jogador da sala e, para o resto da mesa, parece queda de conexão.
- **Só na tela inicial.** As duas ações interrompem o app (reiniciar, ou sair para
  a loja); ali não há partida para atrapalhar.
- **Update flexível, não imediato.** O imediato prende a tela numa barra de
  progresso em tela cheia — se pegar alguém no meio de uma partida, a mesa perde
  o jogador.
- **Falha é silêncio.** Sem Play Services, APK instalado por fora, rede ruim: o
  jogador não é avisado e nada quebra. Atualização é conveniência.
- **Fallback garantido para a loja.** Se o fluxo da Play não abre, o app abre a
  página do app via `market://` e, na falta disso, o link https.

O hook fica inerte quando `__DEV__` ou `!Updates.isEnabled` — as duas APIs são
módulos nativos e não existem no Expo Go. A porta é avaliada na chamada, não no
carregamento do módulo, para poder ser exercitada em teste.

## Publicar uma OTA

```bash
npx eas-cli update --branch preview  --message "o que mudou"
npx eas-cli update --branch production --message "o que mudou"
```

Os canais (`development`/`preview`/`production`) estão nos perfis do `eas.json` e
apontam para branches de mesmo nome.

**Antes de publicar, confira se a mudança é OTA-able:** se ela adiciona ou
atualiza dependência nativa (qualquer coisa com pasta `android/`/`ios/` ou plugin
de config), não é OTA — é build novo.

## Publicar na Play Store

O que já está pronto no repositório:

- Perfil `production` no `eas.json` com `distribution: store`, que produz **AAB**
  (o formato que a Play exige) e `autoIncrement` do `versionCode` com
  `appVersionSource: remote` — o contador vive no EAS, não no arquivo.
- Bloco `submit.production.android` apontando para `./play-service-account.json`,
  faixa `internal` e `releaseStatus: draft`.
- `package`: `com.robsonsolano.impostorapp` (não muda depois da primeira
  publicação — é a identidade do app na loja para sempre).

O que depende de ação no Google Play Console, e **não dá para automatizar daqui**:

1. Criar a conta de desenvolvedor Google Play (taxa única de US$ 25) e criar o app
   no Console com o mesmo `package`.
2. Criar uma **conta de serviço** com acesso à API do Google Play e baixar o JSON
   para `play-service-account.json` na raiz (já está no `.gitignore` — é
   credencial de publicação e não pode ir para o repositório).
3. Preencher a ficha da loja: descrição, ícone, capturas de tela, classificação de
   conteúdo e a política de privacidade (a Play exige URL de política mesmo para
   app sem conta — e este app cria sessão anônima, o que precisa estar descrito).

Com isso no lugar:

```bash
npx eas-cli build --platform android --profile production
npx eas-cli submit --platform android --profile production --latest
```

A primeira subida de um app novo geralmente tem que ser feita **à mão** no
Console (a API da Play não aceita o primeiro AAB de um app que nunca publicou);
da segunda em diante o `submit` resolve.

### Sobre a In-App Updates API e teste

O aviso de atualização nativa só funciona de verdade num app **instalado pela
Play** — a API consulta a loja sobre o pacote instalado. Num APK de preview
instalado à mão, `checkForUpdate()` falha e o app segue sem avisar nada (que é o
fallback correto). Ou seja: esse fluxo só pode ser validado de ponta a ponta
depois da primeira publicação, usando a faixa de teste interno com duas versões
diferentes. O que dá para verificar antes é o que existe hoje: tipos, lint,
testes da regra de prioridade e do fallback, e que o app sobe com os módulos
nativos presentes.
