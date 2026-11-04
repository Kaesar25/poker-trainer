import { useState } from 'react'
import type { Mode, SessionConfig } from '../hooks/useSession'
import { STRUCTURES } from '../engine/tournament'
import type { CheckIn } from '../store'

const TITLES: Record<Mode, [string, string]> = {
  cash: ['Cash game', 'Blinds fixes 10/20. Choisis la table et ton tapis.'],
  sng: ['Sit & Go', 'Tout le monde part avec le même tapis, les blinds montent, le dernier debout gagne. 3 places payées.'],
  chipleader: ['Mode Chip leader', 'Tu arrives en fin de tournoi (12 inscrits, 6 restants, 4 places payées) avec 65 BB. Deux adversaires te couvrent ou presque. Objectif : convertir ton tapis en victoire sans le dilapider contre les autres gros stacks.'],
  marathon: ['Marathon', 'Un vrai tournoi de 60 joueurs, structure live, 9 places payées. Les joueurs éliminés aux autres tables sont remplacés à la tienne, les blinds montent lentement : compte 2 à 4 heures. Une pause guidée toutes les heures, l\'app surveille ta lucidité.'],
}

function Slider({ label, hint, value, onChange }: { label: string; hint: [string, string]; value: number; onChange: (v: number) => void }) {
  return (
    <div className="ci-row">
      <div className="ci-label">{label} <b>{value}/5</b></div>
      <input type="range" min={1} max={5} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <div className="ci-hint"><span>{hint[0]}</span><span>{hint[1]}</span></div>
    </div>
  )
}

export function Setup({ mode, onStart, onBack, coach, setCoach }: { mode: Mode; onStart: (c: SessionConfig) => void; onBack: () => void; coach: boolean; setCoach: (v: boolean) => void }) {
  const [players, setPlayers] = useState(mode === 'marathon' ? 8 : 6)
  const [stack, setStack] = useState(mode === 'cash' ? 2000 : mode === 'marathon' ? 10000 : 3000)
  const [structureId, setStructureId] = useState(mode === 'chipleader' ? 'standard' : mode === 'marathon' ? 'live' : 'turbo')
  const [botSpeed, setBotSpeed] = useState(1)
  const [checkin, setCheckin] = useState<CheckIn>({ energy: 3, mood: 3, focus: 3 })
  const [entrants, setEntrants] = useState(60)
  const [reentry, setReentry] = useState(mode === 'marathon' ? 4 : 0)
  const [title, desc] = TITLES[mode]
  const tournament = mode !== 'cash'
  return (
    <div className="setup">
      <button className="ghost" style={{ alignSelf: 'flex-start' }} onClick={onBack}>← Retour</button>
      <h2>{title}</h2>
      <p className="desc">{desc}</p>
      {mode !== 'marathon' && (
        <div className="field">
          <div className="lbl">Joueurs à table</div>
          <div className="seg">{[2, 3, 4, 5, 6, 7, 8].map((k) => <button key={k} className={k === players ? 'on' : ''} onClick={() => setPlayers(k)}>{k}</button>)}</div>
        </div>
      )}
      {mode !== 'chipleader' && (
        <div className="field">
          <div className="lbl">{mode === 'cash' ? 'Tapis de départ' : 'Tapis de départ (tournoi)'}</div>
          <div className="seg">{(mode === 'cash' ? [1000, 2000, 4000, 10000] : mode === 'marathon' ? [10000, 20000, 30000] : [1500, 3000, 5000, 10000]).map((k) => <button key={k} className={k === stack ? 'on' : ''} onClick={() => setStack(k)}>{k.toLocaleString('fr-FR')}{mode === 'cash' ? ` (${k / 20} BB)` : mode === 'marathon' ? ` (${k / 50} BB)` : ''}</button>)}</div>
        </div>
      )}
      {mode === 'marathon' && (
        <div className="field">
          <div className="lbl">Taille du tournoi</div>
          <div className="seg">{[30, 60, 120, 250].map((k) => <button key={k} className={k === entrants ? 'on' : ''} onClick={() => setEntrants(k)}>{k} joueurs · {k <= 30 ? 6 : Math.max(9, Math.round(k * 0.15))} payés</button>)}</div>
        </div>
      )}
      {(mode === 'marathon' || mode === 'sng') && (
        <div className="field">
          <div className="lbl">Re-entry (100 ₵ par rentrée)</div>
          <div className="seg">{[[0, 'Aucun'], [2, 'Jusqu\'au niveau 2'], [4, 'Jusqu\'au niveau 4'], [8, 'Jusqu\'au niveau 8']].map(([v, l]) => <button key={v} className={v === reentry ? 'on' : ''} onClick={() => setReentry(v as number)}>{l}</button>)}</div>
        </div>
      )}
      {tournament && (
        <div className="field">
          <div className="lbl">Structure</div>
          <div className="seg">{Object.values(STRUCTURES).map((s) => <button key={s.id} className={s.id === structureId ? 'on' : ''} onClick={() => setStructureId(s.id)}>{s.name} · {s.levelSeconds / 60} min</button>)}</div>
        </div>
      )}
      <div className="field">
        <div className="lbl">Rythme des bots</div>
        <div className="seg">{[[0.5, 'Lent'], [1, 'Normal'], [2, 'Rapide'], [4, 'Éclair']].map(([v, l]) => <button key={v} className={v === botSpeed ? 'on' : ''} onClick={() => setBotSpeed(v as number)}>{l}</button>)}</div>
      </div>
      <div className="field">
        <div className="lbl">Coach en direct</div>
        <div className="seg">
          <button className={coach ? 'on' : ''} onClick={() => setCoach(true)}>Activé (équité, cote, conseil)</button>
          <button className={!coach ? 'on' : ''} onClick={() => setCoach(false)}>Désactivé (à l'aveugle)</button>
        </div>
      </div>
      {tournament && (
        <div className="checkin">
          <div className="lbl">Check-in avant de t'asseoir</div>
          <p className="desc" style={{ fontSize: 13 }}>Trente secondes d'honnêteté. L'app croisera ces réponses avec tes résultats pour te montrer dans quel état tu joues bien, et dans lequel tu t'effondres.</p>
          <Slider label="Énergie" hint={['Épuisé', 'En pleine forme']} value={checkin.energy} onChange={(v) => setCheckin({ ...checkin, energy: v })} />
          <Slider label="Humeur" hint={['Agacé, pressé', 'Calme, patient']} value={checkin.mood} onChange={(v) => setCheckin({ ...checkin, mood: v })} />
          <Slider label="Concentration" hint={['Dispersé', 'Rien d\'autre en tête']} value={checkin.focus} onChange={(v) => setCheckin({ ...checkin, focus: v })} />
        </div>
      )}
      <button className="primary" onClick={() => onStart({ mode, players, stack, structureId, botSpeed, checkin: tournament ? checkin : undefined, entrants, reentryUntilLevel: reentry })}>{mode === 'marathon' ? 'Démarrer le marathon' : 'Lancer la partie'}</button>
    </div>
  )
}
