import { computeLeaks } from '../engine/leaks'
import { DRILL_META, type DrillType } from '../engine/drills'
import type { Store } from '../store'

const TREND: Record<string, [string, string]> = { up: ['↗ en hausse', 'var(--red)'], down: ['↘ en baisse', 'var(--green)'], flat: ['→ stable', 'var(--muted)'], new: ['nouveau', 'var(--gold)'] }

export function Leaks({ store, onDrill, onBack }: { store: Store; onDrill: (t: DrillType) => void; onBack: () => void }) {
  const leaks = computeLeaks(store)
  const top = leaks.slice(0, 3)
  return (
    <div className="screen">
      <button className="ghost" style={{ alignSelf: 'flex-start' }} onClick={onBack}>← Entraînement</button>
      <h2>Carnet de leaks</h2>
      <p className="desc" style={{ color: 'var(--muted)', margin: 0 }}>Tes trois plus gros défauts du moment, calculés sur tes deux dernières semaines de jeu, avec un plan concret et l'évolution par rapport à la semaine d'avant.</p>
      {top.length === 0 && <div className="empty">{store.hands.length < 40 ? `Joue encore ${40 - store.hands.length} mains pour que le carnet ait assez de données.` : 'Aucun leak marqué pour l\'instant. Continue comme ça.'}</div>}
      {top.map((l, k) => (
        <div key={l.id} className="leak">
          <div className="leak-h">
            <span className="leak-n">{k + 1}</span>
            <div style={{ flex: 1 }}>
              <h3>{l.title}</h3>
              <div className="leak-v">{l.value} · objectif {l.target}</div>
            </div>
            <span className="leak-t" style={{ color: TREND[l.trend][1] }}>{TREND[l.trend][0]}</span>
          </div>
          <div className="bar"><div style={{ width: `${Math.round(l.severity * 100)}%`, background: l.severity > 0.6 ? 'var(--red)' : l.severity > 0.3 ? 'var(--gold)' : 'var(--green)' }} /></div>
          <p className="leak-why">{l.why}</p>
          <div className="leak-plan">
            <div className="l">Plan de la semaine</div>
            {l.plan.map((p) => <div key={p} className="leak-step">◆ {p}</div>)}
          </div>
          {l.drill && <button className="primary" onClick={() => onDrill(l.drill!)}>S'entraîner : {DRILL_META[l.drill].name}</button>}
        </div>
      ))}
      {leaks.length > 3 && (
        <div className="stat">
          <div className="l" style={{ marginBottom: 6 }}>À surveiller ensuite</div>
          {leaks.slice(3).map((l) => <div key={l.id} className="d" style={{ fontSize: 13, marginBottom: 4 }}>◆ {l.title} · {l.value}</div>)}
        </div>
      )}
    </div>
  )
}
