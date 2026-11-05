import { applyAction, type Action, type ActionRecord, type GameState } from './game'
import { advise, type Advice } from './coach'
import type { HandRecord } from './stats'

export interface Frame {
  state: GameState
  label: string // what just happened
  actorId: number | null
  heroDecision?: {
    advice: Advice | null
    taken: ActionRecord
    aligned: boolean
  }
}

const NAMES: Record<string, string> = { fold: 'se couche', check: 'checke', call: 'suit', bet: 'mise', raise: 'relance à', allin: 'fait tapis' }

function toAction(a: ActionRecord): Action {
  if (a.action === 'bet' || a.action === 'raise') return { type: a.action, amount: a.amount }
  if (a.action === 'allin') return { type: 'allin' }
  return { type: a.action as 'fold' | 'check' | 'call' }
}

function aligned(adv: Advice | null, taken: ActionRecord): boolean {
  if (!adv) return true
  const t = taken.action
  const aggressive = t === 'bet' || t === 'raise' || t === 'allin'
  if (adv.action === 'fold') return t === 'fold' || t === 'check'
  if (adv.action === 'check') return t === 'check' || (aggressive && adv.equity >= 0.35)
  if (adv.action === 'call') return t === 'call' || aggressive
  return aggressive || (t === 'call' && adv.action !== 'allin')
}

/** Rebuild every step of a recorded hand. Hero is the player with id `heroId`. */
export function buildFrames(rec: HandRecord, heroId = 0, rng: () => number = Math.random): Frame[] | null {
  if (!rec.start) return null
  let s: GameState = { ...rec.start, players: rec.start.players.map((p) => ({ ...p, cards: p.cards.slice() })), board: rec.start.board.slice(), deck: rec.start.deck.slice(), log: [], history: rec.start.history.slice() }
  const frames: Frame[] = [{ state: s, label: 'Distribution', actorId: null }]
  const actions = rec.actions.slice(s.history.length) // blinds/antes already in the snapshot
  const heroIdx = s.players.findIndex((p) => p.id === heroId)
  for (const a of actions) {
    if (a.action === 'sb' || a.action === 'bb' || a.action === 'ante') continue
    if (s.acting < 0) break
    const actor = s.players[s.acting]
    if (actor.id !== a.playerId) break // desync: stop safely
    let heroDecision: Frame['heroDecision']
    if (s.acting === heroIdx) {
      let adv: Advice | null = null
      try { adv = advise(s, heroIdx, rng) } catch { adv = null }
      heroDecision = { advice: adv, taken: a, aligned: aligned(adv, a) }
    }
    const streetBefore = s.street
    try { s = applyAction(s, toAction(a)) } catch { break }
    const who = actor.id === heroId ? 'Tu' : actor.name
    const verb = actor.id === heroId
      ? ({ fold: 'te couches', check: 'checkes', call: 'suis', bet: 'mises', raise: 'relances à', allin: 'fais tapis' } as Record<string, string>)[a.action]
      : NAMES[a.action]
    const amt = a.action === 'bet' || a.action === 'raise' || a.action === 'allin' || a.action === 'call' ? ` ${a.amount}` : ''
    let label = `${who} ${verb}${amt}`
    if (s.street !== streetBefore && s.street !== 'showdown') label += ` · ${s.street === 'flop' ? 'Flop' : s.street === 'turn' ? 'Turn' : 'River'}`
    if (s.street === 'showdown') label += ' · Abattage'
    frames.push({ state: s, label, actorId: actor.id, heroDecision })
  }
  return frames
}
