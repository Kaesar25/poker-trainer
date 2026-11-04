import type { Card, Rank } from './cards'

export type HandCategory = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
// 0 high card, 1 pair, 2 two pair, 3 trips, 4 straight, 5 flush, 6 full house, 7 quads, 8 straight flush

export const CATEGORY_LABEL: Record<HandCategory, string> = {
  0: 'Hauteur', 1: 'Paire', 2: 'Deux paires', 3: 'Brelan', 4: 'Quinte',
  5: 'Couleur', 6: 'Full', 7: 'Carré', 8: 'Quinte flush',
}

export interface HandValue {
  category: HandCategory
  score: number // higher is better, comparable across hands
  kickers: Rank[]
}

function straightHigh(ranksDesc: number[]): number {
  // ranksDesc: unique ranks, descending. Returns high card of straight or 0.
  const set = new Set(ranksDesc)
  if (set.has(14)) set.add(1)
  const arr = Array.from(set).sort((a, b) => b - a)
  for (let i = 0; i < arr.length; i++) {
    const h = arr[i]
    if (set.has(h - 1) && set.has(h - 2) && set.has(h - 3) && set.has(h - 4)) return h
  }
  return 0
}

function score(category: number, kickers: number[]): number {
  let s = category
  for (let i = 0; i < 5; i++) s = s * 16 + (kickers[i] ?? 0)
  return s
}

/** Evaluate the best 5-card hand out of 5 to 7 cards. */
export function evaluate(cards: Card[]): HandValue {
  const counts = new Map<number, number>()
  const suits = new Map<string, Card[]>()
  for (const c of cards) {
    counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1)
    const arr = suits.get(c.suit) ?? []
    arr.push(c)
    suits.set(c.suit, arr)
  }
  // flush / straight flush
  for (const arr of suits.values()) {
    if (arr.length >= 5) {
      const fr = Array.from(new Set(arr.map((c) => c.rank))).sort((a, b) => b - a)
      const sh = straightHigh(fr)
      if (sh) return { category: 8, score: score(8, [sh]), kickers: [sh as Rank] }
      const k = fr.slice(0, 5)
      return { category: 5, score: score(5, k), kickers: k as Rank[] }
    }
  }
  const groups = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || b[0] - a[0])
  const uniqDesc = groups.map((g) => g[0]).sort((a, b) => b - a)
  if (groups[0][1] === 4) {
    const k = [groups[0][0], Math.max(...uniqDesc.filter((r) => r !== groups[0][0]))]
    return { category: 7, score: score(7, k), kickers: k as Rank[] }
  }
  if (groups[0][1] === 3 && groups.length > 1 && groups[1][1] >= 2) {
    const k = [groups[0][0], groups[1][0]]
    return { category: 6, score: score(6, k), kickers: k as Rank[] }
  }
  const sh = straightHigh(uniqDesc)
  if (sh) return { category: 4, score: score(4, [sh]), kickers: [sh as Rank] }
  if (groups[0][1] === 3) {
    const rest = uniqDesc.filter((r) => r !== groups[0][0]).slice(0, 2)
    const k = [groups[0][0], ...rest]
    return { category: 3, score: score(3, k), kickers: k as Rank[] }
  }
  if (groups[0][1] === 2 && groups[1]?.[1] === 2) {
    const p1 = groups[0][0], p2 = groups[1][0]
    const rest = uniqDesc.filter((r) => r !== p1 && r !== p2)
    const k = [p1, p2, rest[0]]
    return { category: 2, score: score(2, k), kickers: k as Rank[] }
  }
  if (groups[0][1] === 2) {
    const p = groups[0][0]
    const rest = uniqDesc.filter((r) => r !== p).slice(0, 3)
    const k = [p, ...rest]
    return { category: 1, score: score(1, k), kickers: k as Rank[] }
  }
  const k = uniqDesc.slice(0, 5)
  return { category: 0, score: score(0, k), kickers: k as Rank[] }
}

export function describe(v: HandValue): string {
  return CATEGORY_LABEL[v.category]
}

