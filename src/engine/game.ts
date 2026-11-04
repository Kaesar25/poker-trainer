import { newDeck, shuffle, type Card, cardToString } from './cards'
import { evaluate, describe, describeDetailed, type HandValue } from './evaluator'

export type Street = 'idle' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown'
export type BotProfile = 'nit' | 'rock' | 'tag' | 'lag' | 'maniac' | 'station' | 'bluffer' | 'trapper' | 'shortstack' | 'tilter' | 'fish' | 'bully'

export interface Player {
  id: number
  name: string
  stack: number
  isBot: boolean
  profile?: BotProfile
  cards: Card[]
  bet: number // committed this street
  totalBet: number // committed this hand
  folded: boolean
  allIn: boolean
  out: boolean // busted
  showCards: boolean
  mood?: number // bots: hands of tilt remaining
  memo?: { vsHeroHands: number; heroShowdownsWeak: number } // bots' memory of the hero
}

export interface ActionRecord {
  playerId: number
  street: Street
  action: ActionType
  amount: number
}

export type ActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin' | 'sb' | 'bb' | 'ante'

export interface Action {
  type: 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin'
  amount?: number // for bet/raise: total amount to put in this street (the "to" size)
}

export interface HandResult {
  winners: { playerId: number; amount: number; hand?: HandValue; potIndex: number }[]
  revealed: Record<number, Card[]>
  descriptions: Record<number, string>
}

export interface GameState {
  players: Player[]
  dealer: number
  deck: Card[]
  board: Card[]
  street: Street
  pot: number // chips collected from completed streets
  currentBet: number
  minRaise: number
  acting: number // index of player to act, -1 if none
  lastAggressor: number
  pfAggressor: number // index of the last preflop raiser (-1 if none)
  toAct: number[] // ids who still need to act this street
  blinds: { sb: number; bb: number; ante: number }
  handNumber: number
  log: string[]
  history: ActionRecord[]
  result: HandResult | null
}

export function createGame(players: Omit<Player, 'cards' | 'bet' | 'totalBet' | 'folded' | 'allIn' | 'out' | 'showCards'>[], blinds: GameState['blinds']): GameState {
  return {
    players: players.map((p) => ({ ...p, cards: [], bet: 0, totalBet: 0, folded: false, allIn: false, out: p.stack <= 0, showCards: false })),
    dealer: -1,
    deck: [],
    board: [],
    street: 'idle',
    pot: 0,
    currentBet: 0,
    minRaise: blinds.bb,
    acting: -1,
    lastAggressor: -1,
    pfAggressor: -1,
    toAct: [],
    blinds,
    handNumber: 0,
    log: [],
    history: [],
    result: null,
  }
}

const clone = (s: GameState): GameState => ({
  ...s,
  players: s.players.map((p) => ({ ...p, cards: p.cards.slice() })),
  board: s.board.slice(),
  deck: s.deck.slice(),
  log: s.log.slice(),
  history: s.history.slice(),
  toAct: s.toAct.slice(),
})

export function activePlayers(s: GameState): Player[] {
  return s.players.filter((p) => !p.out)
}
function inHand(s: GameState): Player[] {
  return s.players.filter((p) => !p.out && !p.folded)
}
function canAct(s: GameState): Player[] {
  return s.players.filter((p) => !p.out && !p.folded && !p.allIn)
}

function nextIndex(s: GameState, from: number, pred: (p: Player) => boolean): number {
  const n = s.players.length
  for (let k = 1; k <= n; k++) {
    const i = (from + k) % n
    if (pred(s.players[i])) return i
  }
  return -1
}

export function totalPot(s: GameState): number {
  return s.pot + s.players.reduce((a, p) => a + p.bet, 0)
}

function commit(p: Player, amount: number): number {
  const a = Math.min(amount, p.stack)
  p.stack -= a
  p.bet += a
  p.totalBet += a
  if (p.stack === 0) p.allIn = true
  return a
}

