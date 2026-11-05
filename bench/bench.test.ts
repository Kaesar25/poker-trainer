import { it } from 'vitest'
import { createGame, startHand, applyAction, isHandOver, type BotProfile } from '../src/engine/game'
import { botDecideFull, ALL_PROFILES } from '../src/engine/bots'

// Cash benchmark: 6-max, 100 BB, stacks reset every hand, seats rotate. Reports BB/100 and VPIP/PFR/AF per profile.
it('bench', () => {
  let seed = Number(process.env.SEED ?? 7)
  const rng = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296)
  const HANDS = Number(process.env.HANDS ?? 6000)
  const st: Record<string, { hands: number; net: number; vpip: number; pfr: number; bets: number; calls: number; sd: number; sdWon: number }> = {}
  for (const p of ALL_PROFILES) st[p] = { hands: 0, net: 0, vpip: 0, pfr: 0, bets: 0, calls: 0, sd: 0, sdWon: 0 }
  for (let h = 0; h < HANDS; h++) {
    // pick 6 distinct profiles, rotate
    const pool = ALL_PROFILES.slice()
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]] }
    const six = pool.slice(0, 6) as BotProfile[]
    let g = createGame(six.map((p, i) => ({ id: i, name: p, stack: 2000, isBot: true, profile: p })), { sb: 10, bb: 20, ante: 0 })
    g = { ...g, dealer: Math.floor(rng() * 6) - 1 }
    g = startHand(g, rng)
    let k = 0
    while (!isHandOver(g) && k++ < 300) g = applyAction(g, botDecideFull(g, rng).action)
    for (const p of g.players) {
      const s = st[p.profile!]
      s.hands++
      s.net += (p.stack - 2000) / 20
      const mine = g.history.filter((a) => a.playerId === p.id)
      if (mine.some((a) => a.street === 'preflop' && (a.action === 'call' || a.action === 'raise' || a.action === 'allin' || a.action === 'bet'))) s.vpip++
      if (mine.some((a) => a.street === 'preflop' && (a.action === 'raise' || a.action === 'allin'))) s.pfr++
      for (const a of mine) if (a.street !== 'preflop') { if (a.action === 'bet' || a.action === 'raise' || a.action === 'allin') s.bets++; if (a.action === 'call') s.calls++ }
      if (g.result && g.result.revealed[p.id]) { s.sd++; if (g.result.winners.some((w) => w.playerId === p.id)) s.sdWon++ }
    }
  }
  const rows = Object.entries(st).sort((a, b) => b[1].net / b[1].hands - a[1].net / a[1].hands)
  console.log('profile      bb/100   vpip  pfr   af   wsd')
  for (const [k, s] of rows) console.log(k.padEnd(11), (s.net / s.hands * 100).toFixed(1).padStart(7), (s.vpip / s.hands * 100).toFixed(0).padStart(5), (s.pfr / s.hands * 100).toFixed(0).padStart(4), (s.calls ? s.bets / s.calls : s.bets).toFixed(1).padStart(5), (s.sd ? s.sdWon / s.sd * 100 : 0).toFixed(0).padStart(5))
}, 600000)