const RANK_NAME: Record<number, string> = { 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10', 11: 'valet', 12: 'dame', 13: 'roi', 14: 'as' }
const RANK_PL: Record<number, string> = { 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10', 11: 'valets', 12: 'dames', 13: 'rois', 14: 'as' }

export interface HandDetail {
  made: string // e.g. "Top paire, kicker as"
  draws: string[] // e.g. ["Tirage couleur (9 outs)"]
  nutsWarning: string | null // e.g. "Une couleur est possible"
  value: HandValue
  strength: 'monster' | 'strong' | 'medium' | 'weak' | 'nothing'
}

/** Human-readable description of hero's hand given hole cards and board (board may be empty). */
export function describeDetailed(hole: Card[], board: Card[]): HandDetail {
  const all = [...hole, ...board]
  const value = evaluate(all)
  const [h1, h2] = hole.slice().sort((a, b) => b.rank - a.rank)
  const boardRanks = board.map((c) => c.rank).sort((a, b) => b - a)
  let made = CATEGORY_LABEL[value.category]
  let strength: HandDetail['strength'] = 'nothing'
  if (board.length === 0) {
    if (h1.rank === h2.rank) { made = `Paire de ${RANK_PL[h1.rank]}`; strength = h1.rank >= 10 ? 'strong' : 'medium' }
    else { made = `${RANK_NAME[h1.rank].charAt(0).toUpperCase() + RANK_NAME[h1.rank].slice(1)}-${RANK_NAME[h2.rank]} ${h1.suit === h2.suit ? 'assortis' : 'dépareillés'}`; strength = h1.rank === 14 && h2.rank >= 12 ? 'strong' : h1.rank >= 12 && h2.rank >= 10 ? 'medium' : 'weak' }
    return { made, draws: [], nutsWarning: null, value, strength }
  }
  switch (value.category) {
    case 8: made = 'Quinte flush'; strength = 'monster'; break
    case 7: made = `Carré de ${RANK_PL[value.kickers[0]]}`; strength = 'monster'; break
    case 6: made = `Full aux ${RANK_PL[value.kickers[0]]} par les ${RANK_PL[value.kickers[1]]}`; strength = 'monster'; break
    case 5: made = `Couleur hauteur ${RANK_NAME[value.kickers[0]]}`; strength = value.kickers[0] === 14 ? 'monster' : 'strong'; break
    case 4: made = `Quinte hauteur ${RANK_NAME[value.kickers[0]]}`; strength = 'strong'; break
    case 3: {
      const r = value.kickers[0]
      const set = h1.rank === h2.rank && h1.rank === r
      made = set ? `Brelan de ${RANK_PL[r]} (set)` : `Brelan de ${RANK_PL[r]}`
      strength = 'strong'; break
    }
    case 2: {
      const [p1, p2] = value.kickers
      const topTwo = p1 === boardRanks[0] || hole.some((c) => c.rank === p1) && hole.some((c) => c.rank === p2)
      made = `Deux paires, ${RANK_PL[p1]} et ${RANK_PL[p2]}`
      strength = topTwo ? 'strong' : 'medium'
      break
    }
    case 1: {
      const p = value.kickers[0]
      const pocket = h1.rank === h2.rank
      const boardPair = boardRanks.filter((r) => r === p).length >= 2
      if (boardPair) { made = `Paire du board (${RANK_PL[p]}), hauteur ${RANK_NAME[Math.max(h1.rank, h2.rank)]}`; strength = 'weak' }
      else if (pocket) {
        const over = boardRanks.filter((r) => r > p).length
        made = over === 0 ? `Overpair (${RANK_PL[p]})` : `Paire de ${RANK_PL[p]} (${over} overcard${over > 1 ? 's' : ''} sur le board)`
        strength = over === 0 ? 'strong' : over === 1 ? 'medium' : 'weak'
      } else {
        const kicker = hole.find((c) => c.rank !== p)!.rank
        const idx = Array.from(new Set(boardRanks)).indexOf(p)
        const label = idx === 0 ? 'Top paire' : idx === 1 ? 'Deuxième paire' : 'Petite paire'
        made = `${label} (${RANK_PL[p]}), kicker ${RANK_NAME[kicker]}`
        strength = idx === 0 ? (kicker >= 12 ? 'strong' : 'medium') : 'weak'
      }
      break
    }
    default: {
      const over = hole.filter((c) => c.rank > (boardRanks[0] ?? 0)).length
      made = over === 2 ? `Hauteur ${RANK_NAME[h1.rank]}, deux overcards` : over === 1 ? `Hauteur ${RANK_NAME[h1.rank]}, une overcard` : `Hauteur ${RANK_NAME[h1.rank]}`
      strength = 'nothing'
    }
  }
  // draws (flop/turn only)
  const draws: string[] = []
  if (board.length >= 3 && board.length < 5 && value.category < 5) {
    const suits: Record<string, number> = {}
    for (const c of all) suits[c.suit] = (suits[c.suit] ?? 0) + 1
    const fd = Object.entries(suits).find(([s, n]) => n === 4 && hole.some((c) => c.suit === s))
    if (fd) draws.push(`Tirage couleur (9 outs${hole.some((c) => c.suit === fd[0] && c.rank === 14) ? ', max' : ''})`)
    // straight draws: count ranks completing a straight
    const ranks = new Set<number>(all.map((c) => c.rank))
    const used = new Set(all.map((c) => c.rank + c.suit))
    let outs = 0
    const outRanks = new Set<number>()
    for (let r = 2; r <= 14; r++) {
      if (ranks.has(r)) continue
      const test = new Set<number>(ranks); test.add(r)
      if (test.has(14)) test.add(1)
      let ok = false
      for (let h = 5; h <= 14; h++) if ([0, 1, 2, 3, 4].every((k) => test.has(h - k))) { ok = true; break }
      if (ok) outRanks.add(r)
    }
    for (const r of outRanks) for (const s of ['s', 'h', 'd', 'c']) if (!used.has(r + s)) outs++
    if (outRanks.size >= 2 && value.category < 4) draws.push(`Tirage quinte ouvert (${outs} outs)`)
    else if (outRanks.size === 1 && value.category < 4) draws.push(`Tirage quinte ventral (${outs} outs)`)
  }
  // nuts warning: what is possible on this board
  let nutsWarning: string | null = null
  if (board.length >= 3 && value.category < 8) {
    const bs: Record<string, number> = {}
    for (const c of board) bs[c.suit] = (bs[c.suit] ?? 0) + 1
    const flushPossible = Object.values(bs).some((n) => n >= 3)
    const boardPaired = new Set(board.map((c) => c.rank)).size < board.length
    const br: number[] = Array.from(new Set<number>(board.map((c) => c.rank)))
    let straightPossible = false
    for (let h = 5; h <= 14; h++) { const need = [0, 1, 2, 3, 4].map((k) => h - k).map((x) => (x === 1 ? 14 : x)); if (need.filter((x) => br.includes(x)).length >= 3) straightPossible = true }
    if (boardPaired && value.category < 6) nutsWarning = 'Board pairé : full et carré possibles'
    else if (flushPossible && value.category < 5) nutsWarning = 'Couleur possible'
    else if (straightPossible && value.category < 4) nutsWarning = 'Quinte possible'
  }
  return { made, draws, nutsWarning, value, strength }
}
