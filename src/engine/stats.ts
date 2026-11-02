import type { Card } from './cards'
import type { ActionRecord, GameState, Street } from './game'
import type { Position } from './coach'

export interface HandRecord {
  id: string
  ts: number
  mode: 'cash' | 'sng' | 'chipleader'
  handNumber: number
  blinds: { sb: number; bb: number; ante: number }
  heroCards: Card[]
  board: Card[]
  position: Position
  players: { id: number; name: string; stackBefore: number; cards?: Card[] }[]
  actions: ActionRecord[]
  heroDelta: number
  heroWon: boolean
  showdown: boolean
  winners: { name: string; amount: number; hand?: string }[]
  log: string[]
}

export function buildRecord(before: GameState, after: GameState, heroId: number, mode: HandRecord['mode'], position: Position): HandRecord {
  const hb = before.players.find((p) => p.id === heroId)!
  const ha = after.players.find((p) => p.id === heroId)!
  const res = after.result
  const showdown = !!res && Object.keys(res.revealed).length > 1
  const startLogIdx = before.log.length
  return {
    id: `${after.handNumber}-${Date.now()}`,
    ts: Date.now(),
    mode,
    handNumber: after.handNumber,
    blinds: after.blinds,
    heroCards: hb.cards,
    board: after.board,
    position,
    players: before.players.filter((p) => !p.out).map((p) => ({ id: p.id, name: p.name, stackBefore: p.stack + p.totalBet, cards: res?.revealed[p.id] })),
    actions: after.history,
    heroDelta: ha.stack - (hb.stack + hb.totalBet),
    heroWon: !!res?.winners.some((w) => w.playerId === heroId),
    showdown,
    winners: (res?.winners ?? []).map((w) => ({ name: after.players.find((p) => p.id === w.playerId)!.name, amount: w.amount, hand: res?.descriptions[w.playerId] })),
    log: after.log.slice(startLogIdx),
  }
}

export interface HeroModel { foldToBet: number; callDown: number; samples: number }

/** How the hero reacts when facing a postflop bet (used by adaptive bots and leak detection). */
export function heroModel(records: HandRecord[], heroId: number): HeroModel {
  let fold = 0, call = 0, raise = 0
  for (const r of records.slice(-120)) {
    const streets: Street[] = ['flop', 'turn', 'river']
    for (const st of streets) {
      const acts = r.actions.filter((a) => a.street === st)
      for (let i = 1; i < acts.length; i++) {
        const a = acts[i]
        if (a.playerId !== heroId) continue
        const prev = acts[i - 1]
        if (prev.playerId !== heroId && (prev.action === 'bet' || prev.action === 'raise' || prev.action === 'allin')) {
          if (a.action === 'fold') fold++
          else if (a.action === 'call') call++
          else raise++
        }
      }
    }
  }
  const n = fold + call + raise
  return { foldToBet: n ? fold / n : 0.5, callDown: n ? call / n : 0.4, samples: n }
}

export interface Stats {
  cbet: number
  cbetOpps: number
  foldToCbet: number
  foldToCbetOpps: number
  bigLossVsCover: { count: number; chips: number }
  model: HeroModel
  hands: number
  vpip: number
  pfr: number
  af: number
  wtsd: number
  wsd: number
  net: number
  bb100: number
  byPosition: Record<string, { hands: number; net: number }>
  tournaments: { played: number; itm: number; wins: number }
}

const voluntary = (a: ActionRecord['action']) => a === 'call' || a === 'bet' || a === 'raise' || a === 'allin'

