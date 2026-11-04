import { it, expect } from 'vitest'
import { describeDetailed } from '../src/engine/evaluator'
import { parseCard } from '../src/engine/cards'
const h = (s: string) => s.split(' ').map(parseCard)
it('describes hands', () => {
  expect(describeDetailed(h('As Kd'), h('Ah 7c 2d')).made).toMatch(/Top paire \(as\), kicker roi/)
  expect(describeDetailed(h('Qs Qd'), h('Jh 7c 2d')).made).toMatch(/Overpair/)
  expect(describeDetailed(h('7s 7d'), h('7h Kc 2d')).made).toMatch(/set/)
  const d = describeDetailed(h('9h 8h'), h('7h 6d 2h'))
  expect(d.draws.some((x) => x.includes('couleur'))).toBe(true)
  expect(d.draws.some((x) => x.includes('quinte ouvert') && x.includes('8 outs'))).toBe(true)
  expect(describeDetailed(h('Ah Kh'), h('2c 2d 9s')).nutsWarning).toMatch(/pairé/)
  expect(describeDetailed(h('As Ks'), []).made).toMatch(/As-roi assortis/)
})
