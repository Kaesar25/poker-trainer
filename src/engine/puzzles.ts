import { applyAction, createGame, isHandOver, legalActions, startHand, totalPot, type GameState } from './game'
import { botDecideFull, tableProfiles } from './bots'
import { advise, positionOf, type Advice } from './coach'
import { describeDetailed } from './evaluator'
import { genIcm, type Question } from './drills'

export interface Puzzle {
  kind: 'live' | 'icm'
  state?: GameState // snapshot at the hero's decision
  question?: Question // for icm puzzles
  title: string
  context: string // what happened so far, in words
  options: { id: string; label: string; action?: { type: 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin'; amount?: number } }[]
  correct: string
  explanation: string
  difficulty: 1 | 2 | 3
  advice?: Advice
}

const NAMES = ['Léo', 'Marco', 'Sofia', 'Nina', 'Tom', 'Ava', 'Hugo', 'Emma']
const ACT_FR: Record<string, string> = { fold: 'se couche', check: 'checke', call: 'suit', bet: 'mise', raise: 'relance à', allin: 'fait tapis', sb: 'SB', bb: 'BB' }

function narrate(s: GameState, heroId: number): string {
  const name = (id: number) => (id === heroId ? 'Tu' : s.players.find((p) => p.id === id)!.name)
  const lines: string[] = []
  for (const st of ['preflop', 'flop', 'turn', 'river'] as const) {
    const acts = s.history.filter((a) => a.street === st && a.action !== 'sb' && a.action !== 'bb' && a.action !== 'ante')
    if (!acts.length) continue
    const words = acts.map((a) => {
      const who = name(a.playerId)
      const verb = a.action === 'fold' ? (who === 'Tu' ? 'te couches' : 'se couche') : a.action === 'check' ? (who === 'Tu' ? 'checkes' : 'checke') : a.action === 'call' ? (who === 'Tu' ? 'suis' : 'suit') : a.action === 'bet' ? (who === 'Tu' ? `mises ${a.amount}` : `mise ${a.amount}`) : a.action === 'raise' ? (who === 'Tu' ? `relances à ${a.amount}` : `relance à ${a.amount}`) : (who === 'Tu' ? `fais tapis (${a.amount})` : `fait tapis (${a.amount})`)
      return `${who} ${verb}`
    })
    const head = st === 'preflop' ? 'Préflop' : st === 'flop' ? 'Flop' : st === 'turn' ? 'Turn' : 'River'
    lines.push(`${head} : ${words.join(', ')}.`)
  }
  void ACT_FR
  return lines.join(' ')
}

function interesting(s: GameState, heroId: number): 0 | 1 | 2 | 3 {
  const la = legalActions(s)
  const hero = s.players[heroId]
  const pot = totalPot(s)
  if (s.street === 'preflop') {
    if (s.currentBet > s.blinds.bb) return hero.stack / s.blinds.bb <= 15 ? 2 : 1 // facing a raise
    if (hero.stack / s.blinds.bb <= 12) return 2 // push/fold spot
    return 0
  }
  if (la.callAmount > 0) return la.callAmount > pot * 0.6 || s.street === 'river' ? 3 : 2 // facing a bet
  if (s.street !== 'flop' && pot > 20 * s.blinds.bb) return 2 // big pot, check to you
  return 0
}

/** Simulate a hand with bots until the hero faces a real decision. */
export function generateLivePuzzle(rng: () => number = Math.random, minDifficulty: 1 | 2 | 3 = 1): Puzzle | null {
  for (let attempt = 0; attempt < 40; attempt++) {
    const n = 4 + Math.floor(rng() * 4) // 4..7 players
    const tournament = rng() < 0.6
    const bb = tournament ? [50, 100, 200, 400, 800][Math.floor(rng() * 5)] : 20
    const ante = tournament && bb >= 200 ? Math.round(bb / 8) : 0
    const profiles = tableProfiles(n - 1, rng)
    const stackOf = () => Math.round((tournament ? 8 + rng() * 60 : 60 + rng() * 140) * bb / 25) * 25
    const players = [{ id: 0, name: 'Toi', stack: stackOf(), isBot: false }, ...profiles.map((p, i) => ({ id: i + 1, name: NAMES[i], stack: stackOf(), isBot: true, profile: p }))]
    let s = startHand(createGame(players, { sb: bb / 2, bb, ante }), rng)
    let guard = 0
    while (!isHandOver(s) && guard++ < 200) {
      if (s.acting === 0) {
        const diff = interesting(s, 0)
        if (diff >= minDifficulty && (diff >= 2 || rng() < 0.3)) {
          const adv = advise(s, 0, rng)
          if (!adv) break
          const la = legalActions(s)
          const hero = s.players[0]
          const options: Puzzle['options'] = []
          options.push({ id: 'fold', label: 'Fold', action: { type: 'fold' } })
          if (la.canCheck) options.push({ id: 'check', label: 'Check', action: { type: 'check' } })
          else options.push({ id: 'call', label: `Call ${la.callAmount}`, action: { type: 'call' } })
          if (la.canRaise) {
            const to = adv.amount && (adv.action === 'raise' || adv.action === 'bet') ? Math.min(la.maxRaiseTo, Math.max(la.minRaiseTo, adv.amount)) : Math.min(la.maxRaiseTo, Math.max(la.minRaiseTo, Math.round(s.currentBet + (totalPot(s) + la.callAmount) * 0.66)))
            if (to < la.maxRaiseTo) options.push({ id: 'raise', label: `${s.currentBet === 0 ? 'Miser' : 'Relancer à'} ${to}`, action: { type: s.currentBet === 0 ? 'bet' : 'raise', amount: to } })
            options.push({ id: 'allin', label: `Tapis ${la.maxRaiseTo}`, action: { type: 'allin' } })
          }
          const correct = adv.action === 'bet' ? 'raise' : adv.action
          if (!options.some((o) => o.id === correct)) break
          const d = describeDetailed(hero.cards, s.board)
          const pos = positionOf(s, 0)
          const ctx = `${tournament ? 'Tournoi' : 'Cash game'}, blinds ${s.blinds.sb}/${s.blinds.bb}${ante ? ` ante ${ante}` : ''}. Tu es ${pos} avec ${Math.round(hero.stack / bb)} BB. ${narrate(s, 0)}`
          const expl = `${adv.title}. ${adv.reason} Ta main : ${d.made.toLowerCase()}${d.draws.length ? ` + ${d.draws.join(', ').toLowerCase()}` : ''}${d.nutsWarning ? `. ${d.nutsWarning}` : ''}.`
          return { kind: 'live', state: s, title: s.street === 'preflop' ? 'Décision préflop' : `Décision ${s.street}`, context: ctx, options, correct, explanation: expl, difficulty: diff as 1 | 2 | 3, advice: adv }
        }
        // hero plays as a solid regular to continue the hand
        const d = botDecideFull({ ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, profile: 'tag' as const } : p)) }, rng)
        s = applyAction(s, d.action)
      } else {
        s = applyAction(s, botDecideFull(s, rng).action)
      }
    }
  }
  return null
}

export function generatePuzzle(streak: number, rng: () => number = Math.random): Puzzle {
  if (streak > 0 && streak % 5 === 0) {
    const q = genIcm()
    return { kind: 'icm', question: q, title: 'Prime de risque', context: q.prompt, options: q.options, correct: q.correct, explanation: q.explanation, difficulty: 3 }
  }
  const minDiff = streak < 5 ? 1 : streak < 15 ? 2 : 3
  return generateLivePuzzle(rng, minDiff as 1 | 2 | 3) ?? generateLivePuzzle(rng, 1) ?? (() => { const q = genIcm(); return { kind: 'icm' as const, question: q, title: 'Prime de risque', context: q.prompt, options: q.options, correct: q.correct, explanation: q.explanation, difficulty: 3 as const } })()
}
