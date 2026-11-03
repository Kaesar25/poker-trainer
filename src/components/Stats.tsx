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
    if (s.cbetOpps >= 10 && s.cbet < 0.45) tips.push(`Tu ne c-bet que ${pct(s.cbet)} de tes flops en tant que relanceur : tu abandonnes l'initiative. Vise 55 à 70 %.`)
    if (s.foldToCbetOpps >= 10 && s.foldToCbet > 0.65) tips.push(`Tu couches ${pct(s.foldToCbet)} des c-bets : les bots agressifs l'ont remarqué et bluffent plus. Défends avec tes tirages et tes paires.`)
    if (s.model.samples >= 15 && s.model.foldToBet > 0.6) tips.push(`Face à une mise postflop, tu te couches ${pct(s.model.foldToBet)} du temps. Trop exploitable : les bots t'attaquent davantage.`)
    if (s.model.samples >= 15 && s.model.callDown > 0.65) tips.push(`Face à une mise postflop, tu paies ${pct(s.model.callDown)} du temps. Les bots ont arrêté de bluffer contre toi et misent plus gros pour valeur : relance ou couche plus souvent.`)
    if (s.bigLossVsCover.count >= 2) tips.push(`${s.bigLossVsCover.count} gros pots (> 20 BB) perdus contre des joueurs qui te couvraient, soit ${s.bigLossVsCover.chips} jetons. C'est exactement ton leak big stack vs big stack : contre eux, garde le pot petit.`)
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
        <div className="stat"><div className="v">{s.cbetOpps ? pct(s.cbet) : '—'}</div><div className="l">C-bet flop</div><div className="d">Mises au flop quand tu as relancé préflop. 55–70 % est sain.</div></div>
        <div className="stat"><div className="v">{s.foldToCbetOpps ? pct(s.foldToCbet) : '—'}</div><div className="l">Fold au c-bet</div><div className="d">Au-delà de 60 %, tu te fais bluffer.</div></div>
        <div className="stat"><div className="v" style={{ color: s.bigLossVsCover.count ? 'var(--red)' : 'var(--green)' }}>{s.bigLossVsCover.count}</div><div className="l">Gros pots perdus vs gros stacks</div><div className="d">Pots de plus de 20 BB perdus contre un joueur qui te couvrait, en tournoi.</div></div>
        <div className="stat"><div className="v">{s.tournaments.played}</div><div className="l">Tournois</div><div className="d">{s.tournaments.itm} dans les places payées · {s.tournaments.wins} victoire{s.tournaments.wins > 1 ? 's' : ''}</div></div>
      </div>
      {tips.length > 0 && (
        <div className="stat">
          <div className="l" style={{ marginBottom: 8 }}>Leaks repérés</div>
          {tips.map((t, i) => <div key={i} className="d" style={{ fontSize: 13, marginBottom: 6 }}>◆ {t}</div>)}
        </div>
      )}
      <Lucidity store={store} />
      <ByCheckin store={store} />
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


function Lucidity({ store }: { store: Store }) {
  const buckets: Record<number, { n: number; errors: number; ms: number }> = {}
  for (const sess of store.sessions) for (const b of sess.lucidity) {
    const x = (buckets[b.bucket] ??= { n: 0, errors: 0, ms: 0 })
    x.n += b.n; x.errors += b.errors; x.ms += b.avgMs * b.n
  }
  const rows = Object.entries(buckets).map(([b, x]) => ({ b: Number(b), n: x.n, err: x.errors / x.n, ms: x.ms / x.n })).filter((r) => r.n >= 5).sort((a, b) => a.b - b.b)
  if (rows.length < 2) return (
    <div className="stat"><div className="l" style={{ marginBottom: 6 }}>Courbe de lucidité</div><div className="d">Joue des sessions de plus d'une heure (mode Marathon) : l'app mesurera, par tranche de 30 minutes, ton taux d'écarts avec le coach et ton temps de décision, pour te montrer à quel moment tu décroches.</div></div>
  )
  const maxErr = Math.max(...rows.map((r) => r.err), 0.3)
  const worst = rows.reduce((a, r) => (r.err > a.err ? r : a), rows[0])
  const best = rows.reduce((a, r) => (r.err < a.err ? r : a), rows[0])
  return (
    <div className="stat">
      <div className="l" style={{ marginBottom: 8 }}>Courbe de lucidité · écarts avec le coach par tranche de 30 min</div>
      <div className="luc">
        {rows.map((r) => (
          <div key={r.b} className="luc-col" title={`${r.n} décisions · ${(r.ms / 1000).toFixed(1)} s en moyenne`}>
            <div className="luc-v">{Math.round(r.err * 100)} %</div>
            <div className="luc-bar"><div style={{ height: `${(r.err / maxErr) * 100}%`, background: r.err >= worst.err - 0.001 && rows.length > 1 ? 'var(--red)' : r.err <= best.err + 0.001 ? 'var(--green)' : 'var(--gold)' }} /></div>
            <div className="luc-l">{r.b * 30}–{r.b * 30 + 30}'</div>
            <div className="luc-ms">{(r.ms / 1000).toFixed(1)} s</div>
          </div>
        ))}
      </div>
      <div className="d" style={{ marginTop: 8 }}>{worst.b !== best.b ? `Tu es le plus lucide entre ${best.b * 30} et ${best.b * 30 + 30} min, et tu décroches entre ${worst.b * 30} et ${worst.b * 30 + 30} min (${Math.round(worst.err * 100)} % d'écarts contre ${Math.round(best.err * 100)} %). Planifie ta pause juste avant.` : 'Pas encore de différence nette entre les tranches.'}</div>
    </div>
  )
}

function ByCheckin({ store }: { store: Store }) {
  const sess = store.sessions.filter((x) => x.checkin && x.decisions >= 10)
  if (sess.length < 3) return null
  const dims: [keyof NonNullable<typeof sess[0]['checkin']>, string][] = [['energy', 'Énergie'], ['mood', 'Humeur'], ['focus', 'Concentration']]
  return (
    <div className="stat">
      <div className="l" style={{ marginBottom: 8 }}>Ton état avant de jouer, et ce que ça donne</div>
      {dims.map(([k, label]) => {
        const lo = sess.filter((x) => x.checkin![k] <= 2), hi = sess.filter((x) => x.checkin![k] >= 4)
        const err = (xs: typeof sess) => (xs.length ? Math.round((xs.reduce((a, x) => a + x.errors, 0) / xs.reduce((a, x) => a + x.decisions, 0)) * 100) : null)
        const net = (xs: typeof sess) => (xs.length ? Math.round(xs.reduce((a, x) => a + x.net, 0) / xs.length) : null)
        return (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', gap: 8 }}>
            <span>{label}</span>
            <span style={{ color: 'var(--muted)' }}>faible : {lo.length ? `${err(lo)} % d'écarts, ${net(lo)} jetons` : '—'}</span>
            <span style={{ color: 'var(--muted)' }}>élevée : {hi.length ? `${err(hi)} % d'écarts, ${net(hi)} jetons` : '—'}</span>
          </div>
        )
      })}
    </div>
  )
}
