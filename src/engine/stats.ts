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

export interface Stats {
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
  const byPosition: Stats['byPosition'] = {}
  for (const r of records) {
    const mine = r.actions.filter((a) => a.playerId === heroId)
    const pre = mine.filter((a) => a.street === 'preflop')
    const post = mine.filter((a) => a.street !== 'preflop')
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
