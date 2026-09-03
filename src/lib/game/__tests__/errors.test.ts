import { GAME_ERROR_CODES, isGameRuleError, toDisplayError } from '@/lib/game/errors'

describe('toDisplayError', () => {
  it('repassa a mensagem do banco quando o código é uma regra de jogo (IM00x)', () => {
    const error = { code: GAME_ERROR_CODES.WRONG_PHASE, message: 'A sala não está em votação.' }
    expect(toDisplayError(error)).toBe('A sala não está em votação.')
  })

  it('devolve mensagem genérica para código desconhecido, mesmo com message', () => {
    // "duplicate key value violates unique constraint" não ajuda ninguém na tela.
    const error = { code: '23505', message: 'duplicate key value violates unique constraint' }
    expect(toDisplayError(error)).toBe('Algo deu errado. Tente de novo.')
  })

  it('repassa direto o erro de "Anonymous sign-ins" desabilitado', () => {
    const error = {
      message: 'Anonymous sign-ins are disabled',
    }
    expect(toDisplayError(error)).toBe('Anonymous sign-ins are disabled')
  })

  it('cai para a mensagem de um Error comum quando não é regra nem o aviso de auth', () => {
    expect(toDisplayError(new Error('falha de rede'))).toBe('falha de rede')
  })

  it('devolve mensagem genérica para valor sem forma nenhuma de erro', () => {
    expect(toDisplayError(null)).toBe('Algo deu errado. Tente de novo.')
    expect(toDisplayError('string solta')).toBe('Algo deu errado. Tente de novo.')
  })
})

describe('isGameRuleError', () => {
  it('reconhece qualquer código IM00x como regra de jogo', () => {
    for (const code of Object.values(GAME_ERROR_CODES)) {
      expect(isGameRuleError({ code })).toBe(true)
    }
  })

  it('recusa código fora do padrão IM00[1-5]', () => {
    expect(isGameRuleError({ code: 'IM006' })).toBe(false)
    expect(isGameRuleError({ code: '23505' })).toBe(false)
    expect(isGameRuleError({})).toBe(false)
    expect(isGameRuleError(null)).toBe(false)
  })

  it('filtra por código específico quando informado', () => {
    const error = { code: GAME_ERROR_CODES.NOT_FOUND }
    expect(isGameRuleError(error, GAME_ERROR_CODES.NOT_FOUND)).toBe(true)
    expect(isGameRuleError(error, GAME_ERROR_CODES.FORBIDDEN)).toBe(false)
  })
})
