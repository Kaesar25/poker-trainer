import type { HandRecord } from './engine/stats'

export interface TournamentResult { ts: number; mode: 'sng' | 'chipleader'; place: number | null; entrants: number; paid: boolean; prize: number; structure: string }

export interface Store {
  hands: HandRecord[]
  tournaments: TournamentResult[]
  settings: { coach: boolean; botSpeed: number; name: string }
  bankroll: number
}

const KEY = 'poker-trainer-v1'
const DEFAULT: Store = { hands: [], tournaments: [], settings: { coach: true, botSpeed: 1, name: 'Toi' }, bankroll: 10000 }

export function loadStore(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT
    const s = JSON.parse(raw)
    return { ...DEFAULT, ...s, settings: { ...DEFAULT.settings, ...(s.settings ?? {}) } }
  } catch {
    return DEFAULT
  }
}

export function saveStore(s: Store) {
  try {
    const trimmed = { ...s, hands: s.hands.slice(-500) }
    localStorage.setItem(KEY, JSON.stringify(trimmed))
  } catch { /* storage unavailable */ }
}
