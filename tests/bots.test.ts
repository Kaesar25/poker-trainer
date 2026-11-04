import { it, expect } from 'vitest'
import { createGame, startHand, applyAction, isHandOver } from '../src/engine/game'
import { botDecideFull, ALL_PROFILES, tableProfiles } from '../src/engine/bots'

it('every profile survives 150 hands at an 8-max table and chips are conserved', () => {
  let seed = 11
  const rng = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296)
  const profiles = tableProfiles(8, rng)
  expect(new Set(profiles).size).toBe(8)
  let s = createGame(profiles.map((p, i) => ({ id: i, name: 'B' + i, stack: 3000, isBot: true, profile: p })), { sb: 15, bb: 30, ante: 0 })
  const stats: Record<string, { hands: number; vpip: number }> = {}
  for (let h = 0; h < 150; h++) {
    s = startHand(s, rng)
    if (s.street === 'idle') break
    let g = 0
    while (!isHandOver(s) && g++ < 300) {
      const d = botDecideFull(s, rng)
      expect(d.thinkMs).toBeGreaterThan(0)
      s = applyAction(s, d.action)
    }
    expect(isHandOver(s)).toBe(true)
    expect(s.players.reduce((a, p) => a + p.stack, 0)).toBe(24000)
    for (const p of s.players) {
      const st = (stats[p.profile!] ??= { hands: 0, vpip: 0 })
      if (!p.out) { st.hands++; if (s.history.some((a) => a.playerId === p.id && a.street === 'preflop' && (a.action === 'call' || a.action === 'raise' || a.action === 'allin'))) st.vpip++ }
    }
  }
  console.log(Object.entries(stats).map(([k, v]) => `${k}:${Math.round((v.vpip / Math.max(1, v.hands)) * 100)}%`).join(' '))
  expect(ALL_PROFILES.length).toBe(12)
})
