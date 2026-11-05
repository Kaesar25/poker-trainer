import { useCallback, useEffect, useRef, useState } from 'react'
import { applyAction, createGame, isHandOver, startHand, type Action, type BotProfile, type GameState, type Player } from '../engine/game'
import { botDecideFull, tableProfiles } from '../engine/bots'
import { advise, positionOf } from '../engine/coach'
import { buildRecord, heroModel, type HandRecord } from '../engine/stats'
import { blindsFor, chipLeaderStacks, createTournament, currentLevelIndex, elapsed, expectedField, isTournamentOver, outsideAverageStack, pause, prizeFor, reenter, registerEliminations, registerMarathonBusts, resume, type Tournament } from '../engine/tournament'
import { loadStore, saveStore, type CheckIn, type Decision, type Store, type TournamentResult } from '../store'

export const HERO = 0
export type Mode = 'cash' | 'sng' | 'chipleader' | 'marathon' | 'headsup' | 'express'
export type NoteTag = 'serre' | 'solide' | 'agressif' | 'bluffeur' | 'station' | 'piegeur'
export interface PlayerNote { tag?: NoteTag; text?: string }

export interface SessionConfig {
  mode: Mode
  players: number
  stack: number
  structureId: string
  botSpeed: number
  checkin?: CheckIn
  entrants?: number
  reentryUntilLevel?: number
}

const BOT_NAMES = ['Léo', 'Marco', 'Sofia', 'Nina', 'Tom', 'Ava', 'Hugo', 'Emma', 'Lucas', 'Inès', 'Noah', 'Jade', 'Gabriel', 'Chloé', 'Raph', 'Lina', 'Adam', 'Zoé', 'Louis', 'Manon', 'Yanis', 'Sara', 'Enzo', 'Léa', 'Mathis', 'Camille', 'Nathan', 'Alice', 'Théo', 'Rose']

export interface Session {
  mode: Mode
  config: SessionConfig
  state: GameState
  tournament: Tournament | null
  records: HandRecord[]
  decisions: Decision[]
  over: boolean
  result: TournamentResult | null
  paused: boolean
  pauseReason: 'hourly' | 'manual' | 'fatigue' | null
  lastPauseAtMs: number
  playStartedAt: number
  playedMs: number
  botsSeated: number
  events: { t: number; text: string }[] // marathon news feed
  canReenter: boolean
  notes: Record<number, PlayerNote & { name: string; profile?: BotProfile }>
}

export const PAUSE_EVERY_MS = 60 * 60 * 1000
const SESSION_KEY = 'poker-trainer-session'

export function playedMs(s: Session, now = Date.now()): number {
  return s.playedMs + (s.paused ? 0 : now - s.playStartedAt)
}

function loadSaved(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as Session
    if (!s || !s.state || s.over) return null
    return s
  } catch { return null }
}
function saveSession(s: Session | null) {
  try {
    if (!s || s.over) { localStorage.removeItem(SESSION_KEY); return }
    const now = Date.now()
    const frozen: Session = { ...s, paused: true, pauseReason: null, playedMs: playedMs(s, now), playStartedAt: now, tournament: s.tournament ? pause(s.tournament, now) : null }
    localStorage.setItem(SESSION_KEY, JSON.stringify(frozen))
  } catch { /* ignore */ }
}

