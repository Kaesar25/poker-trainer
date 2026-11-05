import { newDeck, shuffle, type Card } from './cards'
import { evaluate, describeDetailed } from './evaluator'
import { legalActions, totalPot, type Action, type BotProfile, type GameState } from './game'
import { handLabel, openDecision, vsRaiseDecision, pushDecision, callShoveDecision, parseRange, type Pos } from './ranges'
import { positionOf } from './coach'

/** Preflop strength 0..1 (Chen-like). */
export function preflopStrength(cards: Card[]): number {
  const [a, b] = cards.slice().sort((x, y) => y.rank - x.rank)
  const hi = a.rank, lo = b.rank
  const base = (r: number) => (r === 14 ? 10 : r === 13 ? 8 : r === 12 ? 7 : r === 11 ? 6 : r / 2)
  let s = base(hi)
  if (hi === lo) s = Math.max(5, s * 2)
  else {
    const gap = hi - lo - 1
    s -= gap === 0 ? -1 : gap === 1 ? 1 : gap === 2 ? 2 : gap === 3 ? 4 : 5
    if (a.suit === b.suit) s += 2
    if (hi <= 11 && lo <= 11 && gap <= 1) s += 1
  }
  return Math.max(0, Math.min(1, s / 20))
}

/** Monte-Carlo equity vs N random opponents. */
export function equity(hole: Card[], board: Card[], opponents: number, samples = 150, rng: () => number = Math.random): number {
  const used = new Set([...hole, ...board].map((c) => c.rank + c.suit))
  const rest = newDeck().filter((c) => !used.has(c.rank + c.suit))
  let wins = 0
  for (let i = 0; i < samples; i++) {
    const d = shuffle(rest, rng)
    let k = 0
    const b = board.slice()
    while (b.length < 5) b.push(d[k++])
    const mine = evaluate([...hole, ...b]).score
    let best = true, tie = false
    for (let o = 0; o < opponents; o++) {
      const os = evaluate([d[k++], d[k++], ...b]).score
      if (os > mine) { best = false; break }
      if (os === mine) tie = true
    }
    if (best) wins += tie ? 0.5 : 1
  }
  return wins / samples
}

/**
 * Equity against the range of a player who is BETTING on this board:
 * opponent hands are rejection-sampled so that air is rare and made hands common
 * (the bigger the bet and the later the street, the stronger the range).
 */
export function equityVsBettingRange(hole: Card[], board: Card[], street: 'flop' | 'turn' | 'river', betFrac: number, samples = 200, rng: () => number = Math.random): number {
  const used = new Set([...hole, ...board].map((c) => c.rank + c.suit))
  const rest = newDeck().filter((c) => !used.has(c.rank + c.suit))
  const late = street === 'river' ? 1 : street === 'turn' ? 0.6 : 0.3
  const big = Math.min(1, betFrac)
  // acceptance probabilities by opponent hand strength
  const acc: Record<string, number> = {
    monster: 1, strong: 1,
    medium: street === 'river' ? 0.75 - 0.25 * big : 0.9,
    weak: street === 'river' ? 0.25 - 0.15 * big : 0.55 - 0.2 * late,
    nothing: street === 'river' ? 0.12 - 0.05 * big : 0.35 - 0.15 * late, // bluffs and draws
  }
  let wins = 0, n = 0, guard = 0
  while (n < samples && guard++ < samples * 12) {
    const d = shuffle(rest, rng)
    const opp = [d[0], d[1]]
    const strength = describeDetailed(opp, board).strength
    let keep = acc[strength]
    if (board.length < 5 && strength === 'nothing' && describeDetailed(opp, board).draws.length) keep = Math.max(keep, 0.7)
    if (rng() > keep) continue
    const b = board.slice()
    let k = 2
    while (b.length < 5) b.push(d[k++])
    const mine = evaluate([...hole, ...b]).score
    const os = evaluate([...opp, ...b]).score
    if (mine > os) wins += 1; else if (mine === os) wins += 0.5
    n++
  }
  return n ? wins / n : 0
}

/* ------------------------------------------------------------------ */
/* Personalities                                                       */
/* ------------------------------------------------------------------ */

