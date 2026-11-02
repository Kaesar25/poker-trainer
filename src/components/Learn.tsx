import { useState } from 'react'
import { LEVELS, type Lesson } from '../content/lessons'
import { DRILL_META, type DrillType } from '../engine/drills'
import { accuracy, type Store } from '../store'

export function Learn({ store, onRead, onDrill, onBack }: { store: Store; onRead: (id: string) => void; onDrill: (t: DrillType) => void; onBack: () => void }) {
  const [open, setOpen] = useState<Lesson | null>(null)
  if (open) {
    return (
      <div className="screen lesson">
        <button className="ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setOpen(null)}>← Parcours</button>
        <div className="hint" style={{ textAlign: 'left' }}>{open.minutes} min de lecture</div>
        <h2>{open.title}</h2>
        <p className="lead">{open.summary}</p>
        {open.sections.map((s) => (
          <div key={s.h} className="section">
            <h3>{s.h}</h3>
            {s.p.map((p, i) => <p key={i}>{p}</p>)}
          </div>
        ))}
        <div className="row" style={{ marginTop: 8 }}>
          {!store.lessonsRead.includes(open.id) && <button className="primary" style={{ flex: 1 }} onClick={() => { onRead(open.id); setOpen(null) }}>Marquer comme lue (+30 XP)</button>}
          {open.drill && <button className="ghost" style={{ flex: 1 }} onClick={() => onDrill(open.drill!)}>S'entraîner : {DRILL_META[open.drill].name}</button>}
        </div>
      </div>
    )
  }
  let prevUnlocked = true
  return (
    <div className="screen">
      <button className="ghost" style={{ alignSelf: 'flex-start' }} onClick={onBack}>← Entraînement</button>
      <h2>Parcours</h2>
      {LEVELS.map((L, i) => {
        const unlocked = prevUnlocked
        const gate = accuracy(store, L.gate.drills, L.gate.minAnswers)
        const passed = gate.ready && gate.acc >= L.gate.accuracy
        prevUnlocked = unlocked && passed
        const read = L.lessons.filter((l) => store.lessonsRead.includes(l.id)).length
        return (
          <div key={L.id} className={'level' + (unlocked ? '' : ' locked')}>
            <div className="level-head">
              <div>
                <div className="hint" style={{ textAlign: 'left' }}>Niveau {i + 1}{unlocked ? '' : ' · verrouillé'}</div>
                <h3>{L.name}</h3>
                <p>{L.tagline}</p>
              </div>
              <div className="level-prog">{read}/{L.lessons.length}</div>
            </div>
            {unlocked && (
              <div className="lessons">
                {L.lessons.map((l) => (
                  <button key={l.id} className={'lessonrow' + (store.lessonsRead.includes(l.id) ? ' done' : '')} onClick={() => setOpen(l)}>
                    <span className="check">{store.lessonsRead.includes(l.id) ? '✓' : '○'}</span>
                    <span className="lt">{l.title}</span>
                    <span className="lm">{l.minutes} min</span>
                  </button>
                ))}
              </div>
            )}
            <div className="gate">
              {passed ? <span style={{ color: 'var(--green)' }}>✓ Palier validé</span> : (
                <>Pour débloquer la suite : {Math.round(L.gate.accuracy * 100)} % de réussite sur {L.gate.drills.map((d) => DRILL_META[d].name).join(', ')} ({gate.n}/{L.gate.minAnswers} réponses{gate.n ? `, ${Math.round(gate.acc * 100)} %` : ''}).</>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
