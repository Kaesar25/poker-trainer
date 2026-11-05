import type { Card } from './cards'
import { equity, equityVsBettingRange, preflopStrength, boardTexture, isInPosition } from './bots'
import { describeDetailed } from './evaluator'
import { handLabel, openDecision, vsRaiseDecision, pushDecision, callShoveDecision, type Pos } from './ranges'
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

export interface CoachContext { icmPressure?: number }

export function advise(s: GameState, heroIdx: number, rng: () => number = Math.random, ctx?: CoachContext): Advice | null {
  const a = adviseRaw(s, heroIdx, rng, ctx)
  if (!a) return a
  const la = legalActions(s, heroIdx)
  if ((a.action === 'raise' || a.action === 'bet' || a.action === 'allin') && !la.canRaise) {
    return la.canCheck ? { ...a, action: 'check', title: 'Check' } : { ...a, action: 'call', title: la.callAmount >= s.players[heroIdx].stack ? 'Suivre à tapis' : 'Suivre' }
  }
  if (a.amount !== undefined && a.amount >= la.maxRaiseTo && (a.action === 'raise' || a.action === 'bet')) return { ...a, action: 'allin', title: `Tapis ${la.maxRaiseTo}` }
  return a
}

const RANGE_POS = (p: Position): Pos => (p === 'UTG+1' || p === 'MP' ? 'HJ' : p) as Pos

