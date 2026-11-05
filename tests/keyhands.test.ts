import { describe, it, expect } from 'vitest'
import { keyHands } from '../src/engine/keyhands'
import type { HandRecord } from '../src/engine/stats'

const rec = (n: number, delta: number, showdown = false): HandRecord => ({ id: 'h' + n, ts: n, mode: 'sng', handNumber: n, blinds: { sb: 10, bb: 20, ante: 0 }, heroCards: [{ rank: 14, suit: 's' }, { rank: 13, suit: 'h' }], board: [], position: 'BTN', players: [], actions: [], heroDelta: delta, heroWon: delta > 0, showdown, winners: [], log: [] } as unknown as HandRecord)

describe('keyHands', () => {
  it('ranks coach-misaligned losses first, then big losses, then the best win', () => {
    const recs = [rec(1, -400), rec(2, 60), rec(3, -100), rec(4, 900), rec(5, -800, true), rec(6, 20)]
    const k = keyHands(recs, [{ t: 0, ms: 1000, mistake: true, hand: 3 }, { t: 0, ms: 1000, mistake: true, hand: 6 }])
    expect(k[0].rec.handNumber).toBe(3)
    expect(k.map((x) => x.rec.handNumber)).toEqual([3, 5, 1, 6, 4])
    expect(k[1].reason).toMatch(/abattage/)
    expect(k[4].tone).toBe('good')
  })
  it('handles empty sessions', () => { expect(keyHands([], [])).toEqual([]) })
})
