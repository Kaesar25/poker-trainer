import { describe, it, expect } from 'vitest'
import { parseCard } from './cards'
import { evaluate } from './evaluator'
import { createGame, startHand, applyAction, legalActions, totalPot, type GameState } from './game'

const h = (s: string) => s.split(' ').map(parseCard)

describe('evaluator', () => {
  it('ranks categories in order', () => {
    const hands = [
      'As Ks Qs Js Ts 2d 3c', // straight flush
      'Ah Ad Ac As 2d 3c 4h', // quads
      'Ah Ad Ac Ks Kd 3c 4h', // full
      'Ah 9h 5h 3h 2h Kd 4c', // flush
      'Ah Kd Qc Js Tc 2d 3c', // straight
      'Ah Ad Ac 5s Kd 3c 4h', // trips
      'Ah Ad Kc Ks 2d 3c 4h', // two pair
      'Ah Ad Kc Qs 2d 3c 4h', // pair
      'Ah Kd Qc 9s 2d 3c 4h', // high
    ]
    const scores = hands.map((x) => evaluate(h(x)).score)
    for (let i = 0; i < scores.length - 1; i++) expect(scores[i]).toBeGreaterThan(scores[i + 1])
  })
  it('handles wheel straight', () => {
    const v = evaluate(h('Ah 2d 3c 4s 5h Kd Qc'))
    expect(v.category).toBe(4)
    expect(v.kickers[0]).toBe(5)
  })
  it('compares kickers', () => {
    const a = evaluate(h('Ah Ad Kc 9s 2d'))
    const b = evaluate(h('As Ac Qc 9s 2d'))
    expect(a.score).toBeGreaterThan(b.score)
  })
})

function fresh(stacks: number[]): GameState {
  const g = createGame(
    stacks.map((s, i) => ({ id: i, name: `P${i}`, stack: s, isBot: i !== 0 })),
    { sb: 10, bb: 20, ante: 0 },
  )
  let seed = 42
  const rng = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296)
  return startHand(g, rng)
}

describe('game flow', () => {
  it('posts blinds and sets first actor UTG', () => {
    const s = fresh([1000, 1000, 1000])
    expect(totalPot(s)).toBe(30)
    expect(s.dealer).toBe(0)
    expect(s.acting).toBe(0) // 3-handed: dealer acts first preflop
  })
  it('chip conservation across a full hand', () => {
    let s = fresh([1000, 1000, 1000])
    const total = () => s.players.reduce((a, p) => a + p.stack, 0) + totalPot(s)
    expect(total()).toBe(3000)
    let guard = 0
    while (s.street !== 'showdown' && guard++ < 50) {
      const la = legalActions(s)
      s = applyAction(s, la.canCheck ? { type: 'check' } : { type: 'call' })
    }
    expect(s.street).toBe('showdown')
    expect(s.players.reduce((a, p) => a + p.stack, 0)).toBe(3000)
    expect(s.result?.winners.length).toBeGreaterThan(0)
  })
  it('ends hand when all fold', () => {
    let s = fresh([1000, 1000, 1000])
    s = applyAction(s, { type: 'fold' })
    s = applyAction(s, { type: 'fold' })
    expect(s.street).toBe('showdown')
    expect(s.players[2].stack).toBe(1010)
  })
  it('side pots with short stack all-in', () => {
    let s = fresh([1000, 50, 1000])
    // P0 (dealer) raises to 200, P1 (SB, 50) calls all-in, P2 (BB) calls
    s = applyAction(s, { type: 'raise', amount: 200 })
    s = applyAction(s, { type: 'call' })
    expect(s.players[1].allIn).toBe(true)
    s = applyAction(s, { type: 'call' })
    // flop: P2 acts first, both check to river
    let guard = 0
    while (s.street !== 'showdown' && guard++ < 20) s = applyAction(s, { type: 'check' })
    const stacks = s.players.map((p) => p.stack)
    expect(stacks.reduce((a, b) => a + b, 0)).toBe(2050)
    // P1 can never win more than 150
    expect(stacks[1]).toBeLessThanOrEqual(150)
  })
  it('min raise rules', () => {
    let s = fresh([1000, 1000, 1000])
    let la = legalActions(s)
    expect(la.minRaiseTo).toBe(40)
    s = applyAction(s, { type: 'raise', amount: 60 })
    la = legalActions(s)
    expect(la.callAmount).toBe(50) // SB has 10 in
    expect(la.minRaiseTo).toBe(100)
  })
})
