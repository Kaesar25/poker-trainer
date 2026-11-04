import type { Card } from './cards'
import { equity, equityVsBettingRange, preflopStrength } from './bots'
import { legalActions, totalPot, type GameState } from './game'

export type Position = 'BTN' | 'SB' | 'BB' | 'UTG' | 'UTG+1' | 'MP' | 'HJ' | 'CO'

/** Position label of player idx given live players and dealer. */
export function positionOf(s: GameState, idx: number): Position {
  const live = s.players.map((p, i) => ({ p, i })).filter((x) => !x.p.out)
  const n = live.length
  const order = live.map((x) => x.i)
  const dPos = order.indexOf(s.dealer)
  const rel = (order.indexOf(idx) - dPos + n) % n
  if (n === 2) return rel === 0 ? 'BTN' : 'BB'
  if (rel === 0) return 'BTN'
  if (rel === 1) return 'SB'
  if (rel === 2) return 'BB'
  const fromBtn = n - rel // seats before button
  if (fromBtn === 1) return 'CO'
  if (fromBtn === 2) return 'HJ'
  if (rel === 3) return 'UTG'
  if (rel === 4) return 'UTG+1'
  return 'MP'
}

export interface Advice {
  equity: number
  potOdds: number
  outsHint?: string
  action: 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin'
  amount?: number
  title: string
  reason: string
}

export function advise(s: GameState, heroIdx: number, rng: () => number = Math.random): Advice | null {
  if (s.acting !== heroIdx) return null
  const hero = s.players[heroIdx]
  const la = legalActions(s, heroIdx)
  const pot = totalPot(s)
  const opponents = s.players.filter((p) => !p.out && !p.folded && p.id !== hero.id).length
  const potOdds = la.callAmount > 0 ? la.callAmount / (pot + la.callAmount) : 0
  const facingBet = la.callAmount > 0 && s.street !== 'preflop'
  const eq = s.street === 'preflop'
    ? preflopEquityEstimate(hero.cards, opponents)
    : facingBet
      ? equityVsBettingRange(hero.cards, s.board, s.street as 'flop' | 'turn' | 'river', la.callAmount / Math.max(1, pot - la.callAmount), 300, rng)
      : equity(hero.cards, s.board, opponents, 400, rng)
  const pct = (x: number) => `${Math.round(x * 100)} %`
  const bbs = hero.stack / s.blinds.bb

  if (s.street === 'preflop') {
    const str = preflopStrength(hero.cards)
    const pos = positionOf(s, heroIdx)
    const late = pos === 'BTN' || pos === 'CO' || pos === 'HJ'
    const facingRaise = s.currentBet > s.blinds.bb
    const threshold = late ? 0.3 : pos === 'BB' || pos === 'SB' ? 0.38 : 0.45
    if (bbs <= 12 && str >= (late ? 0.35 : 0.5)) {
      return { equity: eq, potOdds, action: 'allin', title: 'Tapis', reason: `Avec ${Math.round(bbs)} BB, tu es en zone push/fold : cette main se joue à tapis depuis ${pos}.` }
    }
    if (facingRaise) {
      if (str >= 0.75) return { equity: eq, potOdds, action: 'raise', amount: Math.round(s.currentBet * 3), title: `Sur-relance à ${Math.round(s.currentBet * 3)}`, reason: `Main premium (${pct(eq)} d'équité estimée) : prends l'initiative pour valeur.` }
      if (str >= threshold + 0.1) return { equity: eq, potOdds, action: 'call', title: 'Suivre', reason: `Main jouable face à une relance, surtout en position. Cote du pot ${pct(potOdds)}, équité ≈ ${pct(eq)}.` }
      return { equity: eq, potOdds, action: 'fold', title: 'Se coucher', reason: `Main trop faible pour payer une relance depuis ${pos}. Garde tes jetons pour un meilleur spot.` }
    }
    if (la.canCheck) {
      if (str >= 0.55) return { equity: eq, potOdds, action: 'raise', amount: s.blinds.bb * 3, title: `Relancer à ${s.blinds.bb * 3}`, reason: `Tu as l'option en BB avec une bonne main : relance pour valeur plutôt que de checker.` }
      return { equity: eq, potOdds, action: 'check', title: 'Check', reason: `Personne n'a relancé : vois un flop gratuit.` }
    }
    if (str >= threshold) {
      const to = s.blinds.bb * (late ? 2.5 : 3)
      return { equity: eq, potOdds, action: 'raise', amount: Math.round(to), title: `Relancer à ${Math.round(to)}`, reason: `Depuis ${pos}, cette main mérite une ouverture. Évite de limper : relance ou couche.` }
    }
    return { equity: eq, potOdds, action: 'fold', title: 'Se coucher', reason: `Main sous ton range d'ouverture depuis ${pos}. Patience.` }
  }

  // postflop
  const strong = eq >= 0.65
  const medium = eq >= 0.45
  const bet = (frac: number) => Math.max(la.minRaiseTo, Math.round(s.currentBet + (pot + la.callAmount) * frac))
  if (la.canCheck) {
    if (strong) {
      const to = Math.min(bet(0.66), la.maxRaiseTo)
      return { equity: eq, potOdds, action: to >= la.maxRaiseTo ? 'allin' : 'bet', amount: to, title: `Miser ${to}`, reason: `≈ ${pct(eq)} d'équité : mise pour valeur (2/3 du pot) et fais payer les tirages.` }
    }
    if (medium) return { equity: eq, potOdds, action: 'check', title: 'Check', reason: `Main moyenne (≈ ${pct(eq)}) : contrôle la taille du pot, surtout contre un gros stack.` }
    return { equity: eq, potOdds, action: 'check', title: 'Check', reason: `Main faible (≈ ${pct(eq)}). Un bluff est possible mais pas nécessaire ici.` }
  }
  const margin = eq - potOdds
  if (eq >= 0.75 && la.canRaise) {
    const to = Math.min(bet(1), la.maxRaiseTo)
    return { equity: eq, potOdds, action: to >= la.maxRaiseTo ? 'allin' : 'raise', amount: to, title: `Relancer à ${to}`, reason: `Très forte équité (≈ ${pct(eq)}) : relance pour construire le pot.` }
  }
  if (margin > 0.03) {
    const risk = la.callAmount / hero.stack
    if (risk > 0.5 && eq < 0.6) return { equity: eq, potOdds, action: 'fold', title: 'Se coucher (prudence)', reason: `Le call est à peine rentable (équité ${pct(eq)} vs cote ${pct(potOdds)}) mais engage ${Math.round(risk * 100)} % de ton tapis. En tournoi, ce spot marginal n'en vaut pas la peine.` }
    return { equity: eq, potOdds, action: 'call', title: 'Suivre', reason: `Contre le range de mains qui misent ici, équité ≈ ${pct(eq)} > cote du pot ${pct(potOdds)} : le call est rentable.` }
  }
  return { equity: eq, potOdds, action: 'fold', title: 'Se coucher', reason: `Contre le range de mains qui misent ici, équité ≈ ${pct(eq)} < cote du pot ${pct(potOdds)} : payer perd des jetons à long terme.` }
}

function preflopEquityEstimate(cards: Card[], opponents: number): number {
  // Cheap estimate: map strength to heads-up equity then shrink for more opponents.
  const str = preflopStrength(cards)
  const hu = 0.35 + str * 0.5
  return Math.max(0.1, hu - (opponents - 1) * 0.07)
}
