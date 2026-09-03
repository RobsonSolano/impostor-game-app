/**
 * Torna `describe`/`it`/`expect`/`jest` visíveis para o `tsc`.
 *
 * `@types/jest` está instalado e o Jest funciona em runtime sem isto (o preset
 * `jest-expo` cuida disso), mas o `tsc` deste projeto não inclui pacotes de
 * `@types` automaticamente — só os que algum arquivo importa de verdade (ver
 * `tsconfig.json`: sem `types` explícito, mas com `moduleResolution: bundler`
 * puxando tipo por import, não por busca em `node_modules/@types`). Sem esta
 * referência, todo arquivo de teste do projeto (inclusive os de outros agentes)
 * acusa "Cannot find name 'describe'" no `tsc --noEmit`.
 *
 * Um único `.d.ts` com esta referência em qualquer lugar do programa já basta
 * — os globais do Jest passam a valer para TODOS os arquivos, não só este.
 */
/// <reference types="jest" />
