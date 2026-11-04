import type { Store } from '../store'
import type { Mode } from '../hooks/useSession'
import { computeStats } from '../engine/stats'
import { levelFor } from '../store'

export function Home({ store, onPick, onNav, onTrain, tab, saved, onResume, onDiscard }: { store: Store; onPick: (m: Mode) => void; onNav: (t: 'home' | 'history' | 'stats') => void; onTrain: () => void; tab: string; saved: { mode: string; hands: number; minutes: number; stack: number; bb: number } | null; onResume: () => void; onDiscard: () => void }) {
  const st = computeStats(store.hands, 0, store.tournaments)
  const lv = levelFor(store.xp)
  const doneToday = store.streak.lastDay === new Date().toISOString().slice(0, 10)
  return (
    <div className="home">
      <div className="brand">
        <span className="spade">♠</span>
        <h1>Poker Trainer</h1>
        <span className="tag">by César</span>
      </div>
      <div className="bankroll">
        <div>
          <div className="lbl">Bankroll fictive</div>
          <div className="big">{store.bankroll.toLocaleString('fr-FR')} ₵</div>
        </div>
        <div className="sep" />
        <div className="kpis">
          <div className="kpi"><div className="v">{st.hands}</div><div className="l">mains</div></div>
          <div className="kpi"><div className="v">{st.tournaments.played}</div><div className="l">tournois</div></div>
          <div className="kpi"><div className="v">{st.tournaments.wins}</div><div className="l">victoires</div></div>
          <div className="kpi"><div className="v">Niv. {lv.level}</div><div className="l">{lv.title}</div></div>
        </div>
      </div>
      {saved && (
        <div className="resume">
          <div className="resume-l">
            <div className="pill">Partie en cours</div>
            <h3>{saved.mode === 'cash' ? 'Cash game' : saved.mode === 'sng' ? 'Sit & Go' : saved.mode === 'marathon' ? 'Marathon' : 'Chip leader'} · {saved.hands} main{saved.hands > 1 ? 's' : ''} · {saved.minutes} min</h3>
            <p>Ton tapis : {saved.stack} ({Math.round(saved.stack / saved.bb)} BB). L'horloge du tournoi est en pause.</p>
          </div>
          <div className="resume-r">
            <button className="primary" onClick={onResume}>Reprendre</button>
            <button className="ghost" onClick={onDiscard}>Abandonner</button>
          </div>
        </div>
      )}
      <button className="mode train" onClick={onTrain}>
        <span className="pill">{doneToday ? `🔥 ${store.streak.count} j · séance faite` : 'Séance du jour à faire'}</span>
        <div className="icon">◆</div>
        <h3>Entraînement</h3>
        <p>Drills chronométrés, cours et parcours. Dix questions par jour suffisent pour progresser.</p>
      </button>
      <div className="modes">
        <button className="mode focus" onClick={() => onPick('chipleader')}>
          <span className="pill">Ton leak</span>
          <div className="icon">♛</div>
          <h3>Chip leader</h3>
          <p>Fin de tournoi, gros tapis contre deux autres gros tapis. Apprends à garder tes jetons quand ça compte.</p>
        </button>
        <button className="mode" onClick={() => onPick('sng')}>
          <div className="icon">🏆</div>
          <h3>Sit & Go</h3>
          <p>Tournoi complet avec structure de blinds, antes, timer et places payées.</p>
        </button>
        <button className="mode" onClick={() => onPick('marathon')}>
          <span className="pill">Endurance</span>
          <div className="icon">⏱</div>
          <h3>Marathon</h3>
          <p>Tournoi de 60 joueurs, structure live, pauses guidées. Pour tenir la distance comme à Malte.</p>
        </button>
        <button className="mode" onClick={() => onPick('cash')}>
          <div className="icon">♦</div>
          <h3>Cash game</h3>
          <p>Table deep stack, blinds fixes. Travaille ton jeu postflop à ton rythme.</p>
        </button>
      </div>
      <div className="nav">
        <button className={tab === 'home' ? 'on' : ''} onClick={() => onNav('home')}>Jouer</button>
        <button className={tab === 'history' ? 'on' : ''} onClick={() => onNav('history')}>Historique</button>
        <button className={tab === 'stats' ? 'on' : ''} onClick={() => onNav('stats')}>Stats</button>
      </div>
    </div>
  )
}
