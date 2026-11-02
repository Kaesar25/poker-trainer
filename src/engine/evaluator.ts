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