export interface Personality {
  label: string
  short: string // one-line description shown at reveal
  tell: string // what to look for
  openWidth: number // 1 = standard ranges; <1 tighter; >1 wider
  threeBet: number // multiplier on 3-bet frequency
  limp: number // probability to limp instead of raising when opening
  cbet: number // c-bet frequency when preflop aggressor
  aggression: number // postflop: bet/raise with strong hands
  bluff: number // postflop: bet/raise with air
  callDown: number // shift on equity threshold to call (+ = calls more)
  slowplay: number // probability to check a monster
  sizing: 'small' | 'standard' | 'big' | 'random'
  thinkMs: [number, number]
  timingTell: boolean // strong = fast, bluff = slow
  tiltProne: number // 0..1
}

export const PERSONALITIES: Record<BotProfile, Personality> = {
  nit: { label: 'Nit', short: 'Ne joue que les premiums, se couche face à l\'agression.', tell: 'Quand il mise, il a une main. Vole ses blinds sans retenue.', openWidth: 0.55, threeBet: 0.5, limp: 0, cbet: 0.5, aggression: 0.5, bluff: 0.02, callDown: -0.1, slowplay: 0.1, sizing: 'big', thinkMs: [700, 1800], timingTell: true, tiltProne: 0.1 },
  rock: { label: 'Rock', short: 'Très serré et passif, limpe ses petites paires, check-call ses tops paires.', tell: 'Beaucoup de checks. Une relance de sa part est un signal rouge.', openWidth: 0.6, threeBet: 0.4, limp: 0.5, cbet: 0.4, aggression: 0.35, bluff: 0.02, callDown: 0.05, slowplay: 0.3, sizing: 'small', thinkMs: [900, 2200], timingTell: false, tiltProne: 0.1 },
  tag: { label: 'TAG', short: 'Serré-agressif, le profil solide : ranges corrects, c-bet, value bet.', tell: 'Difficile à exploiter. Évite les gros pots sans main.', openWidth: 1, threeBet: 1, limp: 0, cbet: 0.65, aggression: 0.7, bluff: 0.1, callDown: 0, slowplay: 0.15, sizing: 'standard', thinkMs: [600, 1600], timingTell: false, tiltProne: 0.2 },
  lag: { label: 'LAG', short: 'Large-agressif : ouvre beaucoup, 3-bet léger, met la pression sur trois rues.', tell: 'Il bluffe souvent : laisse-le miser avec tes fortes mains, paie plus large.', openWidth: 1.7, threeBet: 1.8, limp: 0, cbet: 0.8, aggression: 0.85, bluff: 0.3, callDown: 0.05, slowplay: 0.05, sizing: 'random', thinkMs: [400, 1300], timingTell: false, tiltProne: 0.35 },
  maniac: { label: 'Maniac', short: 'Relance tout, tout le temps, à toutes les tailles.', tell: 'Ne bluffe jamais contre lui : attends une main et laisse-le s\'empaler.', openWidth: 2.8, threeBet: 3, limp: 0, cbet: 0.95, aggression: 0.95, bluff: 0.55, callDown: 0.15, slowplay: 0, sizing: 'big', thinkMs: [300, 900], timingTell: false, tiltProne: 0.6 },
  station: { label: 'Calling station', short: 'Ne se couche jamais une fois dans le coup, mise rarement.', tell: 'Mise gros pour valeur, jamais de bluff. Ses relances sont rares et fortes.', openWidth: 1.8, threeBet: 0.3, limp: 0.6, cbet: 0.3, aggression: 0.2, bluff: 0.02, callDown: 0.3, slowplay: 0.2, sizing: 'small', thinkMs: [500, 1500], timingTell: false, tiltProne: 0.2 },
  bluffer: { label: 'Bluffeur', short: 'Ranges normaux mais mise sans main dès qu\'il sent la faiblesse.', tell: 'Il attaque les checks. Checke tes fortes mains pour l\'induire.', openWidth: 1.1, threeBet: 1.2, limp: 0, cbet: 0.85, aggression: 0.6, bluff: 0.45, callDown: 0, slowplay: 0.1, sizing: 'big', thinkMs: [800, 2600], timingTell: true, tiltProne: 0.3 },
  trapper: { label: 'Piégeur', short: 'Slowplay ses monstres, check-raise, laisse miser.', tell: 'Ses checks ne veulent rien dire. Méfie-toi de ses relances tardives.', openWidth: 0.9, threeBet: 0.6, limp: 0.3, cbet: 0.45, aggression: 0.5, bluff: 0.08, callDown: 0.1, slowplay: 0.6, sizing: 'standard', thinkMs: [700, 2000], timingTell: false, tiltProne: 0.15 },
  shortstack: { label: 'Short stack pro', short: 'Spécialiste du push/fold, patient puis tout ou rien.', tell: 'Ses tapis sont bien calibrés : paie-les seulement avec de vraies mains.', openWidth: 0.9, threeBet: 1.3, limp: 0, cbet: 0.6, aggression: 0.7, bluff: 0.1, callDown: -0.05, slowplay: 0.1, sizing: 'standard', thinkMs: [500, 1400], timingTell: false, tiltProne: 0.1 },
  tilter: { label: 'Tilteur', short: 'Correct à froid, mais part en vrille après un gros pot perdu.', tell: 'Après un bad beat, il ouvre tout et bluffe : c\'est le moment de l\'attendre.', openWidth: 1, threeBet: 1, limp: 0.1, cbet: 0.6, aggression: 0.6, bluff: 0.12, callDown: 0.05, slowplay: 0.1, sizing: 'standard', thinkMs: [500, 1800], timingTell: true, tiltProne: 1 },
  fish: { label: 'Fish', short: 'Débutant : limpe, paie avec n\'importe quoi, mise au hasard.', tell: 'Value bet tout, trois rues. Ses mises ne racontent aucune histoire.', openWidth: 2.4, threeBet: 0.5, limp: 0.75, cbet: 0.4, aggression: 0.4, bluff: 0.2, callDown: 0.25, slowplay: 0.2, sizing: 'random', thinkMs: [400, 2400], timingTell: false, tiltProne: 0.4 },
  bully: { label: 'Bully', short: 'Avec un gros tapis, il attaque les stacks moyens sans relâche.', tell: 'Contre lui, soit tu as une main, soit tu te couches : pas de call léger.', openWidth: 1.2, threeBet: 1.4, limp: 0, cbet: 0.75, aggression: 0.8, bluff: 0.25, callDown: -0.02, slowplay: 0.05, sizing: 'standard', thinkMs: [500, 1500], timingTell: false, tiltProne: 0.25 },
}