export function computeStats(records: HandRecord[], heroId: number, tournaments: { place: number | null; paid: boolean; entrants: number }[] = []): Stats {
  let vpip = 0, pfr = 0, bets = 0, calls = 0, sawFlop = 0, wtsd = 0, wsd = 0, net = 0, bbSum = 0
  let cbet = 0, cbetOpps = 0, foldToCbet = 0, foldToCbetOpps = 0
  const bigLossVsCover = { count: 0, chips: 0 }
  const byPosition: Stats['byPosition'] = {}
  for (const r of records) {
    const mine = r.actions.filter((a) => a.playerId === heroId)
    const pre = mine.filter((a) => a.street === 'preflop')
    const post = mine.filter((a) => a.street !== 'preflop')
    // c-bet: hero made the last preflop raise and is first aggressor on the flop
    const preRaises = r.actions.filter((a) => a.street === 'preflop' && (a.action === 'raise' || a.action === 'allin'))
    const heroPfr = preRaises.length > 0 && preRaises[preRaises.length - 1].playerId === heroId
    const flop = r.actions.filter((a) => a.street === 'flop')
    if (heroPfr && flop.length > 0) {
      const firstAgg = flop.find((a) => a.action === 'bet' || a.action === 'raise' || a.action === 'allin')
      const heroActedFlop = flop.some((a) => a.playerId === heroId)
      if (heroActedFlop && (!firstAgg || firstAgg.playerId === heroId || flop.findIndex((a) => a.playerId === heroId) < flop.indexOf(firstAgg))) {
        cbetOpps++
        if (firstAgg && firstAgg.playerId === heroId) cbet++
      }
    }
    if (!heroPfr && preRaises.length > 0 && flop.length > 0 && !pre.some((a) => a.action === 'fold')) {
      const firstAgg = flop.find((a) => a.action === 'bet' || a.action === 'raise' || a.action === 'allin')
      if (firstAgg && firstAgg.playerId === preRaises[preRaises.length - 1].playerId) {
        const after = flop.slice(flop.indexOf(firstAgg) + 1).find((a) => a.playerId === heroId)
        if (after) { foldToCbetOpps++; if (after.action === 'fold') foldToCbet++ }
      }
    }
    if (r.mode !== 'cash' && r.heroDelta < -20 * r.blinds.bb) {
      const me = r.players.find((p) => p.id === heroId)
      const winnerCovers = r.winners.some((w) => { const pl = r.players.find((p) => p.name === w.name); return pl && me && pl.stackBefore >= me.stackBefore })
      if (winnerCovers) { bigLossVsCover.count++; bigLossVsCover.chips += -r.heroDelta }
    }
    if (pre.some((a) => voluntary(a.action))) vpip++
    if (pre.some((a) => a.action === 'raise' || a.action === 'bet' || (a.action === 'allin' && a.amount > r.blinds.bb))) pfr++
    for (const a of post) {
      if (a.action === 'bet' || a.action === 'raise' || a.action === 'allin') bets++
      if (a.action === 'call') calls++
    }
    const folded = mine.some((a) => a.action === 'fold')
    if (r.board.length >= 3 && !pre.some((a) => a.action === 'fold')) sawFlop++
    if (r.showdown && !folded) { wtsd++; if (r.heroWon) wsd++ }
    net += r.heroDelta
    bbSum += r.heroDelta / r.blinds.bb
    const bp = (byPosition[r.position] ??= { hands: 0, net: 0 })
    bp.hands++; bp.net += r.heroDelta
  }
  const n = records.length || 1
  const streets: Street[] = ['flop']
  void streets
  return {
    cbet: cbetOpps ? cbet / cbetOpps : 0,
    cbetOpps,
    foldToCbet: foldToCbetOpps ? foldToCbet / foldToCbetOpps : 0,
    foldToCbetOpps,
    bigLossVsCover,
    model: heroModel(records, heroId),
    hands: records.length,
    vpip: vpip / n,
    pfr: pfr / n,
    af: calls === 0 ? bets : bets / calls,
    wtsd: sawFlop ? wtsd / sawFlop : 0,
    wsd: wtsd ? wsd / wtsd : 0,
    net,
    bb100: records.length ? (bbSum / records.length) * 100 : 0,
    byPosition,
    tournaments: {
      played: tournaments.length,
      itm: tournaments.filter((t) => t.paid).length,
      wins: tournaments.filter((t) => t.place === 1).length,
    },
  }
}
