import { useCallback, useEffect, useRef, useState } from 'react'
import { applyAction, createGame, isHandOver, startHand, type Action, type BotProfile, type GameState, type Player } from '../engine/game'
import { botDecide } from '../engine/bots'
import { advise, positionOf } from '../engine/coach'
import { buildRecord, heroModel, type HandRecord } from '../engine/stats'
import { blindsFor, chipLeaderStacks, createTournament, currentLevelIndex, elapsed, isTournamentOver, outsideAverageStack, pause, prizeFor, registerEliminations, registerMarathonBusts, resume, targetField, type Tournament } from '../engine/tournament'
import { loadStore, saveStore, type CheckIn, type Decision, type Store, type TournamentResult } from '../store'

export const HERO = 0
export type Mode = 'cash' | 'sng' | 'chipleader' | 'marathon'

export interface SessionConfig {
  mode: Mode
  players: number
  stack: number
  structureId: string
  botSpeed: number
  checkin?: CheckIn
}

const BOT_NAMES = ['Léo', 'Marco', 'Sofia', 'Nina', 'Tom', 'Ava', 'Hugo', 'Emma', 'Lucas', 'Inès', 'Noah', 'Jade', 'Gabriel', 'Chloé', 'Raph', 'Lina', 'Adam', 'Zoé', 'Louis', 'Manon']
const PROFILES: BotProfile[] = ['tight', 'aggressive', 'loose', 'station', 'bully', 'bluffer', 'tight']
const CHIPLEADER_PROFILES: BotProfile[] = ['bully', 'aggressive', 'tight', 'station', 'bluffer', 'loose', 'tight']

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
  lastPauseAtMs: number // playing time at last pause
  playStartedAt: number
  playedMs: number // accumulated playing time (excluding pauses)
  botsSeated: number
}

export const PAUSE_EVERY_MS = 60 * 60 * 1000

export function playedMs(s: Session, now = Date.now()): number {
  return s.playedMs + (s.paused ? 0 : now - s.playStartedAt)
}