export const PROFILE_LABEL: Record<BotProfile, string> = Object.fromEntries(Object.entries(PERSONALITIES).map(([k, v]) => [k, v.label])) as Record<BotProfile, string>
export const ALL_PROFILES = Object.keys(PERSONALITIES) as BotProfile[]

/** Random table mix: varied, never twice the same profile at a table below 8 players. */
export function tableProfiles(n: number, rng: () => number = Math.random, forceFirst?: BotProfile): BotProfile[] {
  const pool = shuffle(ALL_PROFILES, rng)
  const out: BotProfile[] = forceFirst ? [forceFirst] : []
  for (const p of pool) { if (out.length >= n) break; if (!out.includes(p)) out.push(p) }
  while (out.length < n) out.push(pool[out.length % pool.length])
  return out.slice(0, n)
}

/** What the bots have learned about the hero. */
export interface HeroModel {
  foldToBet: number
  callDown: number
  samples: number
  bluffsCaught?: number
}

/** Table context the bots may use (tournament pressure). */
export interface BotContext { icmPressure?: number }

export interface BotDecision { action: Action; thinkMs: number }

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
const VALUE_4BET = parseRange('QQ+, AKs, AKo')
const CALL_3BET = parseRange('88+, ATs+, KQs, AQo+, JTs, T9s, 98s')

export function botDecide(s: GameState, rng: () => number = Math.random, hero?: HeroModel, ctx?: BotContext): Action {
  return botDecideFull(s, rng, hero, ctx).action
}

