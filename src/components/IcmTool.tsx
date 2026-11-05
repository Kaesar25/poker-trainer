import { useMemo, useState } from 'react'
import { callShoveIcm, icm } from '../engine/icm'

const PRESETS: { name: string; stacks: number[]; payouts: number[] }[] = [
  { name: 'Bulle SNG 4 joueurs', stacks: [5000, 3500, 1000, 500], payouts: [50, 30, 20] },
  { name: 'Table finale 6', stacks: [80, 70, 25, 15, 9, 6], payouts: [40, 25, 15, 10] },
  { name: 'Tête-à-tête', stacks: [60, 40], payouts: [65, 35] },
]

export function IcmTool({ onBack }: { onBack: () => void }) {
  const [stacks, setStacks] = useState<number[]>(PRESETS[1].stacks)
  const [payouts, setPayouts] = useState<number[]>(PRESETS[1].payouts)
  const [hero, setHero] = useState(0)
  const [villain, setVillain] = useState(1)
  const [dead, setDead] = useState(3)
  const values = useMemo(() => icm(stacks, payouts), [stacks, payouts])
  const total = stacks.reduce((a, b) => a + b, 0)
  const pool = payouts.reduce((a, b) => a + b, 0)
  const shove = useMemo(() => (hero !== villain && stacks[hero] > 0 && stacks[villain] > 0 ? callShoveIcm(stacks, payouts, hero, villain, dead) : null), [stacks, payouts, hero, villain, dead])
  const setAt = (arr: number[], i: number, v: number) => arr.map((x, k) => (k === i ? Math.max(0, v) : x))
  const name = (i: number) => (i === 0 ? 'Toi' : `Joueur ${i + 1}`)
  return (
    <div className="screen">
      <button className="ghost" style={{ alignSelf: 'flex-start' }} onClick={onBack}>← Entraînement</button>
      <h2>Simulateur ICM</h2>
      <p className="desc" style={{ color: 'var(--muted)', margin: 0 }}>Entre les tapis et les prix : tu vois ce que vaut chaque tapis en argent, et l'équité qu'il te faut vraiment pour payer un tapis.</p>
      <div className="seg">{PRESETS.map((p) => <button key={p.name} onClick={() => { setStacks(p.stacks); setPayouts(p.payouts); setHero(0); setVillain(1) }}>{p.name}</button>)}</div>
      <div className="stat">
        <div className="l" style={{ marginBottom: 8 }}>Tapis (en jetons ou en BB)</div>
        {stacks.map((st, i) => (
          <div key={i} className="icm-row">
            <span className="icm-name">{name(i)}</span>
            <input className="num" type="number" inputMode="numeric" value={st} onChange={(e) => setStacks(setAt(stacks, i, Number(e.target.value)))} />
            <b className="icm-val">{values[i].toFixed(1)} ₵</b>
            <span className="icm-pct">{total ? Math.round((st / total) * 100) : 0} % des jetons → {pool ? Math.round((values[i] / pool) * 100) : 0} % du prize pool</span>
            {stacks.length > 2 ? <button className="chipbtn icm-x" onClick={() => { setStacks(stacks.filter((_, k) => k !== i)); setHero(0); setVillain(1) }}>✕</button> : <span />}
          </div>
        ))}
        {stacks.length < 9 && <button className="ghost" onClick={() => setStacks([...stacks, 10])}>+ Ajouter un joueur</button>}
      </div>
      <div className="stat">
        <div className="l" style={{ marginBottom: 8 }}>Prix par place</div>
        <div className="icm-pay">
          {payouts.map((p, i) => (
            <label key={i}>{i + 1}{i === 0 ? 'er' : 'e'}<input className="num" type="number" inputMode="numeric" value={p} onChange={(e) => setPayouts(setAt(payouts, i, Number(e.target.value)))} /></label>
          ))}
          {payouts.length < stacks.length && <button className="chipbtn" onClick={() => setPayouts([...payouts, 0])}>+</button>}
          {payouts.length > 1 && <button className="chipbtn" onClick={() => setPayouts(payouts.slice(0, -1))}>−</button>}
        </div>
      </div>
      <div className="stat">
        <div className="l" style={{ marginBottom: 8 }}>Puis-je payer ce tapis ?</div>
        <div className="icm-q">
          <label>Celui qui paie<select value={hero} onChange={(e) => setHero(Number(e.target.value))}>{stacks.map((_, i) => <option key={i} value={i}>{name(i)}</option>)}</select></label>
          <label>Celui qui pousse<select value={villain} onChange={(e) => setVillain(Number(e.target.value))}>{stacks.map((_, i) => <option key={i} value={i}>{name(i)}</option>)}</select></label>
          <label>Jetons déjà au pot<input className="num" type="number" inputMode="numeric" value={dead} onChange={(e) => setDead(Math.max(0, Number(e.target.value)))} /></label>
        </div>
        {shove && (
          <div className="icm-res">
            <div><span>Équité nécessaire en jetons (cash game)</span><b>{Math.round(shove.chipEq * 100)} %</b></div>
            <div><span>Équité nécessaire avec l'ICM</span><b style={{ color: 'var(--gold)' }}>{Math.round(shove.icmEq * 100)} %</b></div>
            <div className="d">Prime de risque : <b>+{Math.max(0, Math.round((shove.icmEq - shove.chipEq) * 100))} points</b>. Si tu te couches, ton tapis vaut {shove.fold.toFixed(1)} ₵ ; si tu paies et gagnes {shove.win.toFixed(1)} ₵ ; si tu perds {shove.lose.toFixed(1)} ₵.</div>
          </div>
        )}
      </div>
    </div>
  )
}
