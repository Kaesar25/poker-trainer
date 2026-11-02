import { useMemo, useState } from 'react'
import { HERO, useSession, type Mode } from './hooks/useSession'
import { advise, positionOf } from './engine/coach'
import { isHandOver } from './engine/game'
import { Home } from './components/Home'
import { Setup } from './components/Setup'
import { Hud } from './components/Hud'
import { Table } from './components/Table'
import { Controls } from './components/Controls'
import { CoachPanel } from './components/Coach'
import { History } from './components/History'
import { StatsScreen } from './components/Stats'

type Screen = 'home' | 'setup' | 'history' | 'stats'

export default function App() {
  const { store, updateStore, session, start, act, nextHand, quit } = useSession()
  const [screen, setScreen] = useState<Screen>('home')
  const [mode, setMode] = useState<Mode>('cash')
  const [showLog, setShowLog] = useState(false)
  const coach = store.settings.coach
  const setCoach = (v: boolean) => updateStore((s) => ({ ...s, settings: { ...s.settings, coach: v } }))

  const s = session?.state
  const heroTurn = !!s && s.acting === HERO && !isHandOver(s)
  const advice = useMemo(() => (s && heroTurn && coach ? advise(s, HERO) : null), [s, heroTurn, coach])

  if (!session) {
    if (screen === 'setup') return <div className="app"><Setup mode={mode} onStart={(c) => { start(c); setScreen('home') }} onBack={() => setScreen('home')} coach={coach} setCoach={setCoach} /></div>
    if (screen === 'history') return <div className="app"><History hands={store.hands} onBack={() => setScreen('home')} /></div>
    if (screen === 'stats') return <div className="app"><StatsScreen store={store} onBack={() => setScreen('home')} /></div>
    return <div className="app"><Home store={store} tab="home" onPick={(m) => { setMode(m); setScreen('setup') }} onNav={(t) => setScreen(t)} /></div>
  }

  const st = session.state
  const hero = st.players[HERO]
  const r = session.result
  const sessionNet = session.records.reduce((a, h) => a + h.heroDelta, 0)

  return (
    <div className="app">
      <div className="game">
        <Hud state={st} tournament={session.tournament} mode={session.mode} heroIdx={HERO} showLog={showLog} onToggleLog={() => setShowLog((v) => !v)} coach={coach} onToggleCoach={() => setCoach(!coach)} onQuit={quit} />
        <Table state={st} heroIdx={HERO} showLog={showLog} tournament={!!session.tournament}>
        </Table>
        {session.over && (
          <div className="overlay">
            <div className="modal">
              <h2>{r?.place === 1 ? 'Victoire !' : hero.out ? 'Éliminé' : 'Tournoi terminé'}</h2>
              {r?.place && <div className="place">{r.place}{r.place === 1 ? 'er' : 'e'}</div>}
              <p>{r?.paid ? `Dans les places payées : +${r.prize} ₵ pour ${r.entrants} inscrits.` : `Hors des places payées (${r?.entrants} inscrits).`}</p>
              <div className="grid">
                <div className="cell"><div className="v">{session.records.length}</div><div className="l">mains jouées</div></div>
                <div className="cell"><div className="v">{session.records.filter((h) => h.heroWon).length}</div><div className="l">mains gagnées</div></div>
              </div>
              <button className="primary" onClick={quit}>Retour à l'accueil</button>
            </div>
          </div>
        )}
        {!session.over && session.mode === 'cash' && isHandOver(st) ? <div className="hint" style={{ padding: '4px 0 0' }}>Session : {sessionNet >= 0 ? '+' : ''}{sessionNet} jetons sur {session.records.length} mains</div> : null}
        {advice && <CoachPanel advice={advice} position={positionOf(st, HERO)} />}
        <Controls state={st} heroIdx={HERO} onAction={act} onNext={nextHand} advice={advice} over={session.over} />
      </div>
    </div>
  )
}
