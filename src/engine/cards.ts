export type Suit = 's' | 'h' | 'd' | 'c'
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14

export interface Card {
  rank: Rank
  suit: Suit
}

export const SUITS: Suit[] = ['s', 'h', 'd', 'c']
export const RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]

export const RANK_LABEL: Record<Rank, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A',
}
export const SUIT_SYMBOL: Record<Suit, string> = { s: '♠', h: '♥', d: '♦', c: '♣' }

export function cardToString(c: Card): string {
  return RANK_LABEL[c.rank] + SUIT_SYMBOL[c.suit]
}

export function parseCard(s: string): Card {
  const suit = s.slice(-1) as Suit
  const r = s.slice(0, -1)
  const rank = ({ A: 14, K: 13, Q: 12, J: 11, T: 10 } as Record<string, number>)[r] ?? parseInt(r, 10)
  return { rank: rank as Rank, suit }
}

export function newDeck(): Card[] {
  const d: Card[] = []
  for (const suit of SUITS) for (const rank of RANKS) d.push({ rank, suit })
  return d
}

export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
