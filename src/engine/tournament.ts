import type { GameState } from './game'

export interface BlindLevel { sb: number; bb: number; ante: number }

export interface Structure {
  id: string
  name: string
  levelSeconds: number
  levels: BlindLevel[]
}

const mk = (arr: [number, number, number?][]): BlindLevel[] => arr.map(([sb, bb, ante]) => ({ sb, bb, ante: ante ?? 0 }))

export const STRUCTURES: Record<string, Structure> = {
  turbo: {
    id: 'turbo', name: 'Turbo', levelSeconds: 180,
    levels: mk([[10, 20], [15, 30], [25, 50], [50, 100], [75, 150, 25], [100, 200, 25], [150, 300, 50], [200, 400, 50], [300, 600, 75], [400, 800, 100], [600, 1200, 200], [800, 1600, 200], [1000, 2000, 300], [1500, 3000, 500], [2000, 4000, 500]]),
  },
  standard: {
    id: 'standard', name: 'Standard', levelSeconds: 360,
    levels: mk([[10, 20], [15, 30], [20, 40], [30, 60], [50, 100], [75, 150, 25], [100, 200, 25], [150, 300, 50], [200, 400, 50], [300, 600, 75], [400, 800, 100], [500, 1000, 100], [700, 1400, 200], [1000, 2000, 300], [1500, 3000, 500], [2000, 4000, 500]]),
  },
  live: {
    id: 'live', name: 'Live (type Malte)', levelSeconds: 600,
    levels: mk([[25, 50], [50, 100], [75, 150], [100, 200, 25], [150, 300, 50], [200, 400, 50], [300, 600, 100], [400, 800, 100], [500, 1000, 100], [600, 1200, 200], [800, 1600, 200], [1000, 2000, 300], [1500, 3000, 500], [2000, 4000, 500], [3000, 6000, 1000]]),
  },
}

export type TournamentMode = 'sng' | 'chipleader'

export interface Tournament {
  mode: TournamentMode
  structureId: string
  entrants: number // total field
  buyIn: number
  prizePool: number
  payouts: number[] // by place, index 0 = 1st
  startLevel: number
  elapsedMs: number // accumulated playing time
  runningSince: number | null // Date.now() when last resumed
  finished: { playerId: number; place: number }[]
  heroPlace: number | null
}

export function createTournament(mode: TournamentMode, structureId: string, tablePlayers: number, opts: { buyIn?: number; startLevel?: number; entrants?: number } = {}): Tournament {
  const entrants = opts.entrants ?? tablePlayers
  const buyIn = opts.buyIn ?? 100
  const prizePool = buyIn * entrants
  const pct = entrants <= 3 ? [0.65, 0.35] : entrants <= 6 ? [0.5, 0.3, 0.2] : entrants <= 12 ? [0.45, 0.27, 0.18, 0.1] : [0.4, 0.25, 0.15, 0.1, 0.06, 0.04]
  const payouts = pct.map((p) => Math.round(prizePool * p))
  return {
    mode, structureId, entrants, buyIn, prizePool, payouts,
    startLevel: opts.startLevel ?? 0,
    elapsedMs: 0,
    runningSince: null,
    finished: [],
    heroPlace: null,
  }
}

export function structureOf(t: Tournament): Structure {
  return STRUCTURES[t.structureId]
}

export function elapsed(t: Tournament, now = Date.now()): number {
  return t.elapsedMs + (t.runningSince ? now - t.runningSince : 0)
}

export function resume(t: Tournament, now = Date.now()): Tournament {
  return t.runningSince ? t : { ...t, runningSince: now }
}
export function pause(t: Tournament, now = Date.now()): Tournament {
  return t.runningSince ? { ...t, elapsedMs: t.elapsedMs + now - t.runningSince, runningSince: null } : t
}

/** Level that should apply now, based on elapsed time (levels are clamped to the structure). */
export function currentLevelIndex(t: Tournament, now = Date.now()): number {
  const st = structureOf(t)
  const idx = t.startLevel + Math.floor(elapsed(t, now) / (st.levelSeconds * 1000))
  return Math.min(idx, st.levels.length - 1)
}

export function levelTimeLeft(t: Tournament, now = Date.now()): number {
  const st = structureOf(t)
  const ms = st.levelSeconds * 1000
  return ms - (elapsed(t, now) % ms)
}

export function blindsFor(t: Tournament, now = Date.now()): BlindLevel {
  return structureOf(t).levels[currentLevelIndex(t, now)]
}

/** Called after a hand: register newly busted players with their finishing place. */
export function registerEliminations(t: Tournament, s: GameState, heroId: number): Tournament {
  const already = new Set(t.finished.map((f) => f.playerId))
  const newlyOut = s.players.filter((p) => p.out && !already.has(p.id))
  if (newlyOut.length === 0) return t
  // players still alive at the table (+ virtual players already eliminated before the table in chip-leader mode)
  const alive = s.players.filter((p) => !p.out).length
  // if several bust at once, bigger starting-of-hand stack finishes higher: approximate by order of id
  const finished = t.finished.slice()
  let place = alive + newlyOut.length
  for (const p of newlyOut) finished.push({ playerId: p.id, place: place-- })
  let heroPlace = t.heroPlace
  const h = finished.find((f) => f.playerId === heroId)
  if (h) heroPlace = h.place
  if (alive === 1) {
    const w = s.players.find((p) => !p.out)!
    finished.push({ playerId: w.id, place: 1 })
    if (w.id === heroId) heroPlace = 1
  }
  return { ...t, finished, heroPlace }
}

export function isTournamentOver(s: GameState): boolean {
  return s.players.filter((p) => !p.out).length <= 1
}

export function prizeFor(t: Tournament, place: number): number {
  return t.payouts[place - 1] ?? 0
}

/** Starting stacks for the chip-leader scenario: hero big stack vs 2 other big stacks and 3 mid stacks. */
export function chipLeaderStacks(bb: number, n: number): { hero: number; others: number[] } {
  const hero = 65 * bb
  const big = [70 * bb, 55 * bb]
  const mid = [24 * bb, 18 * bb, 12 * bb, 30 * bb]
  const others = [...big, ...mid].slice(0, n - 1)
  return { hero, others }
}
