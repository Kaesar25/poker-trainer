import type { Card } from './cards'

const R = '23456789TJQKA'
const idx = (c: string) => R.indexOf(c)

/** Canonical hand label: "AKs", "77", "T9o". */
export function handLabel(cards: Card[]): string {
  const [a, b] = cards.slice().sort((x, y) => y.rank - x.rank)
  const ra = R[a.rank - 2], rb = R[b.rank - 2]
  if (a.rank === b.rank) return ra + rb
  return ra + rb + (a.suit === b.suit ? 's' : 'o')
}

/** Expand a range string like "77+, ATs+, KQs, AJo+, T8s+, 65s" into a Set of labels. */
export function parseRange(spec: string): Set<string> {
  const out = new Set<string>()
  for (const raw of spec.split(',')) {
    const t = raw.trim()
    if (!t) continue
    const plus = t.endsWith('+')
    const core = plus ? t.slice(0, -1) : t
    const hi = core[0], lo = core[1], suf = core[2] ?? ''
    if (hi === lo) {
      // pair
      const start = idx(hi)
      const end = plus ? 12 : start
      for (let i = start; i <= end; i++) out.add(R[i] + R[i])
      continue
    }
    const suits = suf ? [suf] : ['s', 'o']
    const end = plus ? idx(hi) - 1 : idx(lo)
    for (let i = idx(lo); i <= end; i++) for (const s of suits) out.add(hi + R[i] + s)
  }
  return out
}

export type Pos = 'UTG' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB'
export const POSITIONS: Pos[] = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB']

/** 6-max opening ranges (first in). */
export const OPEN: Record<Exclude<Pos, 'BB'>, Set<string>> = {
  UTG: parseRange('66+, A9s+, KTs+, QTs+, JTs, T9s, AJo+, KQo'),
  HJ: parseRange('44+, A5s+, K9s+, Q9s+, J9s+, T9s, 98s, ATo+, KJo+, QJo'),
  CO: parseRange('22+, A2s+, K7s+, Q8s+, J8s+, T8s+, 97s+, 87s, 76s, 65s, A9o+, KTo+, QTo+, JTo'),
  BTN: parseRange('22+, A2s+, K2s+, Q4s+, J6s+, T6s+, 96s+, 85s+, 75s+, 64s+, 54s, A2o+, K8o+, Q9o+, J9o+, T9o'),
  SB: parseRange('22+, A2s+, K5s+, Q7s+, J8s+, T8s+, 97s+, 87s, 76s, 65s, A7o+, KTo+, QTo+, JTo'),
}

/** Facing a single open raise: what to do. */
export const VS_RAISE = {
  threeBetValue: parseRange('TT+, AQs+, AKo'),
  threeBetBluff: parseRange('A5s, A4s, A3s, K9s, 76s'),
  callInPosition: parseRange('22+, A2s+, KTs+, QTs+, JTs, T9s, 98s, 87s, 76s, AJo+, KQo'),
  callBB: parseRange('22+, A2s+, K5s+, Q8s+, J8s+, T8s+, 97s+, 86s+, 75s+, 65s, 54s, A8o+, KTo+, QTo+, JTo'),
}

export type PreflopAction = 'fold' | 'call' | 'raise'

export function openDecision(label: string, pos: Exclude<Pos, 'BB'>): PreflopAction {
  return OPEN[pos].has(label) ? 'raise' : 'fold'
}

export function vsRaiseDecision(label: string, heroPos: Pos, raiserPos: Pos): PreflopAction {
  if (VS_RAISE.threeBetValue.has(label)) return 'raise'
  const inPosition = POSITIONS.indexOf(heroPos) > POSITIONS.indexOf(raiserPos) && heroPos !== 'SB' && heroPos !== 'BB'
  if (heroPos === 'BB') {
    if (VS_RAISE.threeBetBluff.has(label)) return 'raise'
    return VS_RAISE.callBB.has(label) ? 'call' : 'fold'
  }
  if (inPosition || heroPos === 'BTN') {
    if (VS_RAISE.threeBetBluff.has(label)) return 'raise'
    return VS_RAISE.callInPosition.has(label) ? 'call' : 'fold'
  }
  // out of position (SB, or early vs earlier open): tighter, 3-bet or fold mostly
  if (parseRange('99+, AJs+, KQs, AQo+').has(label)) return 'raise'
  if (parseRange('22+, A2s+, KTs+, QJs, JTs, T9s, 98s').has(label) && heroPos !== 'SB') return 'call'
  if (heroPos === 'SB' && parseRange('66+, ATs+, KJs+, QJs, AJo+, KQo').has(label)) return 'call'
  return 'fold'
}

