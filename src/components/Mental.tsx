import { useEffect, useState } from 'react'
import type { GameState } from '../engine/game'
import type { Session } from '../hooks/useSession'
import type { CheckIn, Decision, JournalEntry } from '../store'

/* ---------- Alerts (fatigue / tilt) ---------- */
export interface Alert { kind: 'fatigue' | 'tilt' | 'autopilot'; title: string; text: string }

export function detectAlerts(sess: Session, baselineVpip: number, playedMs: number): Alert | null {
  const d = sess.decisions
  if (playedMs > 40 * 60000 && d.length >= 30) {
    const half = Math.floor(d.length / 2)
    const base = d.slice(0, half)
    const recent = d.slice(-12)
    const err = (xs: Decision[]) => xs.filter((x) => x.mistake).length / xs.length
    const avg = (xs: Decision[]) => xs.reduce((a, x) => a + x.ms, 0) / xs.length
    if (err(recent) > err(base) * 1.8 + 0.12) return { kind: 'fatigue', title: 'Tu décroches', text: `Sur tes 12 dernières décisions, ${Math.round(err(recent) * 100)} % s'écartent nettement du coach, contre ${Math.round(err(base) * 100)} % en début de session. C'est le signal typique de la fatigue : une pause de cinq minutes maintenant vaut mieux qu'un tapis perdu dans vingt.` }
    if (avg(recent) < avg(base) * 0.5 && avg(recent) < 2500) return { kind: 'autopilot', title: 'Pilote automatique', text: `Tu décides deux fois plus vite qu'en début de session (${(avg(recent) / 1000).toFixed(1)} s en moyenne). Après ${Math.round(playedMs / 60000)} minutes, c'est souvent le signe que tu ne lis plus la table. Respire, regarde les stacks, puis reprends.` }
  }
  // tilt: big loss recently then widening
  const recs = sess.records
  if (recs.length >= 8) {
    const lookback = recs.slice(-12)
    const idx = lookback.findIndex((r) => { const me = r.players.find((p) => p.id === 0); return me && r.heroDelta < -0.25 * me.stackBefore })
    if (idx >= 0) {
      const after = lookback.slice(idx + 1)
      if (after.length >= 5) {
        const vpip = after.filter((r) => r.actions.some((a) => a.playerId === 0 && a.street === 'preflop' && (a.action === 'call' || a.action === 'raise' || a.action === 'allin'))).length / after.length
        if (vpip > Math.max(0.45, baselineVpip * 1.6)) return { kind: 'tilt', title: 'Tilt possible', text: `Depuis ton gros pot perdu, tu entres dans ${Math.round(vpip * 100)} % des mains (ton habitude : ${Math.round(baselineVpip * 100)} %). Vouloir se refaire tout de suite est la façon la plus sûre de perdre le reste. Serre le jeu pendant dix mains, ou prends la pause.` }
      }
    }
  }
  return null
}

/* ---------- Pause routine ---------- */
const STEPS = [
  { title: 'Respire', secs: 60, text: 'Pose le téléphone, dos droit. Inspire 4 s, bloque 4 s, expire 6 s. Dix cycles. Ton rythme cardiaque redescend, ta lecture de table reviendra avec.' },
  { title: 'Où en es-tu ?', secs: 45, text: 'Regarde ton tapis en BB, pas en jetons. Qui te couvre ? Qui est court ? Qui a changé de rythme depuis une heure ? Nomme-les mentalement.' },
  { title: 'Ton objectif pour le prochain niveau', secs: 45, text: 'Une seule phrase, concrète. Exemples : « aucun gros pot contre Marco sans premium », « voler les blinds du short stack à ma droite », « pot control avec mes top paires ».' },
]