export function useSession() {
  const [store, setStore] = useState<Store>(() => loadStore())
  const [session, setSession] = useState<Session | null>(null)
  const [saved, setSaved] = useState<Session | null>(() => loadSaved())
  const beforeRef = useRef<GameState | null>(null)
  const timer = useRef<number | null>(null)
  const storeRef = useRef(store)
  storeRef.current = store
  const actingSince = useRef<number>(0)

  useEffect(() => saveStore(store), [store])
  useEffect(() => { if (session) saveSession(session) }, [session])
  const updateStore = useCallback((fn: (s: Store) => Store) => setStore((s) => fn(s)), [])

  const mkBot = useCallback((id: number, nameIdx: number, stack: number, profile: BotProfile): Player => ({ id, name: BOT_NAMES[nameIdx % BOT_NAMES.length], stack, isBot: true, profile, cards: [], bet: 0, totalBet: 0, folded: false, allIn: false, out: false, showCards: false }), [])

  const start = useCallback((cfg: SessionConfig) => {
    const profiles = tableProfiles(cfg.players - 1, Math.random, cfg.mode === 'chipleader' ? 'bully' : undefined)
    const hero = (stack: number) => ({ id: 0, name: store.settings.name || 'Toi', stack, isBot: false })
    const bots = (stacks: number[]) => stacks.map((st, i) => ({ id: i + 1, name: BOT_NAMES[i], stack: st, isBot: true, profile: profiles[i] }))
    let tournament: Tournament | null = null
    let players
    let blinds = { sb: 10, bb: 20, ante: 0 }
    if (cfg.mode === 'cash') {
      players = [hero(cfg.stack), ...bots(Array(cfg.players - 1).fill(cfg.stack))]
    } else if (cfg.mode === 'sng') {
      tournament = createTournament('sng', cfg.structureId, cfg.players, { buyIn: 100, startStack: cfg.stack, reentryUntilLevel: cfg.reentryUntilLevel ?? 0 })
      blinds = blindsFor(tournament)
      players = [hero(cfg.stack), ...bots(Array(cfg.players - 1).fill(cfg.stack))]
    } else if (cfg.mode === 'headsup') {
      tournament = createTournament('headsup', cfg.structureId || 'turbo', 2, { buyIn: 100, startStack: cfg.stack })
      blinds = blindsFor(tournament)
      players = [hero(cfg.stack), ...bots([cfg.stack])]
    } else if (cfg.mode === 'express') {
      tournament = createTournament('express', 'hyper', cfg.players, { buyIn: 100, startStack: cfg.stack })
      blinds = blindsFor(tournament)
      players = [hero(cfg.stack), ...bots(Array(cfg.players - 1).fill(cfg.stack))]
    } else if (cfg.mode === 'marathon') {
      tournament = createTournament('marathon', cfg.structureId, cfg.players, { buyIn: 100, entrants: cfg.entrants ?? 60, startStack: cfg.stack, reentryUntilLevel: cfg.reentryUntilLevel ?? 4 })
      blinds = blindsFor(tournament)
      players = [hero(cfg.stack), ...bots(Array(cfg.players - 1).fill(cfg.stack))]
    } else {
      tournament = createTournament('chipleader', cfg.structureId, cfg.players, { buyIn: 100, entrants: 12, startLevel: 6 })
      blinds = blindsFor(tournament)
      const st = chipLeaderStacks(blinds.bb, cfg.players)
      players = [hero(st.hero), ...bots(st.others)]
    }
    let g = createGame(players, blinds)
    if (tournament) tournament = resume(tournament)
    g = startHand(g)
    beforeRef.current = g
    actingSince.current = Date.now()
    setSaved(null)
    setSession({
      mode: cfg.mode, config: cfg, state: g, tournament, records: [], decisions: [], over: false, result: null,
      paused: false, pauseReason: null, lastPauseAtMs: 0, playStartedAt: Date.now(), playedMs: 0, botsSeated: cfg.players - 1, events: [], canReenter: false, notes: {},
    })
  }, [store.settings.name])

  const setNote = useCallback((playerId: number, note: PlayerNote) => {
    setSession((sess) => {
      if (!sess) return sess
      const p = sess.state.players.find((x) => x.id === playerId)
      if (!p || !p.isBot) return sess
      return { ...sess, notes: { ...sess.notes, [playerId]: { ...sess.notes[playerId], ...note, name: p.name, profile: p.profile } } }
    })
  }, [])

  const resumeSaved = useCallback(() => {
    const s = saved
    if (!s) return
    const now = Date.now()
    beforeRef.current = s.state
    actingSince.current = now
    setSaved(null)
    setSession({ ...s, notes: s.notes ?? {}, paused: false, pauseReason: null, playStartedAt: now, tournament: s.tournament ? resume(s.tournament, now) : null })
  }, [saved])

  const discardSaved = useCallback(() => { setSaved(null); try { localStorage.removeItem(SESSION_KEY) } catch { /* ignore */ } }, [])

  const finishHand = useCallback((sess: Session, after: GameState): Session => {
    const before = beforeRef.current ?? after
    const position = positionOf(before, HERO)
    const rec = buildRecord(before, after, HERO, sess.mode === 'cash' || sess.mode === 'chipleader' ? sess.mode : 'sng', position)
    let tournament = sess.tournament
    let over = false
    let result: TournamentResult | null = null
    let canReenter = false
    if (tournament) {
      tournament = tournament.mode === 'marathon' ? registerMarathonBusts(tournament, after, HERO) : registerEliminations(tournament, after, HERO)
      const heroOut = after.players[HERO].out
      const done = tournament.mode === 'marathon' ? heroOut || tournament.field <= 1 : heroOut || isTournamentOver(after)
      if (done) {
        canReenter = heroOut && (tournament.mode === 'marathon' || tournament.mode === 'sng') && currentLevelIndex(tournament) < (tournament.reentryUntilLevel ?? 0) && storeRef.current.bankroll >= 100
        tournament = pause(tournament)
        over = true
        const place = tournament.heroPlace
        const prize = place ? prizeFor(tournament, place) : 0
        result = { ts: Date.now(), mode: tournament.mode, place, entrants: tournament.entrants, paid: prize > 0, prize, structure: tournament.structureId, checkin: sess.config.checkin, minutes: Math.round(playedMs(sess) / 60000) }
      }
    }
    return { ...sess, state: after, tournament, records: [...sess.records, rec], over, result, canReenter }
  }, [])

  const act = useCallback((a: Action) => {
    setSession((sess) => {
      if (!sess || sess.paused || isHandOver(sess.state) || sess.state.acting !== HERO) return sess
      const st = sess.state
      let mistake = false
      try {
        const adv = advise(st, HERO, Math.random, { icmPressure: icmPressure(sess) })
        if (adv) {
          const aggressive = a.type === 'bet' || a.type === 'raise' || a.type === 'allin'
          const passive = a.type === 'call' || a.type === 'check'
          if (adv.action === 'fold' && (aggressive || a.type === 'call')) mistake = true
          if ((adv.action === 'call' || adv.action === 'raise' || adv.action === 'bet' || adv.action === 'allin') && a.type === 'fold') mistake = true
          if (adv.action === 'check' && aggressive && adv.equity < 0.35) mistake = true
          if (adv.action === 'allin' && passive && st.street === 'preflop') mistake = true
        }
      } catch { /* ignore */ }
      const ms = Date.now() - actingSince.current
      const d: Decision = { t: playedMs(sess), ms, mistake, hand: st.handNumber }
      const after = applyAction(st, a)
      const next = { ...sess, decisions: [...sess.decisions, d] }
      return isHandOver(after) ? finishHand(next, after) : { ...next, state: after }
    })
  }, [finishHand])

  /** Marathon life between hands: other tables bust players, seats refill, occasional table change. */
  const marathonTick = useCallback((sess: Session, g: GameState, t: Tournament): { g: GameState; t: Tournament; events: Session['events']; botsSeated: number } => {
    const events = sess.events.slice()
    let botsSeated = sess.botsSeated
    const now = Date.now()
    const alive = g.players.filter((p) => !p.out)
    // continuous eliminations elsewhere
    const expected = Math.max(alive.length, Math.round(expectedField(t, now) + (Math.random() - 0.5)))
    if (expected < t.field) {
      const busts = Math.min(t.field - expected, 3)
      for (let i = 0; i < busts; i++) {
        const name = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)]
        const table = 1 + Math.floor(Math.random() * Math.max(2, Math.ceil(t.field / t.tableSize)))
        events.push({ t: now, text: `${name} éliminé${Math.random() < 0.5 ? '' : 'e'} à la table ${table === t.tableNumber ? table + 1 : table}` })
      }
      t = { ...t, field: t.field - busts }
    }
    // table change: when the table got short and the field is still large
    let players = g.players.slice()
    const tableAlive = players.filter((p) => !p.out)
    if (t.field > t.tableSize * 2 && tableAlive.length <= t.tableSize - 3 && Math.random() < 0.7) {
      const heroP = players[HERO]
      const newN = Math.min(t.tableSize, t.field) - 1
      const avg = outsideAverageStack(t, g)
      const profiles = tableProfiles(newN)
      const fresh: Player[] = []
      for (let i = 0; i < newN; i++) {
        const k = Math.random()
        const stack = Math.round(avg * (k < 0.15 ? 0.3 + Math.random() * 0.4 : k < 0.75 ? 0.7 + Math.random() * 0.8 : 1.5 + Math.random() * 1.8) / 25) * 25
        botsSeated++
        fresh.push(mkBot(1000 + botsSeated, botsSeated, Math.max(5 * g.blinds.bb, stack), profiles[i]))
      }
      players = [heroP, ...fresh]
      t = { ...t, tableNumber: (t.tableNumber ?? 1) + 1 }
      events.push({ t: now, text: `Changement de table : tu passes à la table ${t.tableNumber} avec ${newN} nouveaux adversaires` })
      g = { ...g, players, dealer: -1, log: [...g.log, `— Tu changes de table (table ${t.tableNumber})`] }
    } else {
      // refill empty seats
      let aliveCount = tableAlive.length
      while (aliveCount < t.tableSize && t.field > aliveCount) {
        const stack = outsideAverageStack(t, { ...g, players })
        const k = Math.random()
        const st = Math.round(stack * (k < 0.2 ? 0.5 : k < 0.8 ? 1 : 1.6) / 25) * 25
        botsSeated++
        const b = mkBot(1000 + botsSeated, botsSeated, Math.max(5 * g.blinds.bb, st), tableProfiles(1, Math.random)[0])
        players.push(b)
        aliveCount++
        events.push({ t: now, text: `${b.name} rejoint ta table avec ${b.stack} jetons` })
        g = { ...g, players, log: [...g.log, `${b.name} rejoint la table (${b.stack} jetons)`] }
      }
      g = { ...g, players: g.players.filter((p, i) => i === HERO || !p.out) }
    }
    return { g, t, events: events.slice(-40), botsSeated }
  }, [mkBot])

  const nextHand = useCallback(() => {
    setSession((sess) => {
      if (!sess || sess.over || sess.paused) return sess
      let g = sess.state
      let t = sess.tournament
      let events = sess.events
      let botsSeated = sess.botsSeated
      if (t) {
        g = { ...g, blinds: blindsFor(t) }
        if (t.mode === 'marathon') { const r = marathonTick(sess, g, t); g = r.g; t = r.t; events = r.events; botsSeated = r.botsSeated }
      }
      g = startHand(g)
      beforeRef.current = g
      actingSince.current = Date.now()
      return { ...sess, state: g, tournament: t, events, botsSeated }
    })
  }, [marathonTick])

  const doReenter = useCallback(() => {
    setSession((sess) => {
      if (!sess || !sess.tournament || !sess.canReenter) return sess
      let t = reenter(sess.tournament, HERO)
      t = resume(t)
      const stack = t.startStack
      const players = sess.state.players.map((p, i) => (i === HERO ? { ...p, stack, out: false, folded: false, allIn: false } : p))
      let g: GameState = { ...sess.state, players, street: 'idle', result: null }
      if (t.mode === 'marathon') { const r = marathonTick({ ...sess, tournament: t }, g, t); g = r.g; t = r.t }
      g = startHand({ ...g, blinds: blindsFor(t) })
      beforeRef.current = g
      actingSince.current = Date.now()
      updateStore((s) => ({ ...s, bankroll: s.bankroll - 100 }))
      ;(sess as any)._saved = false
      return { ...sess, state: g, tournament: t, over: false, result: null, canReenter: false, events: [...sess.events, { t: Date.now(), text: `Re-entry n°${t.reentries} : nouveau tapis de ${stack}` }] }
    })
  }, [marathonTick, updateStore])

  const setPaused = useCallback((paused: boolean, reason: Session['pauseReason'] = 'manual') => {
    setSession((sess) => {
      if (!sess || sess.paused === paused) return sess
      const now = Date.now()
      if (paused) return { ...sess, paused: true, pauseReason: reason, playedMs: sess.playedMs + now - sess.playStartedAt, tournament: sess.tournament ? pause(sess.tournament, now) : null }
      actingSince.current = now
      return { ...sess, paused: false, pauseReason: null, playStartedAt: now, lastPauseAtMs: sess.playedMs, tournament: sess.tournament && !sess.over ? resume(sess.tournament, now) : sess.tournament }
    })
  }, [])

  useEffect(() => {
    if (session && session.state.acting === HERO && !isHandOver(session.state)) actingSince.current = Date.now()
  }, [session?.state.acting, session?.state.street, session?.state.handNumber, session])

  // persist finished hands + tournament results
  const persistedCount = useRef(0)
  useEffect(() => {
    if (!session) { persistedCount.current = 0; return }
    if (session.records.length < persistedCount.current) persistedCount.current = 0
    if (session.records.length > persistedCount.current) {
      const fresh = session.records.slice(persistedCount.current)
      persistedCount.current = session.records.length
      updateStore((s) => ({ ...s, hands: [...s.hands, ...fresh] }))
    }
    if (session.over && session.result && !(session as any)._saved) {
      const r = session.result
      ;(session as any)._saved = true
      updateStore((s) => ({ ...s, tournaments: [...s.tournaments, r], bankroll: s.bankroll - 100 + r.prize }))
    }
  }, [session, updateStore])

  // bot turns
  useEffect(() => {
    if (!session || session.over || session.paused) return
    const s = session.state
    if (isHandOver(s) || s.acting < 0 || !s.players[s.acting].isBot) return
    const speed = session.config.botSpeed ?? 1
    const model = heroModel([...storeRef.current.hands, ...session.records], HERO)
    const decision = botDecideFull(s, Math.random, model, { icmPressure: icmPressure(session) })
    timer.current = window.setTimeout(() => {
      setSession((sess) => {
        if (!sess || sess.paused) return sess
        const st = sess.state
        if (st !== s) return sess
        const after = applyAction(st, decision.action)
        return isHandOver(after) ? finishHand(sess, after) : { ...sess, state: after }
      })
    }, decision.thinkMs / speed)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [session, finishHand])

  const quit = useCallback(() => {
    const sess = session
    setSession(null)
    try { localStorage.removeItem(SESSION_KEY) } catch { /* ignore */ }
    if (!sess) return null
    const minutes = Math.round(playedMs(sess) / 60000)
    const buckets: Record<number, { n: number; errors: number; ms: number }> = {}
    for (const d of sess.decisions) {
      const b = Math.floor(d.t / (30 * 60000))
      const x = (buckets[b] ??= { n: 0, errors: 0, ms: 0 })
      x.n++; x.errors += d.mistake ? 1 : 0; x.ms += d.ms
    }
    const summary = {
      ts: Date.now(), mode: sess.mode, minutes, hands: sess.records.length,
      net: sess.records.reduce((a, r) => a + r.heroDelta, 0),
      place: sess.result?.place ?? null, entrants: sess.tournament?.entrants ?? null,
      checkin: sess.config.checkin ?? null,
      lucidity: Object.entries(buckets).map(([b, x]) => ({ bucket: Number(b), n: x.n, errors: x.errors, avgMs: Math.round(x.ms / x.n) })),
      decisions: sess.decisions.length,
      errors: sess.decisions.filter((d) => d.mistake).length,
      bots: sess.state.players.filter((p) => p.isBot).map((p) => ({ name: p.name, profile: p.profile! })),
    }
    if (sess.records.length >= 5 || minutes >= 5) updateStore((s) => ({ ...s, sessions: [...s.sessions, summary].slice(-200) }))
    const reads = scoreNotes(sess.notes ?? {})
    if (reads.total) updateStore((s) => ({ ...s, reads: { right: s.reads.right + reads.right, total: s.reads.total + reads.total }, xp: s.xp + reads.right * 20 }))
    return summary
  }, [session, updateStore])

  /** Leave the table but keep the game saved for later. */
  const leaveForLater = useCallback(() => {
    if (!session) return
    saveSession(session)
    setSaved(loadSaved())
    setSession(null)
  }, [session])

  return { store, updateStore, session, saved, setNote, start, resumeSaved, discardSaved, leaveForLater, act, nextHand, quit, setPaused, doReenter, elapsedTournament: session?.tournament ? elapsed(session.tournament) : 0 }
}

