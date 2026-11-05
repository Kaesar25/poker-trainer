import { DRILL_META, type DrillType } from '../engine/drills'
import { accuracy, endurance, levelFor, type Store } from '../store'
import { LEVELS } from '../content/lessons'
import { computeLeaks } from '../engine/leaks'

const TYPES: DrillType[] = ['preflop', 'odds', 'outs', 'board', 'pushfold', 'icm']

export function Training({ store, onDaily, onDrill, onLearn, onBack, onMarathon, onPuzzle, onPro, onLeaks, onIcm, onChallenges }: { store: Store; onDaily: () => void; onDrill: (t: DrillType) => void; onLearn: () => void; onBack: () => void; onMarathon: () => void; onPuzzle: () => void; onPro: () => void; onLeaks: () => void; onIcm: () => void; onChallenges: () => void }) {
  const leaks = computeLeaks(store)
  const lv = levelFor(store.xp)
  const en = endurance(store)
  const doneToday = store.streak.lastDay === new Date().toISOString().slice(0, 10)
  const unlocked = LEVELS.filter((_L, i) => i === 0 || accuracy(store, LEVELS[i - 1].gate.drills, LEVELS[i - 1].gate.minAnswers).ready && accuracy(store, LEVELS[i - 1].gate.drills, LEVELS[i - 1].gate.minAnswers).acc >= LEVELS[i - 1].gate.accuracy).length
  return (
    <div className="screen">
      <button className="ghost" style={{ alignSelf: 'flex-start' }} onClick={onBack}>← Accueil</button>
      <h2>Entraînement</h2>
      <div className="xpbar">
        <div className="xp-head">
          <div><span className="xp-lvl">Niv. {lv.level}</span> <span className="xp-title">{lv.title}</span></div>
          <div className="xp-right">{store.xp} XP · 🔥 {store.streak.count} jour{store.streak.count > 1 ? 's' : ''}</div>
        </div>
        <div className="bar"><div style={{ width: `${lv.progress * 100}%` }} /></div>
      </div>
      <button className="daily" onClick={onDaily}>
        <div className="daily-l">
          <div className="pill">{doneToday ? 'Déjà faite aujourd\'hui · refais-la' : 'Séance du jour'}</div>
          <h3>10 questions mélangées</h3>
          <p>Préflop, cotes, outs, board, push/fold, ICM. Cinq minutes pour garder le rythme.</p>
        </div>
        <div className="daily-r">▶</div>
      </button>
      <button className="daily puzzlecard" onClick={onPuzzle}>
        <div className="daily-l">
          <div className="pill">Casse-tête · en continu</div>
          <h3>Une situation, une décision, la suivante</h3>
          <p>Des mains réelles jouées par les bots, arrêtées au moment où tu dois choisir. La difficulté monte avec ta série. {store.puzzles.asked ? `Série en cours : ${store.puzzles.streak}, record ${store.puzzles.best}, ${store.puzzles.solved}/${store.puzzles.asked} résolus.` : ''}</p>
        </div>
        <div className="daily-r">♟</div>
      </button>
      <div className="toolgrid">
        <button className="tool" onClick={onLeaks}><span className="tool-i">⚠</span><b>Carnet de leaks</b><small>{leaks.length ? `${Math.min(3, leaks.length)} point${leaks.length > 1 ? 's' : ''} à travailler` : 'Tes défauts, ton plan'}</small></button>
        <button className="tool" onClick={onPro}><span className="tool-i">★</span><b>Spots de pros</b><small>Grands classiques</small></button>
        <button className="tool" onClick={onIcm}><span className="tool-i">⚖</span><b>Simulateur ICM</b><small>Ce que vaut ton tapis</small></button>
        <button className="tool" onClick={onChallenges}><span className="tool-i">🏅</span><b>Défis et badges</b><small>Semaine en cours</small></button>
      </div>
      <div className="drillgrid">
        {TYPES.map((t) => {
          const m = DRILL_META[t]
          const d = store.drills[t]
          const acc = d && d.recent.length ? Math.round((d.recent.filter(Boolean).length / d.recent.length) * 100) : null
          return (
            <button key={t} className="drillcard" onClick={() => onDrill(t)}>
              <div className="dc-top"><span className="qicon">{m.icon}</span>{m.timed ? <span className="badge pos">⏱ {m.timed} s</span> : null}</div>
              <h3>{m.name}</h3>
              <p>{m.desc}</p>
              <div className="dc-foot">{d ? `${d.asked} réponses · ${acc} % récents` : 'Jamais fait'}</div>
              {acc !== null && <div className="bar mini"><div style={{ width: `${acc}%`, background: acc >= 75 ? 'var(--green)' : acc >= 55 ? 'var(--gold)' : 'var(--red)' }} /></div>}
            </button>
          )
        })}
      </div>
      <button className="daily marathon" onClick={onMarathon}>
        <div className="daily-l">
          <div className="pill">Endurance</div>
          <h3>Marathon · objectif {en.target} min cette semaine</h3>
          <p>Plus longue session : {en.longest} min. Cette semaine : {en.sessionsThisWeek} session{en.sessionsThisWeek > 1 ? 's' : ''}, {en.weekMinutes} min. Un vrai tournoi de 60 joueurs, pause guidée chaque heure, alerte quand tu décroches.</p>
          <div className="bar" style={{ marginTop: 6 }}><div style={{ width: `${Math.min(100, (en.longest / en.target) * 100)}%` }} /></div>
        </div>
        <div className="daily-r">▶</div>
      </button>
      <button className="daily learn" onClick={onLearn}>
        <div className="daily-l">
          <div className="pill">Cours</div>
          <h3>Parcours : {unlocked}/{LEVELS.length} niveaux débloqués</h3>
          <p>{store.lessonsRead.length} fiche{store.lessonsRead.length > 1 ? 's' : ''} lue{store.lessonsRead.length > 1 ? 's' : ''} sur {LEVELS.reduce((a, L) => a + L.lessons.length, 0)}. Les niveaux se débloquent avec tes résultats aux drills.</p>
        </div>
        <div className="daily-r">→</div>
      </button>
    </div>
  )
}
