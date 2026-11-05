import type { HandRecord } from './engine/stats'
import type { DrillType } from './engine/drills'

export interface CheckIn { energy: number; mood: number; focus: number }
export interface Decision { t: number; ms: number; mistake: boolean; hand: number }
export interface SessionSummary {
  ts: number; mode: string; minutes: number; hands: number; net: number; place: number | null; entrants: number | null
  checkin: CheckIn | null; lucidity: { bucket: number; n: number; errors: number; avgMs: number }[]; decisions: number; errors: number; bots?: { name: string; profile: string }[]
}
export interface JournalEntry { ts: number; mode: string; minutes: number; place: number | null; net: number; good: string; mistake: string; mental: string; checkin: CheckIn | null }
export interface TournamentResult { ts: number; mode: 'sng' | 'chipleader' | 'marathon' | 'headsup' | 'express'; place: number | null; entrants: number; paid: boolean; prize: number; structure: string; checkin?: CheckIn; minutes?: number }

export interface DrillProgress { asked: number; correct: number; recent: boolean[]; avgMs?: number }

export interface Store {
  hands: HandRecord[]
  tournaments: TournamentResult[]
  settings: { coach: boolean; botSpeed: number; name: string; sound: boolean; autoNext: boolean }
  bankroll: number
  drills: Partial<Record<DrillType, DrillProgress>>
  lessonsRead: string[]
  streak: { count: number; lastDay: string }
  xp: number
  sessions: SessionSummary[]
  journal: JournalEntry[]
  puzzles: { solved: number; asked: number; best: number; streak: number }
  weekly: Record<string, { puzzles: number; drills: number; drillsOk: number }>
  reads: { right: number; total: number }
  claimed: string[]
}

const KEY = 'poker-trainer-v1'
const DEFAULT: Store = {
  hands: [], tournaments: [], settings: { coach: true, botSpeed: 1, name: 'Toi', sound: true, autoNext: true }, bankroll: 10000,
  drills: {}, lessonsRead: [], streak: { count: 0, lastDay: '' }, xp: 0, sessions: [], journal: [], puzzles: { solved: 0, asked: 0, best: 0, streak: 0 }, weekly: {}, reads: { right: 0, total: 0 }, claimed: [],
}

export function loadStore(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT
    const s = JSON.parse(raw)
    return { ...DEFAULT, ...s, settings: { ...DEFAULT.settings, ...(s.settings ?? {}) }, drills: s.drills ?? {}, lessonsRead: s.lessonsRead ?? [], streak: s.streak ?? DEFAULT.streak, xp: s.xp ?? 0, sessions: s.sessions ?? [], journal: s.journal ?? [], puzzles: s.puzzles ?? DEFAULT.puzzles, weekly: s.weekly ?? {}, reads: s.reads ?? DEFAULT.reads, claimed: s.claimed ?? [] }
  } catch {
    return DEFAULT
  }
}

export function saveStore(s: Store) {
  try {
    const hands = s.hands.slice(-500).map((h, i, arr) => (i < arr.length - 150 && h.start ? { ...h, start: undefined } : h))
    const trimmed = { ...s, hands }
    localStorage.setItem(KEY, JSON.stringify(trimmed))
  } catch { /* storage unavailable */ }
}

export const today = () => new Date().toISOString().slice(0, 10)

/** ISO-like week key, e.g. "2026-W45". */
export function weekKey(ts = Date.now()): string {
  const d = new Date(ts)
  const day = (d.getUTCDay() + 6) % 7
  const thursday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day + 3))
  const firstThu = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4))
  const week = 1 + Math.round(((thursday.getTime() - firstThu.getTime()) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7)
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

function bumpWeek(s: Store, f: (w: Store['weekly'][string]) => Store['weekly'][string]): Store['weekly'] {
  const k = weekKey()
  const cur = s.weekly[k] ?? { puzzles: 0, drills: 0, drillsOk: 0 }
  const keys = Object.keys(s.weekly).sort().slice(-12)
  const kept = Object.fromEntries(keys.map((x) => [x, s.weekly[x]]))
  return { ...kept, [k]: f(cur) }
}

export function recordAnswer(s: Store, type: DrillType, ok: boolean, ms?: number): Store {
  s = { ...s, weekly: bumpWeek(s, (w) => ({ ...w, drills: w.drills + 1, drillsOk: w.drillsOk + (ok ? 1 : 0) })) }
  const d = s.drills[type] ?? { asked: 0, correct: 0, recent: [] }
  const recent = [...d.recent, ok].slice(-50)
  const avgMs = ms !== undefined ? (d.avgMs ? d.avgMs * 0.8 + ms * 0.2 : ms) : d.avgMs
  const day = today()
  let streak = s.streak
  if (streak.lastDay !== day) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    streak = { count: streak.lastDay === yesterday ? streak.count + 1 : 1, lastDay: day }
  }
  return { ...s, drills: { ...s.drills, [type]: { asked: d.asked + 1, correct: d.correct + (ok ? 1 : 0), recent, avgMs } }, streak, xp: s.xp + (ok ? 10 : 2) }
}

export function accuracy(s: Store, types: DrillType[], minAnswers: number): { acc: number; n: number; ready: boolean } {
  let ok = 0, n = 0
  for (const t of types) { const d = s.drills[t]; if (d) { n += d.recent.length; ok += d.recent.filter(Boolean).length } }
  return { acc: n ? ok / n : 0, n, ready: n >= minAnswers }
}

export function levelFor(xp: number): { level: number; title: string; next: number; progress: number } {
  const thresholds = [0, 200, 500, 1000, 1800, 3000, 5000, 8000, 12000]
  const titles = ['Fish', 'Débutant', 'Reg', 'Grinder', 'Shark', 'Pro', 'High roller', 'Légende', 'Champion de Malte']
  let level = 0
  while (level + 1 < thresholds.length && xp >= thresholds[level + 1]) level++
  const next = thresholds[Math.min(level + 1, thresholds.length - 1)]
  const prev = thresholds[level]
  return { level: level + 1, title: titles[level], next, progress: next > prev ? (xp - prev) / (next - prev) : 1 }
}

/** Endurance: longest session so far and this week's target. */
export function endurance(s: Store): { longest: number; weekMinutes: number; target: number; sessionsThisWeek: number } {
  const longest = s.sessions.reduce((a, x) => Math.max(a, x.minutes), 0)
  const weekAgo = Date.now() - 7 * 86400000
  const week = s.sessions.filter((x) => x.ts >= weekAgo)
  const weekMinutes = week.reduce((a, x) => a + x.minutes, 0)
  const target = longest < 30 ? 30 : Math.min(300, Math.ceil((longest * 1.25) / 15) * 15)
  return { longest, weekMinutes, target, sessionsThisWeek: week.length }
}

export function recordPuzzle(s: Store, ok: boolean): Store {
  if (ok) s = { ...s, weekly: bumpWeek(s, (w) => ({ ...w, puzzles: w.puzzles + 1 })) }
  const streak = ok ? s.puzzles.streak + 1 : 0
  return { ...s, puzzles: { solved: s.puzzles.solved + (ok ? 1 : 0), asked: s.puzzles.asked + 1, best: Math.max(s.puzzles.best, streak), streak }, xp: s.xp + (ok ? 15 : 3) }
}
