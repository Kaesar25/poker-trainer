import type { Store } from '../store'
import type { Mode } from '../hooks/useSession'
import { computeStats } from '../engine/stats'

export function Home({ store, onPick, onNav, tab }: { store: Store; onPick: (m: Mode) => void; onNav: (t: 'home' | 'history' | 'stats') => void; tab: string }) {
  const st = computeStats(store.hands, 0, store.tournaments)
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
        </div>
      </div>
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
