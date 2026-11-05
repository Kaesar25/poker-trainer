import { it } from 'vitest'
import { createGame, startHand, applyAction, isHandOver, legalActions, type Action, type BotProfile } from '../src/engine/game'
import { botDecideFull, ALL_PROFILES } from '../src/engine/bots'
import { advise } from '../src/engine/coach'

// A player who always follows the coach, against 5 random bot profiles.
it('coach bench', () => {
  let seed = Number(process.env.SEED ?? 3)
  const rng = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296)
  const HANDS = Number(process.env.HANDS ?? 1500)
  let net = 0, vpip = 0
  for (let h = 0; h < HANDS; h++) {
    const pool = ALL_PROFILES.slice().sort(() => rng() - 0.5).slice(0, 5) as BotProfile[]
    let g = createGame([{ id: 0, name: 'coach', stack: 2000, isBot: false }, ...pool.map((p, i) => ({ id: i + 1, name: p, stack: 2000, isBot: true, profile: p }))], { sb: 10, bb: 20, ante: 0 })
    g = { ...g, dealer: Math.floor(rng() * 6) - 1 }
    g = startHand(g, rng)
    let k = 0
    while (!isHandOver(g) && k++ < 300) {
      if (g.acting === 0) {
        const a = advise(g, 0, rng)!
        const la = legalActions(g, 0)
        let act: Action = { type: a.action === 'bet' ? 'bet' : a.action } as Action
        if (a.action === 'raise' || a.action === 'bet') act = { type: a.action, amount: a.amount }
        if (a.action === 'check' && !la.canCheck) act = { type: 'fold' }
        g = applyAction(g, act)
      } else g = applyAction(g, botDecideFull(g, rng).action)
    }
    net += (g.players[0].stack - 2000) / 20
    if (g.history.some((a) => a.playerId === 0 && a.street === 'preflop' && a.action !== 'fold' && a.action !== 'sb' && a.action !== 'bb' && a.action !== 'check')) vpip++
  }
  console.log('COACH bb/100', (net / HANDS * 100).toFixed(1), 'vpip', (vpip / HANDS * 100).toFixed(0))
}, 600000)