export function startHand(prev: GameState, rng: () => number = Math.random): GameState {
  const s = clone(prev)
  s.result = null
  s.board = []
  s.pot = 0
  s.history = []
  s.handNumber += 1
  for (const p of s.players) {
    p.cards = []
    p.bet = 0
    p.totalBet = 0
    p.folded = false
    p.allIn = false
    p.showCards = false
    if (p.stack <= 0) p.out = true
  }
  const live = activePlayers(s)
  if (live.length < 2) {
    s.street = 'idle'
    s.log.push('Partie terminée.')
    return s
  }
  s.dealer = nextIndex(s, s.dealer, (p) => !p.out)
  s.deck = shuffle(newDeck(), rng)
  for (const p of live) p.cards = [s.deck.pop()!, s.deck.pop()!]
  s.log.push(`— Main n°${s.handNumber} — Blinds ${s.blinds.sb}/${s.blinds.bb}${s.blinds.ante ? ` ante ${s.blinds.ante}` : ''}`)

  // antes
  if (s.blinds.ante > 0) {
    for (const p of live) {
      commit(p, s.blinds.ante)
    }
    // antes go straight to pot
    s.pot = s.players.reduce((a, p) => a + p.bet, 0)
    for (const p of s.players) p.bet = 0
  }

  const headsUp = live.length === 2
  const sbIdx = headsUp ? s.dealer : nextIndex(s, s.dealer, (p) => !p.out)
  const bbIdx = nextIndex(s, sbIdx, (p) => !p.out)
  commit(s.players[sbIdx], s.blinds.sb)
  commit(s.players[bbIdx], s.blinds.bb)
  s.history.push({ playerId: s.players[sbIdx].id, street: 'preflop', action: 'sb', amount: s.players[sbIdx].bet })
  s.history.push({ playerId: s.players[bbIdx].id, street: 'preflop', action: 'bb', amount: s.players[bbIdx].bet })
  s.log.push(`${s.players[sbIdx].name} poste SB ${s.blinds.sb}, ${s.players[bbIdx].name} poste BB ${s.blinds.bb}`)

  s.street = 'preflop'
  s.pfAggressor = -1
  s.currentBet = s.blinds.bb
  s.minRaise = s.blinds.bb
  s.lastAggressor = bbIdx
  s.toAct = canAct(s).map((p) => p.id)
  s.acting = nextIndex(s, bbIdx, (p) => !p.out && !p.folded && !p.allIn)
  if (canAct(s).length <= 1 && s.players.filter((p) => !p.out && !p.folded && p.allIn).length > 0) {
    // everyone is all-in from the blinds
    return settleIfNeeded(s)
  }
  return s
}

export interface LegalActions {
  canCheck: boolean
  callAmount: number // extra chips needed to call
  minRaiseTo: number
  maxRaiseTo: number
  canRaise: boolean
}

export function legalActions(s: GameState, playerIdx = s.acting): LegalActions {
  const p = s.players[playerIdx]
  const callAmount = Math.min(s.currentBet - p.bet, p.stack)
  const canCheck = s.currentBet === p.bet
  const maxRaiseTo = p.bet + p.stack
  const minRaiseTo = Math.min(s.currentBet + s.minRaise, maxRaiseTo)
  const canRaise = maxRaiseTo > s.currentBet
  return { canCheck, callAmount, minRaiseTo, maxRaiseTo, canRaise }
}

export function applyAction(prev: GameState, action: Action): GameState {
  if (prev.acting < 0 || prev.street === 'idle' || prev.street === 'showdown') return prev
  const s = clone(prev)
  const idx = s.acting
  const p = s.players[idx]
  const la = legalActions(s, idx)
  let rec: ActionType = action.type
  let amt = 0

  switch (action.type) {
    case 'fold':
      p.folded = true
      s.log.push(`${p.name} se couche`)
      break
    case 'check':
      if (!la.canCheck) throw new Error('check illégal')
      s.log.push(`${p.name} checke`)
      break
    case 'call': {
      amt = commit(p, la.callAmount)
      s.log.push(`${p.name} suit ${amt}${p.allIn ? ' (tapis)' : ''}`)
      if (p.allIn) rec = 'allin'
      break
    }
    case 'bet':
    case 'raise':
    case 'allin': {
      let to = action.type === 'allin' ? la.maxRaiseTo : action.amount ?? la.minRaiseTo
      to = Math.min(Math.max(to, la.minRaiseTo), la.maxRaiseTo)
      // all-in for less than min raise is allowed but does not reopen action
      const isFull = to >= s.currentBet + s.minRaise
      const raiseSize = to - s.currentBet
      amt = commit(p, to - p.bet)
      const label = s.currentBet === 0 ? 'mise' : 'relance à'
      s.log.push(`${p.name} ${label} ${p.bet}${p.allIn ? ' (tapis)' : ''}`)
      if (p.bet > s.currentBet) {
        if (isFull) {
          s.minRaise = raiseSize
          // reopen action for everyone else
          s.toAct = canAct(s).filter((q) => q.id !== p.id).map((q) => q.id)
        }
        s.currentBet = p.bet
        s.lastAggressor = idx
      }
      if (p.allIn) rec = 'allin'
      else rec = s.currentBet === p.bet && label === 'mise' ? 'bet' : 'raise'
      break
    }
  }
  s.history.push({ playerId: p.id, street: s.street, action: rec, amount: p.bet })
  s.toAct = s.toAct.filter((id) => id !== p.id)

  // hand over by folds?
  if (inHand(s).length === 1) return settle(s)

  // find next to act
  const next = nextIndex(s, idx, (q) => !q.out && !q.folded && !q.allIn && s.toAct.includes(q.id))
  if (next === -1) return advanceStreet(s)
  s.acting = next
  return s
}