const TAG_FITS: Record<NoteTag, BotProfile[]> = {
  serre: ['nit', 'rock', 'shortstack'],
  solide: ['tag', 'tilter', 'shortstack'],
  agressif: ['lag', 'maniac', 'bully', 'tilter'],
  bluffeur: ['bluffer', 'maniac', 'lag'],
  station: ['station', 'fish'],
  piegeur: ['trapper', 'rock'],
}
export const TAG_LABEL: Record<NoteTag, string> = { serre: 'Serré', solide: 'Solide', agressif: 'Agressif', bluffeur: 'Bluffeur', station: 'Calling station', piegeur: 'Piégeur' }

export function noteIsRight(tag: NoteTag | undefined, profile: BotProfile | undefined): boolean | null {
  if (!tag || !profile) return null
  return TAG_FITS[tag].includes(profile)
}

export function scoreNotes(notes: Session['notes']): { right: number; total: number } {
  let right = 0, total = 0
  for (const n of Object.values(notes)) { const r = noteIsRight(n.tag, n.profile); if (r === null) continue; total++; if (r) right++ }
  return { right, total }
}

/** 0..1 tournament pressure: high on the bubble, medium at the final table / in the money. */
export function icmPressure(sess: Session): number {
  const t = sess.tournament
  if (!t || t.mode === 'headsup') return 0
  const paid = t.payouts.length
  const left = t.mode === 'marathon' ? t.field : sess.state.players.filter((p) => !p.out).length
  if (left <= 1) return 0
  if (left <= paid) return 0.6
  if (left <= Math.ceil(paid * 1.4)) return 1
  if (left <= paid * 2) return 0.4
  return 0
}
