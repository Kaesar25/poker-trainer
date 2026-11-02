import { useCallback, useEffect, useRef, useState } from 'react'
import { applyAction, createGame, isHandOver, startHand, type Action, type BotProfile, type GameState } from '../engine/game'
import { botDecide } from '../engine/bots'
import { positionOf } from '../engine/coach'
import { buildRecord, type HandRecord } from '../engine/stats'
import { blindsFor, chipLeaderStacks, createTournament, isTournamentOver, pause, prizeFor, registerEliminations, resume, type Tournament } from '../engine/tournament'
import { loadStore, saveStore, type Store, type TournamentResult } from '../store'

export const HERO = 0
export type Mode = 'cash' | 'sng' | 'chipleader'

export interface SessionConfig {
  mode: Mode
  players: number
  stack: number // cash: chips; sng: starting chips
  structureId: string
  botSpeed: number
}

const BOT_NAMES = ['Léo', 'Marco', 'Sofia', 'Nina', 'Tom', 'Ava', 'Hugo', 'Emma']
const PROFILES: BotProfile[] = ['tight', 'aggressive', 'loose', 'station', 'tight', 'aggressive', 'loose']

export interface Session {
  mode: Mode
  state: GameState
  tournament: Tournament | null
  records: HandRecord[]
  over: boolean
  result: TournamentResult | null
}

export function useSession() {
  const [store, setStore] = useState<Store>(() => loadStore())
  const [session, setSession] = useState<Session | null>(null)
  const beforeRef = useRef<GameState | null>(null)
  const timer = useRef<number | null>(null)
  const configRef = useRef<SessionConfig | null>(null)

  useEffect(() => saveStore(store), [store])

  const updateStore = useCallback((fn: (s: Store) => Store) => setStore((s) => fn(s)), [])

  const start = useCallback((cfg: SessionConfig) => {
    configRef.current = cfg
    const mk = (i: number, stack: number) => (i === 0
      ? { id: 0, name: store.settings.name || 'Toi', stack, isBot: false }
      : { id: i, name: BOT_NAMES[i - 1], stack, isBot: true, profile: PROFILES[(i - 1) % PROFILES.length] })
    let tournament: Tournament | null = null
    let players
    let blinds = { sb: 10, bb: 20, ante: 0 }
    if (cfg.mode === 'cash') {
      players = Array.from({ length: cfg.players }, (_, i) => mk(i, cfg.stack))
    } else if (cfg.mode === 'sng') {
      tournament = createTournament('sng', cfg.structureId, cfg.players, { buyIn: 100 })
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
    setSession({ mode: cfg.mode, state: g, tournament, records: [], over: false, result: null })
  }, [store.settings.name])

  const finishHand = useCallback((sess: Session, after: GameState): Session => {
    const before = beforeRef.current ?? after
    const position = positionOf(before, HERO)
    const rec = buildRecord(before, after, HERO, sess.mode, position)
    let tournament = sess.tournament
    let over = false
    let result: TournamentResult | null = null
    if (tournament) {
      tournament = registerEliminations(tournament, after, HERO)
      const heroOut = after.players[HERO].out
      if (heroOut || isTournamentOver(after)) {
        tournament = pause(tournament)
        over = true
        const place = tournament.heroPlace
        const prize = place ? prizeFor(tournament, place) : 0
        result = { ts: Date.now(), mode: tournament.mode, place, entrants: tournament.entrants, paid: prize > 0, prize, structure: tournament.structureId }
      }
    }
    return { ...sess, state: after, tournament, records: [...sess.records, rec], over, result }
  }, [])

  const act = useCallback((a: Action) => {
    setSession((sess) => {
      if (!sess || isHandOver(sess.state)) return sess
      const after = applyAction(sess.state, a)
      return isHandOver(after) ? finishHand(sess, after) : { ...sess, state: after }
    })
  }, [finishHand])

  const nextHand = useCallback(() => {
    setSession((sess) => {
      if (!sess || sess.over) return sess
      let g = sess.state
      if (sess.tournament) g = { ...g, blinds: blindsFor(sess.tournament) }
      g = startHand(g)
      beforeRef.current = g
      return { ...sess, state: g }
    })
  }, [])

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
    if (!session || session.over) return
    const s = session.state
    if (isHandOver(s) || s.acting < 0 || !s.players[s.acting].isBot) return
    const speed = configRef.current?.botSpeed ?? 1
    timer.current = window.setTimeout(() => {
      setSession((sess) => {
        if (!sess) return sess
        const st = sess.state
        if (isHandOver(st) || st.acting < 0 || !st.players[st.acting].isBot) return sess
        const after = applyAction(st, botDecide(st))
        return isHandOver(after) ? finishHand(sess, after) : { ...sess, state: after }
      })
    }, (500 + Math.random() * 800) / speed)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [session, finishHand])

  const quit = useCallback(() => setSession(null), [])

  return { store, updateStore, session, start, act, nextHand, quit }
}