export function botDecideFull(s: GameState, rng: () => number = Math.random, hero?: HeroModel, ctx?: BotContext): BotDecision {
  const p = s.players[s.acting]
  const P = { ...PERSONALITIES[p.profile ?? 'tag'] }
  const la = legalActions(s)
  const pot = totalPot(s)
  const live = s.players.filter((q) => !q.out && !q.folded)
  const opponents = live.filter((q) => q.id !== p.id).length
  const bb = s.blinds.bb
  const bbs = p.stack / bb
  const r = rng()

  // --- tilt: aggression and bluffs rise, ranges widen ---
  if (p.mood && p.mood > 0 && P.tiltProne > 0) {
    const k = P.tiltProne
    P.openWidth *= 1 + 0.6 * k; P.bluff = clamp01(P.bluff + 0.3 * k); P.aggression = clamp01(P.aggression + 0.25 * k); P.callDown += 0.15 * k; P.slowplay = 0
    P.thinkMs = [P.thinkMs[0] * 0.5, P.thinkMs[1] * 0.6]
  }
  // --- adaptation to the hero in heads-up pots ---
  const heroPlayer = s.players.find((q) => !q.isBot)
  const vsHero = !!heroPlayer && !heroPlayer.folded && !heroPlayer.out && live.length === 2
  if (hero && hero.samples >= 12 && vsHero) {
    if (hero.foldToBet > 0.6) { P.bluff = clamp01(P.bluff + 0.2); P.cbet = clamp01(P.cbet + 0.15) }
    if (hero.callDown > 0.65) { P.bluff = Math.max(0, P.bluff - 0.1); P.aggression = clamp01(P.aggression + 0.2); P.sizing = 'big' }
  }
  if (hero && (hero.bluffsCaught ?? 0) >= 2 && vsHero) P.callDown += 0.1 // the hero has been caught bluffing: look him up more
  // tournament pressure (bubble / final table): covered players tighten, the big stacks attack
  const icmP = ctx?.icmPressure ?? 0
  if (icmP > 0) {
    const others = s.players.filter((q) => !q.out && q.id !== p.id)
    const coversAll = others.every((q) => p.stack >= q.stack)
    const covered = others.some((q) => q.stack > p.stack * 1.5)
    if (coversAll) { P.openWidth *= 1 + 0.4 * icmP; P.bluff = clamp01(P.bluff + 0.1 * icmP) }
    else if (covered && p.profile !== 'maniac' && p.profile !== 'fish') { P.callDown -= 0.15 * icmP; P.threeBet *= 1 - 0.3 * icmP }
  }
  // --- bully: wide vs mid stacks when covering them by far ---
  if (p.profile === 'bully') {
    const mids = s.players.filter((q) => !q.out && q.id !== p.id && q.stack >= 8 * bb && q.stack <= 28 * bb && q.stack < p.stack * 0.5)
    if (mids.length) { P.openWidth *= 1.5; P.threeBet *= 1.5; P.cbet = 0.9 }
  }

  const think = (strong: boolean, bluffing: boolean) => {
    let [a, b] = P.thinkMs
    if (P.timingTell) { if (strong) { a *= 0.4; b *= 0.5 } else if (bluffing) { a *= 1.6; b *= 1.6 } }
    return a + rng() * (b - a)
  }
  const sizeFrac = (base: number) => {
    const jitter = (rng() - 0.5) * 0.2
    if (P.sizing === 'small') return Math.max(0.25, base * 0.6 + jitter)
    if (P.sizing === 'big') return base * 1.4 + jitter
    if (P.sizing === 'random') return Math.max(0.3, 0.3 + rng() * 1.2)
    return base + jitter
  }
  const raiseTo = (to: number): Action => (to >= la.maxRaiseTo ? { type: 'allin' } : { type: s.currentBet === 0 ? 'bet' : 'raise', amount: Math.round(Math.max(la.minRaiseTo, to)) })

  /* ---------------- Preflop ---------------- */
  if (s.street === 'preflop') {
    const label = handLabel(p.cards)
    const str = preflopStrength(p.cards)
    const rawPos = positionOf(s, s.acting) as string
    const pos = (rawPos === 'UTG+1' || rawPos === 'MP' ? 'HJ' : rawPos) as Pos
    const openPos = (pos === 'BB' ? 'SB' : pos) as Exclude<Pos, 'BB'>
    const raisers = s.history.filter((h) => h.street === 'preflop' && (h.action === 'raise' || h.action === 'allin'))
    const facingRaise = s.currentBet > bb
    const facing3Bet = raisers.length >= 2 && raisers.some((h) => h.playerId === p.id)
    const unopened = !facingRaise
    const potOdds = la.callAmount / (pot + la.callAmount || 1)

    // short stack: push/fold
    if (bbs <= 12 && !facingRaise && !la.canCheck) {
      const push = pushDecision(label, openPos, bbs) === 'push' || (P.openWidth > 1.4 && str > 0.3 && r < 0.5)
      return push ? { action: { type: 'allin' }, thinkMs: think(str > 0.6, str < 0.3) } : { action: { type: 'fold' }, thinkMs: think(false, false) }
    }
    if (facingRaise && la.callAmount >= p.stack * 0.6) {
      // facing a bet that commits us: call with good hands only
      const ok = callShoveDecision(label, Math.min(15, la.callAmount / bb)) === 'call' || (P.callDown > 0.2 && str > 0.4 && r < 0.5)
      return { action: ok ? { type: 'call' } : { type: 'fold' }, thinkMs: think(ok && str > 0.7, false) }
    }

    if (unopened) {
      if (la.canCheck) {
        // BB with option
        if (str > 0.55 && r < P.aggression) return { action: raiseTo(bb * 3.5), thinkMs: think(true, false) }
        return { action: { type: 'check' }, thinkMs: think(false, false) }
      }
      const limpers = s.history.filter((h) => h.street === 'preflop' && h.action === 'call').length
      const inRange = openDecision(label, openPos) === 'raise'
      const pOpen = inRange ? Math.min(1, 0.8 * P.openWidth + 0.2) : Math.max(0, (P.openWidth - 1) * 0.45) * (str > 0.22 ? 1 : 0.3)
      if (r < pOpen) {
        if (rng() < P.limp) return { action: { type: 'call' }, thinkMs: think(false, false) }
        const to = bb * (limpers > 0 ? 3 + limpers : pos === 'BTN' || pos === 'CO' ? 2.3 : 2.6)
        return { action: raiseTo(to), thinkMs: think(str > 0.7, str < 0.3) }
      }
      // over-limp with speculative hands when limpers exist
      if (limpers > 0 && potOdds < 0.2 && str > 0.3 && r < 0.5 + P.callDown) return { action: { type: 'call' }, thinkMs: think(false, false) }
      return { action: { type: 'fold' }, thinkMs: think(false, false) }
    }

    if (facing3Bet) {
      if (VALUE_4BET.has(label) && r < 0.85) return { action: raiseTo(s.currentBet * 2.4), thinkMs: think(true, false) }
      if (CALL_3BET.has(label) || (P.callDown > 0.15 && str > 0.45)) return { action: { type: 'call' }, thinkMs: think(false, false) }
      if (r < P.bluff * 0.25) return { action: raiseTo(s.currentBet * 2.4), thinkMs: think(false, true) }
      return { action: { type: 'fold' }, thinkMs: think(false, false) }
    }

    // facing a single raise
    const raiserIdx = s.lastAggressor
    const rp = raiserIdx >= 0 ? (positionOf(s, raiserIdx) as string) : 'UTG'
    const raiserPos = (rp === 'UTG+1' || rp === 'MP' ? 'HJ' : rp) as Pos
    let d = vsRaiseDecision(label, pos, raiserPos)
    const threeBetP = clamp01(0.6 * P.threeBet)
    if (d === 'raise' && r > threeBetP + 0.3) d = 'call' // sometimes just call premiums (trapper etc.)
    if (d === 'call' && rng() < (P.threeBet - 1) * 0.35) d = 'raise' // LAG converts calls into 3-bets
    if (d === 'fold' && rng() < P.callDown + (P.openWidth - 1) * 0.25 && str > 0.25) d = 'call'
    if (d === 'fold' && rng() < P.bluff * 0.2 && str > 0.3) d = 'raise'
    if (d === 'call' && P.callDown < -0.05 && str < 0.45 && rng() < 0.5) d = 'fold'
    if (p.profile === 'trapper' && d === 'raise' && rng() < P.slowplay) d = 'call'
    if (d === 'raise') return { action: raiseTo(s.currentBet * (pos === 'SB' || pos === 'BB' ? 3.5 : 3)), thinkMs: think(str > 0.75, str < 0.4) }
    if (d === 'call') return { action: { type: 'call' }, thinkMs: think(false, false) }
    return { action: { type: 'fold' }, thinkMs: think(false, false) }
  }

  /* ---------------- Postflop ---------------- */
  const eq = equity(p.cards, s.board, Math.max(1, opponents), 120, rng)
  const detail = describeDetailed(p.cards, s.board)
  const potOdds = la.callAmount / (pot + la.callAmount || 1)
  const isPfa = s.pfAggressor === s.acting
  const monster = detail.strength === 'monster' || eq > 0.85
  const strong = !monster && (detail.strength === 'strong' || eq > 0.65)
  const medium = !monster && !strong && (detail.strength === 'medium' || eq > 0.45)
  const hasDraw = detail.draws.length > 0
  const comboDraw = detail.draws.length >= 2
  const multiway = opponents >= 2
  const street = s.street as 'flop' | 'turn' | 'river'
  const spr = p.stack / Math.max(pot, 1)
  const tex = boardTexture(s.board)
  const ip = isInPosition(s, s.acting)
  const streetActs = s.history.filter((h) => h.street === street)
  const iCheckedThisStreet = streetActs.some((h) => h.playerId === p.id && h.action === 'check')
  const prevStreet = street === 'turn' ? 'flop' : street === 'river' ? 'turn' : null
  const prevHadBet = prevStreet ? s.history.some((h) => h.street === prevStreet && (h.action === 'bet' || h.action === 'raise' || h.action === 'allin')) : true
  const overcards = p.cards.filter((c) => c.rank > Math.max(...s.board.map((b) => b.rank))).length
  const betSize = (frac: number) => raiseTo(s.currentBet + pot * sizeFrac(frac))

  if (la.canCheck) {
    if (monster) {
      if (street !== 'river' && rng() < P.slowplay + (ip ? 0 : 0.15)) return { action: { type: 'check' }, thinkMs: think(false, false) }
      const big = street === 'river' && (P.sizing === 'big' || P.aggression > 0.8) && rng() < 0.4 ? 1.25 : street === 'river' ? 0.8 : tex.wet ? 0.75 : 0.55
      return { action: betSize(big), thinkMs: think(true, false) }
    }
    if (strong) {
      if (rng() < P.aggression + 0.15) return { action: betSize(street === 'river' ? 0.66 : tex.wet ? 0.66 : 0.45), thinkMs: think(true, false) }
      return { action: { type: 'check' }, thinkMs: think(false, false) }
    }
    // continuation bet on the flop
    if (isPfa && street === 'flop') {
      const f = P.cbet * (tex.wet ? 0.75 : 1.1) * (multiway ? 0.5 : 1) * (ip ? 1 : 0.85) * (tex.highCard ? 1.1 : 0.9)
      if (rng() < f) return { action: betSize(tex.wet ? 0.6 : 0.33), thinkMs: think(false, !medium && !hasDraw) }
    }
    // delayed c-bet: checked back the flop, bets the turn when checked to
    if (isPfa && street === 'turn' && !prevHadBet && !multiway && rng() < P.cbet * 0.6) return { action: betSize(0.55), thinkMs: think(false, !medium) }
    // probe: the preflop raiser gave up, attack the turn
    if (!isPfa && street === 'turn' && !prevHadBet && !multiway && (medium || hasDraw || rng() < P.bluff * 1.3)) {
      if (rng() < 0.55 + P.aggression * 0.3) return { action: betSize(0.5), thinkMs: think(false, !medium && !hasDraw) }
    }
    if (medium) {
      // pot control; thin value in position on the river
      if (street === 'river' && ip && rng() < P.aggression * 0.55 + P.callDown) return { action: betSize(0.33), thinkMs: think(false, false) }
      if (street !== 'river' && ip && !multiway && rng() < P.aggression * 0.35) return { action: betSize(0.4), thinkMs: think(false, false) }
      return { action: { type: 'check' }, thinkMs: think(false, false) }
    }
    if (hasDraw && street !== 'river' && rng() < P.aggression * (comboDraw ? 0.9 : 0.55) * (multiway ? 0.6 : 1)) return { action: betSize(0.6), thinkMs: think(false, true) }
    // river bluff: polarised, big
    if (street === 'river') {
      const missed = s.history.some((h) => h.playerId === p.id && h.street !== 'preflop' && (h.action === 'bet' || h.action === 'raise'))
      if (!multiway && rng() < P.bluff * (missed ? 1.5 : 0.6) * (ip ? 1.2 : 0.8)) return { action: betSize(0.8), thinkMs: think(false, true) }
      return { action: { type: 'check' }, thinkMs: think(false, false) }
    }
    if (rng() < P.bluff * (multiway ? 0.35 : 1) * (tex.wet ? 0.7 : 1.2) * (ip ? 1.15 : 0.85)) return { action: betSize(tex.wet ? 0.55 : 0.4), thinkMs: think(false, true) }
    return { action: { type: 'check' }, thinkMs: think(false, false) }
  }

  // facing a bet: re-evaluate against a betting range
  const betFrac = la.callAmount / Math.max(1, pot - la.callAmount)
  const eqR = equityVsBettingRange(p.cards, s.board, street, betFrac, 120, rng)
  const threshold = potOdds + 0.04 - P.callDown
  if (monster) {
    const raiseP = P.aggression + (iCheckedThisStreet ? 0.2 : 0) - (street !== 'river' && ip ? P.slowplay * 0.5 : 0)
    if (rng() < raiseP) return { action: raiseTo(s.currentBet * (street === 'river' ? 3 : 2.7) + pot * 0.2), thinkMs: think(true, false) }
    return { action: { type: 'call' }, thinkMs: think(true, false) }
  }
  if (strong) {
    if (eqR > 0.62 && rng() < P.aggression * (iCheckedThisStreet ? 0.7 : 0.4)) return { action: raiseTo(s.currentBet * 2.7), thinkMs: think(true, false) }
    if (eqR > potOdds - 0.02 - P.callDown * 0.5) return { action: { type: 'call' }, thinkMs: think(false, false) }
    return { action: { type: 'fold' }, thinkMs: think(false, false) }
  }
  if (hasDraw && street !== 'river') {
    const implied = spr > 3 && betFrac <= 0.75
    if (eq > potOdds * 0.95 || implied) {
      if (rng() < P.aggression * (comboDraw ? 0.5 : 0.3) * (iCheckedThisStreet ? 1.4 : 1) && spr > 2 && !multiway) return { action: raiseTo(s.currentBet * 2.8), thinkMs: think(false, true) }
      return { action: { type: 'call' }, thinkMs: think(false, false) }
    }
  }
  if (eqR > threshold) {
    if (betFrac > 0.9 && !medium && rng() > 0.45 + P.callDown) return { action: { type: 'fold' }, thinkMs: think(false, false) }
    return { action: { type: 'call' }, thinkMs: think(false, false) }
  }
  // float in position with overcards against a small flop c-bet
  if (street === 'flop' && ip && !multiway && betFrac <= 0.5 && overcards >= 1 && rng() < 0.3 + P.callDown + (P.openWidth - 1) * 0.15) return { action: { type: 'call' }, thinkMs: think(false, false) }
  if (la.canRaise && street !== 'river' && rng() < P.bluff * 0.3 && !multiway && spr > 1.5) return { action: raiseTo(s.currentBet * 2.8), thinkMs: think(false, true) }
  if (P.callDown >= 0.25 && rng() < 0.45 && betFrac < 0.8) return { action: { type: 'call' }, thinkMs: think(false, false) } // station float
  return { action: { type: 'fold' }, thinkMs: think(false, false) }
}

