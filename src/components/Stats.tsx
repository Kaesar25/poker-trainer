import { computeStats } from '../engine/stats'
import type { Store } from '../store'

export function StatsScreen({ store, onBack }: { store: Store; onBack: () => void }) {
  const s = computeStats(store.hands, 0, store.tournaments)
  const pct = (x: number) => `${Math.round(x * 100)} %`
  const tips: string[] = []
  if (s.hands >= 30) {
    if (s.vpip > 0.35) tips.push('Tu joues beaucoup de mains (VPIP élevé). Resserre tes ouvertures hors position.')
    if (s.vpip < 0.15) tips.push('VPIP très bas : tu laisses passer des spots rentables, surtout au bouton et au cutoff.')
    if (s.pfr / Math.max(s.vpip, 0.01) < 0.5) tips.push('Tu limpes ou tu suis souvent préflop. Quand une main vaut d\'être jouée, elle vaut une relance.')
    if (s.af < 1) tips.push('Agression postflop faible : tu suis plus que tu ne mises. Mise pour valeur quand tu es devant.')
    if (s.wtsd > 0.35) tips.push('Tu vas trop souvent à l\'abattage : tu paies des rivers que tu devrais lâcher.')
    if (s.wtsd > 0 && s.wsd < 0.45) tips.push('Tu perds la majorité de tes abattages : tes calls de river sont trop larges.')
  }
  const positions = Object.entries(s.byPosition).sort((a, b) => b[1].hands - a[1].hands)
  return (
    <div className="screen">
      <button className="ghost" style={{ alignSelf: 'flex-start' }} onClick={onBack}>← Accueil</button>
      <h2>Tes statistiques</h2>
      {s.hands === 0 && <div className="empty">Joue quelques mains pour voir ton profil apparaître.</div>}
      <div className="statgrid">
        <div className="stat"><div className="v">{s.hands}</div><div className="l">Mains jouées</div></div>
        <div className="stat"><div className="v">{pct(s.vpip)}</div><div className="l">VPIP</div><div className="d">Mains où tu mets volontairement des jetons préflop. Cible 20–28 % à 6 joueurs.</div></div>
        <div className="stat"><div className="v">{pct(s.pfr)}</div><div className="l">PFR</div><div className="d">Relances préflop. Proche du VPIP = tu prends l'initiative.</div></div>
        <div className="stat"><div className="v">{s.af.toFixed(1)}</div><div className="l">Agression (AF)</div><div className="d">(mises + relances) / calls postflop. 2 à 3 est sain.</div></div>
        <div className="stat"><div className="v">{pct(s.wtsd)}</div><div className="l">WTSD</div><div className="d">Va à l'abattage après avoir vu le flop. Au-delà de 30 %, tu paies trop.</div></div>
        <div className="stat"><div className="v">{pct(s.wsd)}</div><div className="l">W$SD</div><div className="d">Gagne à l'abattage. En dessous de 50 %, tes calls sont trop larges.</div></div>
        <div className="stat"><div className="v" style={{ color: s.net >= 0 ? 'var(--green)' : 'var(--red)' }}>{s.net >= 0 ? '+' : ''}{s.net}</div><div className="l">Net jetons</div><div className="d">{s.bb100 >= 0 ? '+' : ''}{s.bb100.toFixed(1)} BB / 100 mains</div></div>
        <div className="stat"><div className="v">{s.tournaments.played}</div><div className="l">Tournois</div><div className="d">{s.tournaments.itm} dans les places payées · {s.tournaments.wins} victoire{s.tournaments.wins > 1 ? 's' : ''}</div></div>
      </div>
      {tips.length > 0 && (
        <div className="stat">
          <div className="l" style={{ marginBottom: 8 }}>Leaks repérés</div>
          {tips.map((t, i) => <div key={i} className="d" style={{ fontSize: 13, marginBottom: 6 }}>◆ {t}</div>)}
        </div>
      )}
      {positions.length > 0 && (
        <div className="stat">
          <div className="l" style={{ marginBottom: 8 }}>Par position</div>
          {positions.map(([pos, v]) => (
            <div key={pos} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <span>{pos} <span style={{ color: 'var(--muted)' }}>· {v.hands} mains</span></span>
              <b style={{ color: v.net >= 0 ? 'var(--green)' : 'var(--red)' }}>{v.net >= 0 ? '+' : ''}{v.net}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
