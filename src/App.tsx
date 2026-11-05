import { useEffect, useMemo, useState } from 'react'
import { HERO, PAUSE_EVERY_MS, TAG_LABEL, icmPressure, noteIsRight, playedMs, useSession, type Mode } from './hooks/useSession'
import { advise, positionOf } from './engine/coach'
import { isHandOver } from './engine/game'
import { computeStats } from './engine/stats'
import { Home } from './components/Home'
import { Setup } from './components/Setup'
import { Hud } from './components/Hud'
import { Table } from './components/Table'
import { Controls } from './components/Controls'
import { CoachPanel } from './components/Coach'
import { History } from './components/History'
import { StatsScreen } from './components/Stats'
import { Training } from './components/Training'
import { Learn } from './components/Learn'
import { Drill } from './components/Drill'
import { JournalModal, PauseOverlay, detectAlerts } from './components/Mental'
import { dailySession, proSession, DRILL_META, type DrillType, type Question } from './engine/drills'
import type { HandRecord } from './engine/stats'
import { Replay } from './components/Replay'
import { keyHands, type KeyHand } from './engine/keyhands'
import { Leaks } from './components/Leaks'
import { IcmTool } from './components/IcmTool'
import { Challenges } from './components/Challenges'
import { NoteSheet } from './components/NoteSheet'
import { recordAnswer, recordPuzzle, type SessionSummary } from './store'
import { HandBar } from './components/HandBar'
import { PuzzleScreen } from './components/Puzzle'
import { PERSONALITIES } from './engine/bots'
import { haptic, setSoundEnabled } from './fx/sound'

type Screen = 'home' | 'setup' | 'history' | 'stats' | 'training' | 'learn' | 'drill' | 'drill-result' | 'journal' | 'puzzle' | 'replay' | 'leaks' | 'icm' | 'challenges'