/** Board texture: wet = flush or straight draws possible, highCard = A or K high. */
export function boardTexture(board: Card[]): { wet: boolean; paired: boolean; monotone: boolean; highCard: boolean } {
  const suits: Record<string, number> = {}
  for (const c of board) suits[c.suit] = (suits[c.suit] ?? 0) + 1
  const maxSuit = Math.max(0, ...Object.values(suits))
  const ranks = Array.from(new Set(board.map((c) => c.rank))).sort((a, b) => a - b)
  let connected = 0
  for (let i = 0; i < ranks.length; i++) for (let j = i + 1; j < ranks.length; j++) if (ranks[j] - ranks[i] <= 4) connected++
  const wet = maxSuit >= 2 && connected >= 2 || maxSuit >= 3 || connected >= 3
  return { wet, paired: ranks.length < board.length, monotone: maxSuit >= 3, highCard: Math.max(...board.map((c) => c.rank)) >= 13 }
}

/** True when the player acts last among the players still in the hand (postflop order). */
export function isInPosition(s: GameState, idx: number): boolean {
  const n = s.players.length
  const inHand = s.players.map((p, i) => ({ p, i })).filter((x) => !x.p.out && !x.p.folded)
  // postflop order starts left of the dealer; the last one in that order is in position
  let last = -1
  for (let k = 1; k <= n; k++) { const i = (s.dealer + k) % n; if (inHand.some((x) => x.i === i)) last = i }
  return last === idx
}
