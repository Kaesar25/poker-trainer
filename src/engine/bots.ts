import { newDeck, shuffle, type Card } from './cards'
import { evaluate } from './evaluator'
import { legalActions, totalPot, type Action, type BotProfile, type GameState } from './game'

/** Preflop strength 0..1 from a simple Chen-like heuristic. */
export function preflopStrength(cards: Card[]): number {
  const [a, b] = cards.slice().sort((x, y) => y.rank - x.rank)
  const hi = a.rank, lo = b.rank
  let s = 0
  const base = (r: number) => (r === 14 ? 10 : r === 13 ? 8 : r === 12 ? 7 : r === 11 ? 6 : r / 2)
  s = base(hi)
  if (hi === lo) s = Math.max(5, s * 2)
  else {
    const gap = hi - lo - 1
    if (gap === 0) s += 1
    else if (gap === 1) s -= 1
    else if (gap === 2) s -= 2
    else if (gap === 3) s -= 4
    else s -= 5
    if (a.suit === b.suit) s += 2
    if (hi <= 11 && lo <= 11 && gap <= 1) s += 1
  }
  return Math.max(0, Math.min(1, s / 20))
}

/** Monte-Carlo equity vs N random opponents (fast, few samples). */
export function equity(hole: Card[], board: Card[], opponents: number, samples = 150, rng: () => number = Math.random): number {
  const used = new Set([...hole, ...board].map((c) => c.rank + c.suit))
  const rest = newDeck().filter((c) => !used.has(c.rank + c.suit))
  let wins = 0
  for (let i = 0; i < samples; i++) {
    const d = shuffle(rest, rng)
    let k = 0
    const b = board.slice()
    while (b.length < 5) b.push(d[k++])
    const mine = evaluate([...hole, ...b]).score
    let best = true, tie = false
    for (let o = 0; o < opponents; o++) {
      const os = evaluate([d[k++], d[k++], ...b]).score
      if (os > mine) { best = false; break }
      if (os === mine) tie = true
    }
    if (best) wins += tie ? 0.5 : 1
  }
  return wins / samples
}

interface Style {
  vpip: number // threshold on preflop strength to enter
  aggression: number // probability to bet/raise when strong
  bluff: number // probability to bluff when weak
  callDown: number // extra tolerance to call
}

const STYLES: Record<BotProfile, Style> = {
  tight: { vpip: 0.45, aggression: 0.55, bluff: 0.03, callDown: -0.05 },
  loose: { vpip: 0.2, aggression: 0.35, bluff: 0.08, callDown: 0.1 },
  aggressive: { vpip: 0.3, aggression: 0.8, bluff: 0.2, callDown: 0 },
  station: { vpip: 0.2, aggression: 0.15, bluff: 0.02, callDown: 0.25 },
}

export function botDecide(s: GameState, rng: () => number = Math.random): Action {
  const p = s.players[s.acting]
  const style = STYLES[p.profile ?? 'tight']
  const la = legalActions(s)
  const pot = totalPot(s)
  const opponents = s.players.filter((q) => !q.out && !q.folded && q.id !== p.id).length
  const r = rng()

  if (s.street === 'preflop') {
    const str = preflopStrength(p.cards)
    const facingRaise = s.currentBet > s.blinds.bb
    const potOdds = la.callAmount / (pot + la.callAmount || 1)
    if (la.canCheck) {
      if (str > 0.55 && r < style.aggression) return { type: 'raise', amount: Math.round(s.blinds.bb * 3) }
      return { type: 'check' }
    }
    if (str < style.vpip - style.callDown && r > style.bluff) return { type: 'fold' }
    if (facingRaise && str < style.vpip + 0.15 && potOdds > 0.3 && r > style.callDown) return { type: 'fold' }
    if (str > 0.7 && r < style.aggression) {
      const to = Math.max(la.minRaiseTo, Math.round(s.currentBet * 3))
      return to >= la.maxRaiseTo ? { type: 'allin' } : { type: 'raise', amount: to }
    }
    if (str < 0.3 && r < style.bluff) return { type: 'raise', amount: la.minRaiseTo }
    return { type: 'call' }
  }

  const eq = equity(p.cards, s.board, Math.max(1, opponents), 120, rng)
  const potOdds = la.callAmount / (pot + la.callAmount || 1)
  const betSize = () => Math.round(pot * (0.5 + rng() * 0.35))

  if (la.canCheck) {
    if (eq > 0.6 && r < style.aggression) {
      const to = Math.max(la.minRaiseTo, betSize())
      return to >= la.maxRaiseTo ? { type: 'allin' } : { type: 'bet', amount: to }
    }
    if (eq < 0.3 && r < style.bluff) return { type: 'bet', amount: Math.max(la.minRaiseTo, Math.round(pot * 0.6)) }
    return { type: 'check' }
  }
  // facing a bet
  if (eq > 0.75 && r < style.aggression) {
    const to = Math.max(la.minRaiseTo, s.currentBet * 2 + Math.round(pot * 0.5))
    return to >= la.maxRaiseTo ? { type: 'allin' } : { type: 'raise', amount: to }
  }
  if (eq + style.callDown > potOdds + 0.05) return { type: 'call' }
  if (r < style.bluff * 0.5 && la.canRaise) return { type: 'raise', amount: la.minRaiseTo }
  return { type: 'fold' }
}
