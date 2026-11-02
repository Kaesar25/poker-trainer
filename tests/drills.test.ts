import { it, expect } from 'vitest'
import { parseRange, handLabel, openDecision } from '../src/engine/ranges'
import { generate, type DrillType } from '../src/engine/drills'
import { parseCard } from '../src/engine/cards'

it('parses ranges', () => {
  const r = parseRange('77+, ATs+, KQo, T8s+')
  expect(r.has('AA')).toBe(true); expect(r.has('66')).toBe(false)
  expect(r.has('AJs')).toBe(true); expect(r.has('A9s')).toBe(false)
  expect(r.has('KQo')).toBe(true); expect(r.has('KQs')).toBe(false)
  expect(r.has('T9s')).toBe(true); expect(r.has('T8s')).toBe(true); expect(r.has('T7s')).toBe(false)
})
it('labels hands', () => {
  expect(handLabel([parseCard('Ks'), parseCard('As')])).toBe('AKs')
  expect(handLabel([parseCard('9d'), parseCard('Tc')])).toBe('T9o')
  expect(openDecision('AKs', 'UTG')).toBe('raise')
  expect(openDecision('72o', 'BTN')).toBe('fold')
})
it('generates valid questions for all drills', () => {
  for (const t of ['preflop', 'odds', 'outs', 'board', 'pushfold', 'icm'] as DrillType[]) {
    for (let i = 0; i < 40; i++) {
      const q = generate(t)
      expect(q.options.some((o) => o.id === q.correct)).toBe(true)
      expect(q.options.length).toBeGreaterThanOrEqual(2)
      if (q.cards) expect(q.cards.length).toBe(2)
      if (t === 'outs') { const n = Number(q.correct); expect(n).toBeGreaterThanOrEqual(1); expect(n).toBeLessThanOrEqual(20) }
    }
  }
})