export function PauseOverlay({ reason, state, heroIdx, onResume }: { reason: Session['pauseReason']; state: GameState; heroIdx: number; onResume: (goal: string) => void }) {
  const [step, setStep] = useState(0)
  const [left, setLeft] = useState(STEPS[0].secs)
  const [goal, setGoal] = useState('')
  useEffect(() => {
    setLeft(STEPS[step].secs)
    const id = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000)
    return () => clearInterval(id)
  }, [step])
  const hero = state.players[heroIdx]
  const alive = state.players.filter((p) => !p.out)
  const covers = alive.filter((p) => p.id !== hero.id && p.stack > hero.stack).map((p) => p.name)
  const short = alive.filter((p) => p.id !== hero.id && p.stack < 12 * state.blinds.bb).map((p) => p.name)
  const s = STEPS[step]
  return (
    <div className="overlay">
      <div className="modal pause">
        <div className="hint">{reason === 'hourly' ? 'Pause horaire' : reason === 'fatigue' ? 'Pause conseillée' : 'Pause'} · étape {step + 1}/{STEPS.length}</div>
        <h2>{s.title}</h2>
        <div className="place" style={{ fontSize: 44 }}>{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</div>
        <p style={{ textAlign: 'left', lineHeight: 1.55 }}>{s.text}</p>
        {step === 1 && (
          <div className="grid">
            <div className="cell"><div className="v">{Math.round(hero.stack / state.blinds.bb)} BB</div><div className="l">ton tapis</div></div>
            <div className="cell"><div className="v">{(() => { const r = alive.filter((p) => p.stack > hero.stack).length + 1; return r === 1 ? '1er' : `${r}e` })()}</div><div className="l">sur {alive.length} à table</div></div>
            <div className="cell" style={{ gridColumn: '1 / -1' }}><div className="l">Te couvrent : {covers.length ? covers.join(', ') : 'personne'}</div><div className="l">Courts (&lt; 12 BB) : {short.length ? short.join(', ') : 'personne'}</div></div>
          </div>
        )}
        {step === 2 && <textarea className="ta" placeholder="Mon objectif pour le prochain niveau…" value={goal} onChange={(e) => setGoal(e.target.value)} />}
        <div className="row">
          {step < STEPS.length - 1
            ? <button className="primary" style={{ flex: 1 }} onClick={() => setStep(step + 1)}>{left === 0 ? 'Étape suivante' : 'Passer à la suite'}</button>
            : <button className="primary" style={{ flex: 1 }} onClick={() => onResume(goal)}>Reprendre la partie</button>}
        </div>
        {step === 0 && <button className="ghost" onClick={() => onResume('')}>Reprendre tout de suite</button>}
      </div>
    </div>
  )
}

/* ---------- Journal ---------- */
export function JournalModal({ mode, minutes, place, net, checkin, onSave, onSkip }: { mode: string; minutes: number; place: number | null; net: number; checkin: CheckIn | null; onSave: (e: Omit<JournalEntry, 'ts'>) => void; onSkip: () => void }) {
  const [good, setGood] = useState('')
  const [mistake, setMistake] = useState('')
  const [mental, setMental] = useState('')
  return (
    <div className="overlay">
      <div className="modal journal">
        <div className="hint">Journal de session · {minutes} min{place ? ` · ${place}e place` : ''}</div>
        <h2>Trois questions avant de partir</h2>
        <label className="jl">Ce que tu as bien fait<textarea className="ta" value={good} onChange={(e) => setGood(e.target.value)} placeholder="Ex. : j'ai gardé les pots petits contre Léo qui me couvrait." /></label>
        <label className="jl">Ta plus grosse erreur<textarea className="ta" value={mistake} onChange={(e) => setMistake(e.target.value)} placeholder="Ex. : call river avec top paire face au chip leader." /></label>
        <label className="jl">Ton état mental pendant la session<textarea className="ta" value={mental} onChange={(e) => setMental(e.target.value)} placeholder="Ex. : impatient après la deuxième heure, j'ai accéléré." /></label>
        <div className="row">
          <button className="ghost" style={{ flex: 1 }} onClick={onSkip}>Passer</button>
          <button className="primary" style={{ flex: 2 }} onClick={() => onSave({ mode, minutes, place, net, good, mistake, mental, checkin })} disabled={!good && !mistake && !mental}>Enregistrer (+40 XP)</button>
        </div>
      </div>
    </div>
  )
}
