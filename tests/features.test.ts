import { it, expect } from 'vitest'
import { createGame, startHand, applyAction, isHandOver } from '../src/engine/game'
import { botDecideFull } from '../src/engine/bots'
import { buildRecord } from '../src/engine/stats'
import { buildFrames } from '../src/engine/replay'
import { icm, callShoveIcm } from '../src/engine/icm'
import { weeklyChallenges, badges } from '../src/engine/challenges'
import { computeLeaks } from '../src/engine/leaks'
import { proSession } from '../src/engine/drills'
import { loadStore } from '../src/store'

it('replays recorded hands exactly', () => {
  let seed = 21
  const rng = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296)
  const fresh = () => createGame([0, 1, 2, 3, 4, 5].map((i) => ({ id: i, name: 'P' + i, stack: 2000, isBot: true, profile: (['tag', 'lag', 'station', 'nit', 'maniac', 'fish'] as const)[i] })), { sb: 10, bb: 20, ante: 0 })
  let g = fresh()
  let checked = 0
  for (let h = 0; h < 80; h++) {
    if (g.players[0].out || g.players.filter((p) => !p.out).length < 2) g = fresh()
    g = startHand(g, rng)
    const before = g
    let k = 0
    while (!isHandOver(g) && k++ < 200) g = applyAction(g, botDecideFull(g, rng).action)
    const rec = buildRecord(before, g, 0, 'cash', 'BTN')
    const frames = buildFrames(rec, 0, rng)!
    const last = frames[frames.length - 1].state
    expect(last.street).toBe('showdown')
    expect(last.players.map((p) => p.stack)).toEqual(g.players.map((p) => p.stack))
    checked++
  }
  expect(checked).toBeGreaterThan(60)
})

it('computes ICM', () => {
  const eq = icm([50, 50], [100, 0])
  expect(eq[0]).toBeCloseTo(50)
  const v = icm([5000, 3500, 1000, 500], [50, 30, 20])
  expect(v.reduce((a, b) => a + b, 0)).toBeCloseTo(100)
  expect(v[0]).toBeLessThan(50 * 1) // chip leader worth less than chip share of 50 %
  expect(v[3]).toBeGreaterThan(500 / 10000 * 100) // short stack worth more than chip share
  const r = callShoveIcm([80, 70, 25, 15, 9, 6], [40, 25, 15, 10], 0, 1, 3)
  expect(r.icmEq).toBeGreaterThan(r.chipEq)
})

it('weekly challenges and badges work on an empty store', () => {
  const s = loadStore()
  const w = weeklyChallenges(s)
  expect(w.list.length).toBe(3)
  expect(new Set(w.list.map((c) => c.id)).size).toBe(3)
  expect(badges(s).length).toBeGreaterThan(10)
  expect(computeLeaks(s)).toEqual([])
  expect(proSession().length).toBe(10)
})
