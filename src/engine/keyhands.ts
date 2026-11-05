import type { HandRecord } from './stats'
import type { Decision } from '../store'

export interface KeyHand { rec: HandRecord; reason: string; tone: 'bad' | 'good' | 'warn' }

/** Picks the hands worth reviewing after a session: biggest losses, coach disagreements, best win. */
export function keyHands(records: HandRecord[], decisions: Decision[], max = 5): KeyHand[] {
  if (!records.length) return []
  const bbOf = (r: HandRecord) => r.heroDelta / Math.max(1, r.blinds.bb)
  const mistakes = new Map<number, number>()
  for (const d of decisions) if (d.mistake) mistakes.set(d.hand, (mistakes.get(d.hand) ?? 0) + 1)
  const out: KeyHand[] = []
  const used = new Set<string>()
  const push = (rec: HandRecord | undefined, reason: string, tone: KeyHand['tone']) => {
    if (!rec || used.has(rec.id) || out.length >= max) return
    used.add(rec.id); out.push({ rec, reason, tone })
  }
  const losses = records.filter((r) => r.heroDelta < 0).sort((a, b) => bbOf(a) - bbOf(b))
  // Coach disagreements that cost chips first: those are the real leaks.
  const costly = records.filter((r) => mistakes.has(r.handNumber) && r.heroDelta < 0).sort((a, b) => bbOf(a) - bbOf(b))
  costly.slice(0, 2).forEach((r) => push(r, `Écart avec le coach · ${Math.round(bbOf(r))} BB`, 'bad'))
  losses.slice(0, 2).forEach((r) => push(r, r.showdown ? `Grosse perte à l'abattage · ${Math.round(bbOf(r))} BB` : `Grosse perte · ${Math.round(bbOf(r))} BB`, 'bad'))
  const free = records.filter((r) => mistakes.has(r.handNumber) && r.heroDelta >= 0)
  free.slice(0, 1).forEach((r) => push(r, 'Écart avec le coach (sans casse cette fois)', 'warn'))
  const best = [...records].sort((a, b) => bbOf(b) - bbOf(a))[0]
  if (best && best.heroDelta > 0) push(best, `Meilleur coup · +${Math.round(bbOf(best))} BB`, 'good')
  return out
}