export function useSession() {
  const [store, setStore] = useState<Store>(() => loadStore())
  const [session, setSession] = useState<Session | null>(null)
  const beforeRef = useRef<GameState | null>(null)
  const timer = useRef<number | null>(null)
  const storeRef = useRef(store)
  storeRef.current = store
  const actingSince = useRef<number>(0)

  useEffect(() => saveStore(store), [store])
  const updateStore = useCallback((fn: (s: Store) => Store) => setStore((s) => fn(s)), [])

  const start = useCallback((cfg: SessionConfig) => {
    const mk = (i: number, stack: number): Omit<Player, 'cards' | 'bet' | 'totalBet' | 'folded' | 'allIn' | 'out' | 'showCards'> => (i === 0
      ? { id: 0, name: store.settings.name || 'Toi', stack, isBot: false }
      : { id: i, name: BOT_NAMES[(i - 1) % BOT_NAMES.length], stack, isBot: true, profile: (cfg.mode === 'chipleader' ? CHIPLEADER_PROFILES : PROFILES)[(i - 1) % PROFILES.length] })
    let tournament: Tournament | null = null
    let players
    let blinds = { sb: 10, bb: 20, ante: 0 }
    if (cfg.mode === 'cash') {
      players = Array.from({ length: cfg.players }, (_, i) => mk(i, cfg.stack))
    } else if (cfg.mode === 'sng') {
      tournament = createTournament('sng', cfg.structureId, cfg.players, { buyIn: 100, startStack: cfg.stack })
      blinds = blindsFor(tournament)
      players = Array.from({ length: cfg.players }, (_, i) => mk(i, cfg.stack))
    } else if (cfg.mode === 'marathon') {
      tournament = createTournament('marathon', cfg.structureId, cfg.players, { buyIn: 100, entrants: 60, startStack: cfg.stack })
      blinds = blindsFor(tournament)
      players = Array.from({ length: cfg.players }, (_, i) => mk(i, cfg.stack))
    } else {
      tournament = createTournament('chipleader', cfg.structureId, cfg.players, { buyIn: 100, entrants: 12, startLevel: 6 })
      blinds = blindsFor(tournament)
      const st = chipLeaderStacks(blinds.bb, cfg.players)
      players = [mk(0, st.hero), ...st.others.map((s, i) => mk(i + 1, s))]
    }
    let g = createGame(players, blinds)
    if (tournament) tournament = resume(tournament)
    g = startHand(g)
    beforeRef.current = g
    actingSince.current = Date.now()
    setSession({
      mode: cfg.mode, config: cfg, state: g, tournament, records: [], decisions: [], over: false, result: null,
      paused: false, pauseReason: null, lastPauseAtMs: 0, playStartedAt: Date.now(), playedMs: 0, botsSeated: cfg.players - 1,
    })
  }, [store.settings.name])

  const finishHand = useCallback((sess: Session, after: GameState): Session => {
    const before = beforeRef.current ?? after
    const position = positionOf(before, HERO)
    const rec = buildRecord(before, after, HERO, sess.mode === 'marathon' ? 'sng' : sess.mode, position)
    let tournament = sess.tournament
    let over = false
    let result: TournamentResult | null = null
    if (tournament) {
      tournament = tournament.mode === 'marathon' ? registerMarathonBusts(tournament, after, HERO) : registerEliminations(tournament, after, HERO)
      const heroOut = after.players[HERO].out
      const done = tournament.mode === 'marathon' ? heroOut || tournament.field <= 1 : heroOut || isTournamentOver(after)
      if (done) {
        tournament = pause(tournament)
        over = true
        const place = tournament.heroPlace
        const prize = place ? prizeFor(tournament, place) : 0
        result = { ts: Date.now(), mode: tournament.mode, place, entrants: tournament.entrants, paid: prize > 0, prize, structure: tournament.structureId, checkin: sess.config.checkin, minutes: Math.round(playedMs(sess) / 60000) }
      }
    }
    return { ...sess, state: after, tournament, records: [...sess.records, rec], over, result }
  }, [])

  const act = useCallback((a: Action) => {
    setSession((sess) => {
      if (!sess || sess.paused || isHandOver(sess.state) || sess.state.acting !== HERO) return sess
      const st = sess.state
      // silent coach: was this a clear mistake?
      let mistake = false
      try {
        const adv = advise(st, HERO)
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

  const nextHand = useCallback(() => {
    setSession((sess) => {
      if (!sess || sess.over || sess.paused) return sess
      let g = sess.state
      let t = sess.tournament
      let botsSeated = sess.botsSeated
      if (t) {
        g = { ...g, blinds: blindsFor(t) }
        if (t.mode === 'marathon') {
          // other tables bust players over time
          const alive = g.players.filter((p) => !p.out)
          const li = currentLevelIndex(t)
          const target = targetField(t, li, alive.length)
          if (target < t.field) t = { ...t, field: target }
          // refill empty seats from other tables
          const players = g.players.slice()
          let aliveCount = alive.length
          while (aliveCount < t.tableSize && t.field > aliveCount) {
            const stack = outsideAverageStack(t, { ...g, players })
            const id = Math.max(...players.map((p) => p.id)) + 1
            botsSeated++
            players.push({ id, name: BOT_NAMES[(botsSeated - 1) % BOT_NAMES.length], stack, isBot: true, profile: PROFILES[(botsSeated - 1) % PROFILES.length], cards: [], bet: 0, totalBet: 0, folded: false, allIn: false, out: false, showCards: false })
            aliveCount++
            g = { ...g, players, log: [...g.log, `${players[players.length - 1].name} rejoint la table (${stack} jetons)`] }
          }
          // remove busted bots from the array to keep the table readable (hero stays)
          g = { ...g, players: g.players.filter((p, i) => i === HERO || !p.out) }
        }
      }
      g = startHand(g)
      beforeRef.current = g
      actingSince.current = Date.now()
      return { ...sess, state: g, tournament: t, botsSeated }
    })
  }, [])

  const setPaused = useCallback((paused: boolean, reason: Session['pauseReason'] = 'manual') => {
    setSession((sess) => {
      if (!sess || sess.paused === paused) return sess
      const now = Date.now()
      if (paused) {
        return { ...sess, paused: true, pauseReason: reason, playedMs: sess.playedMs + now - sess.playStartedAt, tournament: sess.tournament ? pause(sess.tournament, now) : null }
      }
      actingSince.current = now
      return { ...sess, paused: false, pauseReason: null, playStartedAt: now, lastPauseAtMs: sess.playedMs, tournament: sess.tournament && !sess.over ? resume(sess.tournament, now) : sess.tournament }
    })
  }, [])

  // track when hero's turn starts
  useEffect(() => {
    if (session && session.state.acting === HERO && !isHandOver(session.state)) actingSince.current = Date.now()
  }, [session?.state.acting, session?.state.street, session?.state.handNumber, session])

  // persist finished hands + tournament results
  const persistedCount = useRef(0)
  useEffect(() => {
    if (!session) { persistedCount.current = 0; return }
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
    timer.current = window.setTimeout(() => {
      setSession((sess) => {
        if (!sess || sess.paused) return sess
        const st = sess.state
        if (isHandOver(st) || st.acting < 0 || !st.players[st.acting].isBot) return sess
        const model = heroModel([...storeRef.current.hands, ...sess.records], HERO)
        const after = applyAction(st, botDecide(st, Math.random, model))
        return isHandOver(after) ? finishHand(sess, after) : { ...sess, state: after }
      })
    }, (500 + Math.random() * 800) / speed)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [session, finishHand])

  /** Ends the session and returns a summary for the journal/persisted session log. */
  const quit = useCallback(() => {
    const sess = session
    setSession(null)
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
    }
    if (sess.records.length >= 5 || minutes >= 5) updateStore((s) => ({ ...s, sessions: [...s.sessions, summary].slice(-200) }))
    return summary
  }, [session, updateStore])

  return { store, updateStore, session, start, act, nextHand, quit, setPaused, elapsedTournament: session?.tournament ? elapsed(session.tournament) : 0 }
}