function adviseRaw(s: GameState, heroIdx: number, rng: () => number = Math.random, ctx?: CoachContext): Advice | null {
  if (s.acting !== heroIdx) return null
  const hero = s.players[heroIdx]
  const la = legalActions(s, heroIdx)
  const pot = totalPot(s)
  const live = s.players.filter((p) => !p.out && !p.folded && p.id !== hero.id)
  const opponents = live.length
  const potOdds = la.callAmount > 0 ? la.callAmount / (pot + la.callAmount) : 0
  const facingBet = la.callAmount > 0 && s.street !== 'preflop'
  const betFrac = la.callAmount / Math.max(1, pot - la.callAmount)
  const eq = s.street === 'preflop'
    ? preflopEquityEstimate(hero.cards, opponents)
    : facingBet
      ? equityVsBettingRange(hero.cards, s.board, s.street as 'flop' | 'turn' | 'river', betFrac, 300, rng)
      : equity(hero.cards, s.board, opponents, 400, rng)
  const pct = (x: number) => `${Math.round(x * 100)} %`
  const bbs = hero.stack / s.blinds.bb
  const icm = ctx?.icmPressure ?? 0
  const aggressorIdx = s.lastAggressor >= 0 ? s.lastAggressor : -1
  const aggressor = aggressorIdx >= 0 ? s.players[aggressorIdx] : null
  const covered = !!aggressor && aggressor.id !== hero.id && aggressor.stack + aggressor.bet >= hero.stack + hero.bet
  const premium = icm > 0 && covered ? Math.round(icm * 12) / 100 : 0 // extra equity required against a covering stack
  const premiumTxt = premium > 0 ? ` En plus, ${aggressor!.name} te couvre ${icm >= 0.9 ? 'à la bulle' : 'en fin de tournoi'} : ajoute environ ${Math.round(premium * 100)} points de prime de risque.` : ''

  if (s.street === 'preflop') {
    const label = handLabel(hero.cards)
    const pos = positionOf(s, heroIdx)
    const rp = RANGE_POS(pos)
    const facingRaise = s.currentBet > s.blinds.bb
    const limpers = s.history.filter((h) => h.street === 'preflop' && h.action === 'call').length
    // push/fold zone
    if (bbs <= 12 && !facingRaise && !la.canCheck) {
      const push = pushDecision(label, (rp === 'BB' ? 'SB' : rp) as Exclude<Pos, 'BB'>, bbs) === 'push'
      return push
        ? { equity: eq, potOdds, action: 'allin', title: 'Tapis', reason: `Avec ${Math.round(bbs)} BB, tu es en zone push/fold : ${label} se pousse depuis ${pos}. Pas de petite relance, elle t'engagerait sans fold equity.` }
        : { equity: eq, potOdds, action: 'fold', title: 'Se coucher', reason: `À ${Math.round(bbs)} BB, ${label} est trop faible pour pousser depuis ${pos}. Attends un meilleur spot.` }
    }
    if (facingRaise) {
      const toCall = la.callAmount
      const shove = aggressor ? aggressor.allIn || toCall >= hero.stack * 0.6 : false
      if (shove) {
        const ok = callShoveDecision(label, Math.min(15, (toCall + hero.bet) / s.blinds.bb)) === 'call'
        const tighter = premium > 0 && !['AA', 'KK', 'QQ', 'JJ', 'AKs', 'AKo'].includes(label)
        return ok && !tighter
          ? { equity: eq, potOdds, action: 'call', title: 'Payer le tapis', reason: `${label} a assez d'équité contre son range de tapis.` }
          : { equity: eq, potOdds, action: 'fold', title: 'Se coucher', reason: `${label} ne paie pas ce tapis${tighter ? ' : il te couvre et la prime de risque exige une main premium' : ''}.` }
      }
      const raiserPos = aggressorIdx >= 0 ? RANGE_POS(positionOf(s, aggressorIdx)) : 'UTG'
      let d = vsRaiseDecision(label, rp, raiserPos)
      if (premium > 0 && d === 'raise' && !['AA', 'KK', 'QQ', 'AKs', 'AKo'].includes(label)) d = 'call'
      if (premium > 0 && d === 'call' && preflopStrength(hero.cards) < 0.5) d = 'fold'
      if (d === 'raise') { const to = Math.round(s.currentBet * (rp === 'SB' || rp === 'BB' ? 3.5 : 3)); return { equity: eq, potOdds, action: 'raise', amount: to, title: `Sur-relance à ${to}`, reason: `${label} se 3-bet face à une ouverture de ${raiserPos} : pour valeur ou comme bluff avec bloqueur.` } }
      if (d === 'call') return { equity: eq, potOdds, action: 'call', title: 'Suivre', reason: `${label} se joue en call face à ${raiserPos}${rp === 'BB' ? ' : tu as déjà payé la BB et tu clôtures l\'action' : ' en position'}. Cote du pot ${pct(potOdds)}.${premiumTxt}` }
      return { equity: eq, potOdds, action: 'fold', title: 'Se coucher', reason: `${label} est trop faible ou dominé face à une relance de ${raiserPos}.${premiumTxt}` }
    }
    if (la.canCheck) {
      if (preflopStrength(hero.cards) >= 0.55) { const to = s.blinds.bb * (3 + limpers); return { equity: eq, potOdds, action: 'raise', amount: to, title: `Relancer à ${to}`, reason: `Option en BB avec ${label} : relance pour valeur, les limpers ont des mains faibles.` } }
      return { equity: eq, potOdds, action: 'check', title: 'Check', reason: 'Personne n\'a relancé : vois un flop gratuit.' }
    }
    const open = openDecision(label, (rp === 'BB' ? 'SB' : rp) as Exclude<Pos, 'BB'>) === 'raise'
    if (open) { const to = Math.round(s.blinds.bb * ((pos === 'BTN' || pos === 'CO' ? 2.3 : 2.6) + limpers)); return { equity: eq, potOdds, action: 'raise', amount: to, title: `Relancer à ${to}`, reason: `${label} fait partie de ton range d'ouverture depuis ${pos}${limpers ? ` ; ajoute 1 BB par limper (${limpers})` : ''}. Relance ou couche, ne limpe pas.` } }
    return { equity: eq, potOdds, action: 'fold', title: 'Se coucher', reason: `${label} est sous ton range d'ouverture depuis ${pos}. Patience.` }
  }

  // ---------------- postflop ----------------
  const detail = describeDetailed(hero.cards, s.board)
  const tex = boardTexture(s.board)
  const ip = isInPosition(s, heroIdx)
  const isPfa = s.pfAggressor === heroIdx
  const strong = eq >= 0.65 || detail.strength === 'monster' || detail.strength === 'strong'
  const medium = !strong && (eq >= 0.45 || detail.strength === 'medium')
  const hasDraw = detail.draws.length > 0
  const bet = (frac: number) => Math.min(la.maxRaiseTo, Math.max(la.minRaiseTo, Math.round(s.currentBet + (pot + la.callAmount) * frac)))
  const multi = opponents >= 2
  if (la.canCheck) {
    if (strong) {
      const frac = tex.wet ? 0.7 : s.street === 'river' ? 0.66 : 0.45
      const to = bet(frac)
      return { equity: eq, potOdds, action: 'bet', amount: to, title: `Miser ${to}`, reason: `${detail.made} (≈ ${pct(eq)}) : mise pour valeur${tex.wet ? ', gros sur ce board humide pour faire payer les tirages' : ', une taille moyenne suffit sur ce board sec'}.${covered && icm > 0 ? '' : ''}` }
    }
    if (isPfa && s.street === 'flop' && !multi && (!tex.wet || hasDraw || medium)) {
      const to = bet(tex.wet ? 0.55 : 0.33)
      return { equity: eq, potOdds, action: 'bet', amount: to, title: `C-bet ${to}`, reason: `Tu as relancé préflop et ${tex.wet ? 'tu as de l\'équité' : 'ce board sec favorise ton range'} : un c-bet ${tex.wet ? 'moyen' : 'petit (⅓ pot)'} fait coucher beaucoup de mains.` }
    }
    if (hasDraw && s.street !== 'river' && !multi && (ip || detail.draws.length >= 2)) {
      const to = bet(0.6)
      return { equity: eq, potOdds, action: 'bet', amount: to, title: `Semi-bluff ${to}`, reason: `${detail.draws.join(', ')} : miser te donne deux façons de gagner, il se couche ou tu touches.` }
    }
    if (medium) {
      if (s.street === 'river' && ip) { const to = bet(0.33); return { equity: eq, potOdds, action: 'bet', amount: to, title: `Petite mise ${to}`, reason: `${detail.made} : en position à la river, une petite mise pour valeur se fait payer par pire.` } }
      return { equity: eq, potOdds, action: 'check', title: 'Check', reason: `${detail.made} (≈ ${pct(eq)}) : contrôle la taille du pot${covered ? ', surtout contre un gros stack' : ''}.` }
    }
    return { equity: eq, potOdds, action: 'check', title: 'Check', reason: `${detail.made} : pas assez d'équité pour miser ici${multi ? ' face à plusieurs adversaires' : ''}.` }
  }
  const need = potOdds + premium
  if ((eq >= 0.78 || detail.strength === 'monster') && la.canRaise && premium === 0) {
    const to = bet(1)
    return { equity: eq, potOdds, action: 'raise', amount: to, title: `Relancer à ${to}`, reason: `${detail.made} (≈ ${pct(eq)} contre son range) : relance pour construire le pot.` }
  }
  if (hasDraw && s.street !== 'river') {
    const implied = hero.stack > pot * 3 && betFrac <= 0.75
    if (eq >= need - 0.03 || implied) return { equity: eq, potOdds, action: 'call', title: 'Suivre', reason: `${detail.draws.join(', ')} : ${eq >= need ? `ton équité (${pct(eq)}) couvre la cote (${pct(potOdds)})` : 'les cotes implicites justifient le call, les tapis sont profonds'}.${premiumTxt}` }
  }
  if (eq - need > 0.03) {
    const risk = la.callAmount / hero.stack
    if (risk > 0.5 && eq < 0.6) return { equity: eq, potOdds, action: 'fold', title: 'Se coucher (prudence)', reason: `Le call est à peine rentable (équité ${pct(eq)} vs cote ${pct(potOdds)}) mais engage ${Math.round(risk * 100)} % de ton tapis.${premiumTxt}` }
    return { equity: eq, potOdds, action: 'call', title: 'Suivre', reason: `Contre le range de mains qui misent ici, équité ≈ ${pct(eq)} > ${premium ? `cote + prime ${pct(need)}` : `cote du pot ${pct(potOdds)}`} : le call est rentable.` }
  }
  return { equity: eq, potOdds, action: 'fold', title: 'Se coucher', reason: `Contre le range de mains qui misent ici, équité ≈ ${pct(eq)} < ${premium ? `cote + prime ${pct(need)}` : `cote du pot ${pct(potOdds)}`} : payer perd des jetons à long terme.${premiumTxt}` }
}

function preflopEquityEstimate(cards: Card[], opponents: number): number {
  // Cheap estimate: map strength to heads-up equity then shrink for more opponents.
  const str = preflopStrength(cards)
  const hu = 0.35 + str * 0.5
  return Math.max(0.1, hu - (opponents - 1) * 0.07)
}