/** Push/fold (≤ 15 BB), simplified Nash-style ranges by position and stack bucket. */
const PUSH: Record<string, Record<string, Set<string>>> = {
  '5': {
    UTG: parseRange('22+, A2s+, K7s+, Q9s+, J9s+, T9s, A2o+, K9o+, QTo+, JTo'),
    HJ: parseRange('22+, A2s+, K4s+, Q8s+, J8s+, T8s+, 98s, A2o+, K8o+, Q9o+, J9o+, T9o'),
    CO: parseRange('22+, A2s+, K2s+, Q5s+, J7s+, T7s+, 97s+, 87s, 76s, A2o+, K5o+, Q8o+, J8o+, T8o+, 98o'),
    BTN: parseRange('22+, A2s+, K2s+, Q2s+, J4s+, T6s+, 96s+, 86s+, 75s+, 65s, A2o+, K2o+, Q6o+, J7o+, T7o+, 97o+, 87o'),
    SB: parseRange('22+, A2s+, K2s+, Q2s+, J2s+, T4s+, 95s+, 85s+, 74s+, 64s+, 54s, A2o+, K2o+, Q4o+, J6o+, T6o+, 96o+, 86o+, 76o'),
  },
  '10': {
    UTG: parseRange('33+, A7s+, KTs+, QTs+, JTs, ATo+, KQo'),
    HJ: parseRange('22+, A4s+, K9s+, QTs+, JTs, T9s, A9o+, KJo+, QJo'),
    CO: parseRange('22+, A2s+, K7s+, Q9s+, J9s+, T8s+, 98s, A7o+, KTo+, QTo+, JTo'),
    BTN: parseRange('22+, A2s+, K4s+, Q7s+, J8s+, T8s+, 97s+, 87s, 76s, A2o+, K8o+, Q9o+, J9o+, T9o'),
    SB: parseRange('22+, A2s+, K2s+, Q5s+, J7s+, T7s+, 97s+, 86s+, 76s, 65s, A2o+, K6o+, Q8o+, J8o+, T8o+, 98o'),
  },
  '15': {
    UTG: parseRange('66+, A9s+, KQs, AJo+'),
    HJ: parseRange('44+, A7s+, KTs+, QTs+, JTs, ATo+, KQo'),
    CO: parseRange('22+, A4s+, K9s+, QTs+, JTs, T9s, A9o+, KJo+, QJo'),
    BTN: parseRange('22+, A2s+, K7s+, Q9s+, J9s+, T8s+, 98s, 87s, A5o+, KTo+, QTo+, JTo'),
    SB: parseRange('22+, A2s+, K5s+, Q8s+, J8s+, T8s+, 97s+, 87s, 76s, A2o+, K9o+, QTo+, JTo'),
  },
}

export function pushDecision(label: string, pos: Exclude<Pos, 'BB'>, bbs: number): 'push' | 'fold' {
  const bucket = bbs <= 6 ? '5' : bbs <= 11 ? '10' : '15'
  return PUSH[bucket][pos].has(label) ? 'push' : 'fold'
}

/** BB facing a shove: call range by shover stack (simplified). */
export function callShoveDecision(label: string, bbs: number): 'call' | 'fold' {
  const r = bbs <= 6
    ? parseRange('22+, A2s+, K5s+, Q8s+, J9s+, T9s, A2o+, K8o+, QTo+, JTo')
    : bbs <= 11
      ? parseRange('44+, A7s+, KTs+, QJs, A9o+, KQo')
      : parseRange('77+, ATs+, KQs, AJo+')
  return r.has(label) ? 'call' : 'fold'
}
