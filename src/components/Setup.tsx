import { useState } from 'react'
import type { Mode, SessionConfig } from '../hooks/useSession'
import { STRUCTURES } from '../engine/tournament'

const TITLES: Record<Mode, [string, string]> = {
  cash: ['Cash game', 'Blinds fixes 10/20. Choisis la table et ton tapis.'],
  sng: ['Sit & Go', 'Tout le monde part avec le même tapis, les blinds montent, le dernier debout gagne. 3 places payées.'],
  chipleader: ['Mode Chip leader', 'Tu arrives en fin de tournoi (12 inscrits, 6 restants, 4 places payées) avec 65 BB. Deux adversaires te couvrent ou presque. Objectif : convertir ton tapis en victoire sans le dilapider contre les autres gros stacks.'],
}

export function Setup({ mode, onStart, onBack, coach, setCoach }: { mode: Mode; onStart: (c: SessionConfig) => void; onBack: () => void; coach: boolean; setCoach: (v: boolean) => void }) {
  const [players, setPlayers] = useState(6)
  const [stack, setStack] = useState(mode === 'cash' ? 2000 : 3000)
  const [structureId, setStructureId] = useState(mode === 'chipleader' ? 'standard' : 'turbo')
  const [botSpeed, setBotSpeed] = useState(1)
  const [title, desc] = TITLES[mode]
  return (
    <div className="setup">
      <button className="ghost" style={{ alignSelf: 'flex-start' }} onClick={onBack}>← Retour</button>
      <h2>{title}</h2>
      <p className="desc">{desc}</p>
      <div className="field">
        <div className="lbl">Joueurs à table</div>
        <div className="seg">{[2, 3, 4, 5, 6, 7, 8].map((k) => <button key={k} className={k === players ? 'on' : ''} onClick={() => setPlayers(k)}>{k}</button>)}</div>
      </div>
      {mode !== 'chipleader' && (
        <div className="field">
          <div className="lbl">{mode === 'cash' ? 'Tapis de départ' : 'Tapis de départ (tournoi)'}</div>
          <div className="seg">{(mode === 'cash' ? [1000, 2000, 4000, 10000] : [1500, 3000, 5000, 10000]).map((k) => <button key={k} className={k === stack ? 'on' : ''} onClick={() => setStack(k)}>{k.toLocaleString('fr-FR')}{mode === 'cash' ? ` (${k / 20} BB)` : ''}</button>)}</div>
        </div>
      )}
      {mode !== 'cash' && (
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
      <button className="primary" onClick={() => onStart({ mode, players, stack, structureId, botSpeed })}>Lancer la partie</button>
    </div>
  )
}
