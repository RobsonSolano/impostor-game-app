/**
 * Plural e concordância em PT-BR.
 *
 * Existe porque o app conta coisas em oito lugares diferentes — jogadores no
 * lobby, quem já viu o card, votos na apuração, pontos no placar — e cada tela
 * tinha reescrito o mesmo ternário. Contagem errada em português é o tipo de
 * detalhe que denuncia software traduzido, e concentrar aqui é o que permite
 * corrigir uma vez e valer para todas as telas.
 *
 * `plural` recebe as duas formas em vez de tentar derivar o plural sozinho:
 * "jogador → jogadores" e "voto → votos" seguem regras diferentes, e um
 * pluralizador genérico erraria em português mais do que acertaria.
 */
export function plural(count: number, singular: string, pluralForm: string): string {
  return count === 1 ? singular : pluralForm
}

/**
 * O verbo concorda com a contagem: "Falta 1 jogador", "Faltam 2 jogadores".
 *
 * Sem isto sai "Faltam 1 jogador", que é o erro que estava na tela do lobby (e
 * está no web também, de onde foi copiado).
 */
export function agree(count: number, singular: string, pluralForm: string): string {
  return count === 1 ? singular : pluralForm
}

/** "1 jogador" / "3 jogadores" — contagem e substantivo já concordando. */
export function countOf(count: number, singular: string, pluralForm: string): string {
  return `${count} ${plural(count, singular, pluralForm)}`
}