function advanceStreet(prev: GameState): GameState {
  const s = prev
  s.pot += s.players.reduce((a, p) => a + p.bet, 0)
  for (const p of s.players) p.bet = 0
  s.currentBet = 0
  s.minRaise = s.blinds.bb
  if (s.street === 'river') return settle(s)
  if (s.street === 'preflop') s.pfAggressor = s.lastAggressor
  if (s.street === 'preflop') s.board.push(s.deck.pop()!, s.deck.pop()!, s.deck.pop()!), (s.street = 'flop')
  else if (s.street === 'flop') s.board.push(s.deck.pop()!), (s.street = 'turn')
  else if (s.street === 'turn') s.board.push(s.deck.pop()!), (s.street = 'river')
  s.log.push(`${s.street === 'flop' ? 'Flop' : s.street === 'turn' ? 'Turn' : 'River'} : ${s.board.map(cardToString).join(' ')}`)
  const actors = canAct(s)
  if (actors.length <= 1) {
    // no more betting possible: run it out
    return advanceStreet(s)
  }
  s.toAct = actors.map((p) => p.id)
  s.acting = nextIndex(s, s.dealer, (p) => !p.out && !p.folded && !p.allIn)
  s.lastAggressor = -1
  return s
}

function settleIfNeeded(s: GameState): GameState {
  // everyone all-in from the blinds: run out the board and settle
  if (canAct(s).length <= 1) return advanceStreet(s)
  return s
}

function settle(s: GameState): GameState {
  s.pot += s.players.reduce((a, p) => a + p.bet, 0)
  for (const p of s.players) p.bet = 0
  const contenders = inHand(s)
  const result: HandResult = { winners: [], revealed: {}, descriptions: {} }

  if (contenders.length === 1) {
    const w = contenders[0]
    w.stack += s.pot
    result.winners.push({ playerId: w.id, amount: s.pot, potIndex: 0 })
    s.log.push(`${w.name} remporte ${s.pot}`)
  } else {
    // deal remaining board if needed (everyone all-in before river)
    while (s.board.length < 5) s.board.push(s.deck.pop()!)
    const values = new Map<number, HandValue>()
    for (const p of contenders) {
      const v = evaluate([...p.cards, ...s.board])
      values.set(p.id, v)
      p.showCards = true
      result.revealed[p.id] = p.cards
      result.descriptions[p.id] = describeDetailed(p.cards, s.board).made
    }
    // side pots
    const levels = Array.from(new Set(s.players.filter((p) => p.totalBet > 0).map((p) => p.totalBet))).sort((a, b) => a - b)
    let prevLevel = 0
    let potIndex = 0
    let distributed = 0
    for (const level of levels) {
      let potAmt = 0
      for (const p of s.players) potAmt += Math.max(0, Math.min(p.totalBet, level) - prevLevel)
      const eligible = contenders.filter((p) => p.totalBet >= level)
      if (potAmt > 0 && eligible.length > 0) {
        const best = Math.max(...eligible.map((p) => values.get(p.id)!.score))
        const winners = eligible.filter((p) => values.get(p.id)!.score === best)
        const share = Math.floor(potAmt / winners.length)
        let rem = potAmt - share * winners.length
        for (const w of winners) {
          const extra = rem > 0 ? 1 : 0
          rem -= extra
          w.stack += share + extra
          result.winners.push({ playerId: w.id, amount: share + extra, hand: values.get(w.id), potIndex })
          s.log.push(`${w.name} remporte ${share + extra} avec ${describe(values.get(w.id)!)}`)
        }
        distributed += potAmt
        potIndex++
      }
      prevLevel = level
    }
    // antes already in pot but not in totalBet accounting? they are (commit adds to totalBet). Any rounding leftover:
    const leftover = s.pot - distributed
    if (leftover > 0) contenders[0].stack += leftover
  }
  // mood: a bot that lost a big pot may tilt for a few hands (profile-dependent, see bots.ts)
  for (const p of s.players) {
    if (!p.isBot || p.out) continue
    const lost = p.totalBet - result.winners.filter((w) => w.playerId === p.id).reduce((a, w) => a + w.amount, 0)
    if (lost > 0 && lost >= 0.3 * (p.stack + lost)) p.mood = (p.mood ?? 0) + 6
    else if (p.mood && p.mood > 0) p.mood -= 1
  }
  s.pot = 0
  s.street = 'showdown'
  s.acting = -1
  s.result = result
  for (const p of s.players) if (p.stack <= 0) p.out = true
  return s
}

export function isHandOver(s: GameState): boolean {
  return s.street === 'showdown' || s.street === 'idle'
}