export default function App() {
  const { store, updateStore, session, saved, setNote, start, resumeSaved, discardSaved, leaveForLater, act, nextHand, quit, setPaused, doReenter } = useSession()
  const [quitMenu, setQuitMenu] = useState(false)
  const [replayHand, setReplayHand] = useState<HandRecord | null>(null)
  const [replayBack, setReplayBack] = useState<Screen>('history')
  const [journalKeys, setJournalKeys] = useState<KeyHand[]>([])
  const [noteFor, setNoteFor] = useState<number | null>(null)
  const [challengesBack, setChallengesBack] = useState<Screen>('home')
  const [screen, setScreen] = useState<Screen>('home')
  const [mode, setMode] = useState<Mode>('cash')
  const [showLog, setShowLog] = useState(false)
  const [drill, setDrill] = useState<{ questions: Question[] | null; type?: DrillType; title: string; back: Screen }>({ questions: null, title: '', back: 'training' })
  const [drillResult, setDrillResult] = useState({ asked: 0, correct: 0 })
  const [journalFor, setJournalFor] = useState<SessionSummary | null>(null)
  const [dismissedAlert, setDismissedAlert] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const coach = store.settings.coach
  useEffect(() => { setSoundEnabled(store.settings.sound !== false) }, [store.settings.sound])
  const setCoach = (v: boolean) => updateStore((s) => ({ ...s, settings: { ...s.settings, coach: v } }))
  const startDrill = (t: DrillType, back: Screen = 'training') => { setDrill({ questions: null, type: t, title: DRILL_META[t].name, back }); setScreen('drill') }
  const startPro = () => { setDrill({ questions: proSession(), title: 'Spots de pros', back: 'training' }); setScreen('drill') }
  const startDaily = () => { setDrill({ questions: dailySession(), title: 'Séance du jour', back: 'training' }); setScreen('drill') }

  const s = session?.state
  const heroTurn = !!s && s.acting === HERO && !isHandOver(s)
  const advice = useMemo(() => (s && heroTurn && coach && !session?.paused ? advise(s, HERO, Math.random, { icmPressure: icmPressure(session!) }) : null), [s, heroTurn, coach, session?.paused])

  useEffect(() => {
    if (!session) return
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [session])
  void tick

  const played = session ? playedMs(session) : 0
  const baselineVpip = useMemo(() => (store.hands.length >= 30 ? computeStats(store.hands, HERO).vpip : 0.25), [store.hands])
  const alert = useMemo(() => (session && !session.over && !session.paused ? detectAlerts(session, baselineVpip, played) : null), [session, baselineVpip, played])

  useEffect(() => {
    if (!session || session.over || session.paused || session.mode === 'cash') return
    if (!isHandOver(session.state)) return
    if (played - session.lastPauseAtMs >= PAUSE_EVERY_MS) setPaused(true, 'hourly')
  }, [session, played, setPaused])

  const autoNext = store.settings.autoNext !== false
  const handDone = !!session && isHandOver(session.state)
  const heroShowdown = !!session && !!session.state.result && Object.keys(session.state.result.revealed).length > 1 && !session.state.players[HERO].folded
  const heroWon = !!session && !!session.state.result?.winners.some((w) => w.playerId === HERO)
  const aliveCount = session ? session.state.players.filter((p) => !p.out).length : 0
  const autoNextMs = autoNext && handDone && aliveCount >= 2 && session && !session.over && !session.paused && !quitMenu ? (heroShowdown ? 3600 : heroWon ? 2200 : 1700) : null
  useEffect(() => {
    if (!autoNextMs) return
    const id = setTimeout(() => nextHand(), autoNextMs)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoNextMs, session?.state.handNumber])

  const endSession = () => {
    const keys = session ? keyHands(session.records, session.decisions) : []
    const summary = quit()
    setJournalKeys(keys)
    setShowLog(false)
    if (summary && (summary.hands >= 10 || summary.minutes >= 15)) { setJournalFor(summary); setScreen('journal') }
    else setScreen('home')
  }

  if (!session) {
    if (screen === 'journal' && journalFor) {
      return <div className="app"><JournalModal mode={journalFor.mode} minutes={journalFor.minutes} place={journalFor.place} net={journalFor.net} checkin={journalFor.checkin} keys={journalKeys} onReplay={(h) => { setReplayHand(h); setReplayBack('journal'); setScreen('replay') }}
        onSave={(e) => { updateStore((st) => ({ ...st, journal: [...st.journal, { ...e, ts: Date.now() }], xp: st.xp + 40 })); setJournalFor(null); setScreen('home') }}
        onSkip={() => { setJournalFor(null); setScreen('home') }} /></div>
    }
    if (screen === 'setup') return <div className="app"><Setup mode={mode} onStart={(c) => { start(c); setScreen('home'); setDismissedAlert(null) }} onBack={() => setScreen('home')} coach={coach} setCoach={setCoach} /></div>
    if (screen === 'history') return <div className="app"><History hands={store.hands} journal={store.journal} onBack={() => setScreen('home')} onReplay={(h) => { setReplayHand(h); setReplayBack('history'); setScreen('replay') }} /></div>
    if (screen === 'replay' && replayHand) return <div className="app"><Replay hand={replayHand} onBack={() => setScreen(replayBack)} /></div>
    if (screen === 'leaks') return <div className="app"><Leaks store={store} onDrill={(t) => startDrill(t, 'leaks')} onBack={() => setScreen('training')} /></div>
    if (screen === 'icm') return <div className="app"><IcmTool onBack={() => setScreen('training')} /></div>
    if (screen === 'challenges') return <div className="app"><Challenges store={store} onBack={() => setScreen(challengesBack)} onClaim={(key, xp) => updateStore((st) => (st.claimed.includes(key) ? st : { ...st, claimed: [...st.claimed, key].slice(-60), xp: st.xp + xp }))} /></div>
    if (screen === 'stats') return <div className="app"><StatsScreen store={store} onBack={() => setScreen('home')} /></div>
    if (screen === 'training') return <div className="app"><Training store={store} onDaily={startDaily} onDrill={(t) => startDrill(t)} onLearn={() => setScreen('learn')} onBack={() => setScreen('home')} onMarathon={() => { setMode('marathon'); setScreen('setup') }} onPuzzle={() => setScreen('puzzle')} onPro={startPro} onLeaks={() => setScreen('leaks')} onIcm={() => setScreen('icm')} onChallenges={() => { setChallengesBack('training'); setScreen('challenges') }} /></div>
    if (screen === 'puzzle') return <div className="app"><PuzzleScreen store={store} onResult={(ok) => updateStore((st) => recordPuzzle(st, ok))} onBack={() => setScreen('training')} /></div>
    if (screen === 'learn') return <div className="app"><Learn store={store} onRead={(id) => updateStore((st) => st.lessonsRead.includes(id) ? st : { ...st, lessonsRead: [...st.lessonsRead, id], xp: st.xp + 30 })} onDrill={(t) => startDrill(t, 'learn')} onBack={() => setScreen('training')} /></div>
    if (screen === 'drill') return <div className="app"><Drill key={drill.title + (drill.type ?? '')} questions={drill.questions} type={drill.type} title={drill.title} onAnswer={(t, ok, ms) => updateStore((st) => recordAnswer(st, t, ok, ms))} onExit={(sum) => { setDrillResult(sum); setScreen(sum.asked > 0 ? 'drill-result' : drill.back) }} /></div>
    if (screen === 'drill-result') {
      const pct = drillResult.asked ? Math.round((drillResult.correct / drillResult.asked) * 100) : 0
      return (
        <div className="app"><div className="overlay" style={{ position: 'relative', flex: 1, background: 'transparent' }}>
          <div className="modal">
            <h2>{pct >= 80 ? 'Solide.' : pct >= 60 ? 'Pas mal.' : 'À retravailler.'}</h2>
            <div className="place">{pct} %</div>
            <p>{drillResult.correct} bonne{drillResult.correct > 1 ? 's' : ''} réponse{drillResult.correct > 1 ? 's' : ''} sur {drillResult.asked} · +{drillResult.correct * 10 + (drillResult.asked - drillResult.correct) * 2} XP</p>
            <p>{pct >= 80 ? 'Tu peux passer au drill suivant ou augmenter la difficulté en jouant un tournoi coach désactivé.' : 'Relis la fiche de cours associée, puis refais une série : la répétition espacée fait le reste.'}</p>
            <button className="primary" onClick={() => setScreen(drill.back)}>Continuer</button>
          </div>
        </div></div>
      )
    }
    const savedInfo = saved ? { mode: saved.mode, hands: saved.records.length, minutes: Math.round(saved.playedMs / 60000), stack: saved.state.players[HERO].stack, bb: saved.state.blinds.bb } : null
    return <div className="app"><Home store={store} tab="home" onPick={(m) => { setMode(m); setScreen('setup') }} onNav={(t) => setScreen(t)} onTrain={() => setScreen('training')} saved={savedInfo} onResume={resumeSaved} onDiscard={discardSaved} onChallenges={() => { setChallengesBack('home'); setScreen('challenges') }} /></div>
  }

  const st = session.state
  const hero = st.players[HERO]
  const r = session.result
  const sessionNet = session.records.reduce((a, h) => a + h.heroDelta, 0)
  const showAlert = alert && dismissedAlert !== alert.kind + session.records.length

  return (
    <div className="app">
      <div className="game">
        <Hud state={st} tournament={session.tournament} mode={session.mode} heroIdx={HERO} showLog={showLog} onToggleLog={() => setShowLog((v) => !v)} coach={coach} onToggleCoach={() => setCoach(!coach)} onQuit={() => setQuitMenu(true)} playedMs={played} onPause={() => setPaused(true, 'manual')} events={session.events} sound={store.settings.sound !== false} onToggleSound={() => updateStore((st) => ({ ...st, settings: { ...st.settings, sound: !(st.settings.sound !== false) } }))} autoNext={autoNext} onToggleAutoNext={() => updateStore((st) => ({ ...st, settings: { ...st.settings, autoNext: !(st.settings.autoNext !== false) } }))} />
        <Table state={st} heroIdx={HERO} showLog={showLog} tournament={!!session.tournament} notes={session.notes} noteLabel={(tag, text) => (tag ? TAG_LABEL[tag as keyof typeof TAG_LABEL] : text ? '📝' : undefined)} onSeatClick={(id) => setNoteFor(id)} />
        {noteFor !== null && (() => { const p = st.players.find((x) => x.id === noteFor); return p ? <NoteSheet name={p.name} note={session.notes[noteFor]} onSave={(n) => setNote(noteFor, n)} onClose={() => setNoteFor(null)} /> : null })()}
        {session.paused && !session.over && <PauseOverlay reason={session.pauseReason} state={st} heroIdx={HERO} onResume={() => setPaused(false)} />}
        {session.over && (
          <div className="overlay">
            <div className="modal">
              <h2>{r?.place === 1 ? 'Victoire !' : hero.out ? 'Éliminé' : 'Tournoi terminé'}</h2>
              {r?.place && <div className="place">{r.place}{r.place === 1 ? 'er' : 'e'}</div>}
              <p>{r?.paid ? `Dans les places payées : +${r.prize} ₵ pour ${r.entrants} inscrits.` : `Hors des places payées (${r?.entrants} inscrits).`}</p>
              <div className="grid">
                <div className="cell"><div className="v">{session.records.length}</div><div className="l">mains jouées</div></div>
                <div className="cell"><div className="v">{Math.round(played / 60000)} min</div><div className="l">de jeu</div></div>
                <div className="cell"><div className="v">{session.records.filter((h) => h.heroWon).length}</div><div className="l">mains gagnées</div></div>
                <div className="cell"><div className="v">{session.decisions.length ? `${Math.round((1 - session.decisions.filter((d) => d.mistake).length / session.decisions.length) * 100)} %` : '—'}</div><div className="l">décisions alignées avec le coach</div></div>
              </div>
              {session.canReenter && <button className="primary" onClick={doReenter}>Re-entry · 100 ₵ (bankroll {store.bankroll})</button>}
              <button className={session.canReenter ? 'ghost' : 'primary'} onClick={endSession}>{session.canReenter ? 'Non, j\'arrête là' : 'Continuer'}</button>
              <div className="reveal">
                <div className="l" style={{ marginBottom: 6 }}>Qui étaient tes adversaires</div>
                {st.players.filter((p) => p.isBot).slice(0, 8).map((p) => {
                  const n = session.notes[p.id]
                  const r = noteIsRight(n?.tag, p.profile)
                  return <div key={p.id} className="reveal-row"><b>{p.name}</b> · {PERSONALITIES[p.profile!].label}{n?.tag ? <em className={r ? 'ok' : 'ko'}> · ta lecture : {TAG_LABEL[n.tag]} {r ? '✓' : '✗'}</em> : null} — <span>{PERSONALITIES[p.profile!].tell}</span></div>
                })}
              </div>
            </div>
          </div>
        )}
        {quitMenu && (
          <div className="overlay" onClick={() => setQuitMenu(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h2>Quitter la table ?</h2>
              <p>Tu peux mettre la partie de côté et la reprendre plus tard depuis l'accueil (horloge en pause), ou la terminer maintenant.</p>
              <button className="primary" onClick={() => { setQuitMenu(false); leaveForLater(); setScreen('home') }}>Sauvegarder et reprendre plus tard</button>
              <button className="ghost" onClick={() => { setQuitMenu(false); endSession() }}>Terminer la session</button>
              <button className="ghost" onClick={() => setQuitMenu(false)}>Rester à table</button>
            </div>
          </div>
        )}
        {showAlert && alert && (
          <div className={'alert ' + alert.kind}>
            <div className="alert-t">{alert.kind === 'tilt' ? '⚠' : '◔'} {alert.title}</div>
            <div className="alert-x">{alert.text}</div>
            <div className="row">
              <button className="ghost" onClick={() => setDismissedAlert(alert.kind + session.records.length)}>Je continue</button>
              <button className="ghost on" onClick={() => { setDismissedAlert(alert.kind + session.records.length); setPaused(true, 'fatigue') }}>Pause 5 min</button>
            </div>
          </div>
        )}
        {!session.over && session.mode === 'cash' && isHandOver(st) ? <div className="hint" style={{ padding: '4px 0 0' }}>Session : {sessionNet >= 0 ? '+' : ''}{sessionNet} jetons sur {session.records.length} mains · {Math.round(played / 60000)} min</div> : null}
        <HandBar state={st} heroIdx={HERO} />
        {advice && <CoachPanel advice={advice} position={positionOf(st, HERO)} />}
        <Controls state={st} heroIdx={HERO} onAction={(a) => { haptic(); act(a) }} onNext={nextHand} advice={advice} over={session.over || session.paused} autoNextMs={autoNextMs} />
      </div>
    </div>
  )
}
