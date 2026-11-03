import { it, expect } from 'vitest'
import { createTournament, targetField, registerMarathonBusts, outsideAverageStack, prizeFor } from '../src/engine/tournament'
import { createGame, startHand, applyAction, isHandOver } from '../src/engine/game'
import { botDecide } from '../src/engine/bots'

it('marathon field shrinks over levels and never below the table', () => {
  const t = createTournament('marathon', 'live', 8, { entrants: 60, startStack: 10000 })
  expect(targetField(t, 0, 8)).toBe(60)
  const mid = targetField(t, 7, 8)
  expect(mid).toBeLessThan(60); expect(mid).toBeGreaterThan(8)
  expect(targetField(t, 14, 5)).toBe(5)
  expect(t.payouts.length).toBe(9)
  expect(prizeFor(t, 1)).toBeGreaterThan(prizeFor(t, 9))
})

it('marathon busts get field places and refills use the outside average', () => {
  let t = createTournament('marathon', 'live', 4, { entrants: 60, startStack: 1000 })
  let seed = 3
  const rng = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296)
  let g = createGame([0, 1, 2, 3].map((i) => ({ id: i, name: 'P' + i, stack: i === 1 ? 40 : 1000, isBot: true, profile: 'aggressive' as const })), { sb: 10, bb: 20, ante: 0 })
  t = { ...t, field: 30 }
  for (let h = 0; h < 30 && !g.players[1].out; h++) {
    g = startHand(g, rng)
    let k = 0
    while (!isHandOver(g) && k++ < 100) g = applyAction(g, botDecide(g, rng))
    t = registerMarathonBusts(t, g, 0)
  }
  expect(g.players[1].out).toBe(true)
  expect(t.finished.find((f) => f.playerId === 1)?.place).toBe(30)
  expect(t.field).toBe(29)
  const avg = outsideAverageStack(t, g)
  expect(avg).toBeGreaterThan(0)
})
