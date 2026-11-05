import { useEffect, useMemo, useState } from 'react'
import { buildFrames } from '../engine/replay'
import type { HandRecord } from '../engine/stats'
import { describeDetailed } from '../engine/evaluator'
import { Table } from './Table'

const ACT: Record<string, string> = { fold: 'Fold', check: 'Check', call: 'Call', bet: 'Mise', raise: 'Relance', allin: 'Tapis' }

export function Replay({ hand, onBack }: { hand: HandRecord; onBack: () => void }) {
  const frames = useMemo(() => buildFrames(hand, 0), [hand])
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [reveal, setReveal] = useState(true)
  useEffect(() => {
    if (!playing || !frames) return
    if (i >= frames.length - 1) { setPlaying(false); return }
    const t = setTimeout(() => setI((x) => x + 1), 1100)
    return () => clearTimeout(t)
  }, [playing, i, frames])

  if (!frames) {
    return (
      <div className="screen">
        <button className="ghost" style={{ alignSelf: 'flex-start' }} onClick={onBack}>← Historique</button>
        <div className="empty">Cette main a été jouée avant la mise à jour : elle ne peut pas être rejouée. Les nouvelles mains le pourront.</div>
      </div>
    )
  }
  const f = frames[i]
  // show cards: either revealed (study mode) or only what was shown
  const shownIds = new Set(hand.players.filter((p) => p.cards).map((p) => p.id))
  const state = { ...f.state, players: f.state.players.map((p) => ({ ...p, showCards: reveal ? !p.folded || p.isBot === false : p.showCards || (f.state.street === 'showdown' && shownIds.has(p.id)) })) }
  const decisions = frames.map((x, k) => ({ k, d: x.heroDecision })).filter((x) => x.d)
  const errors = decisions.filter((x) => !x.d!.aligned).length
  // the decision shown is the one that produced the next frame (hero to act in this frame)
  const next = frames[i + 1]
  const pending = next?.heroDecision
  const hero = f.state.players.find((p) => p.id === 0)
  const detail = hero && hero.cards.length ? describeDetailed(hero.cards, f.state.board) : null

  return (
    <div className="replay">
      <div className="drill-top">
        <button className="ghost" onClick={onBack}>← Historique</button>
        <div className="drill-title">Revoir la main</div>
        <div className={'drill-score' + (errors ? ' bad' : '')}>{decisions.length ? `${decisions.length - errors}/${decisions.length} décisions alignées` : ''}</div>
      </div>
      <div className="replay-table">
        <Table state={state} heroIdx={f.state.players.findIndex((p) => p.id === 0)} showLog={false} tournament={hand.mode !== 'cash'} />
      </div>
      <div className="replay-panel">
        <div className="rp-step">{i + 1}/{frames.length} · {f.label}</div>
        {detail && <div className="rp-hand">Ta main : <b>{detail.made}</b>{detail.draws.length ? ` · ${detail.draws.join(', ')}` : ''}</div>}
        {pending && (
          <div className={'rp-dec ' + (pending.aligned ? 'ok' : 'ko')}>
            <div className="rp-dec-h">À toi de jouer : tu as choisi <b>{ACT[pending.taken.action]}{pending.taken.action !== 'fold' && pending.taken.action !== 'check' ? ` ${pending.taken.amount}` : ''}</b></div>
            {pending.advice && <div className="rp-dec-c">Le coach : <b>{pending.advice.title}</b> ({Math.round(pending.advice.equity * 100)} % d'équité{pending.advice.potOdds ? `, cote ${Math.round(pending.advice.potOdds * 100)} %` : ''}). {pending.advice.reason}</div>}
            <div className="rp-dec-v">{pending.aligned ? '✓ Décision cohérente' : '✗ Écart avec le coach'}</div>
          </div>
        )}
        {i === frames.length - 1 && (
          <div className="rp-end">Résultat : <b style={{ color: hand.heroDelta >= 0 ? 'var(--green)' : 'var(--red)' }}>{hand.heroDelta >= 0 ? '+' : ''}{hand.heroDelta}</b> · {hand.winners.map((w) => `${w.name}${w.hand ? ` (${w.hand})` : ''}`).join(', ')}</div>
        )}
        <div className="rp-ctrl">
          <button className="iconbtn" onClick={() => { setPlaying(false); setI(0) }}>⏮</button>
          <button className="iconbtn" onClick={() => { setPlaying(false); setI(Math.max(0, i - 1)) }}>◀</button>
          <button className="iconbtn big on" onClick={() => { if (i >= frames.length - 1) setI(0); setPlaying(!playing) }}>{playing ? '❚❚' : '▶'}</button>
          <button className="iconbtn" onClick={() => { setPlaying(false); setI(Math.min(frames.length - 1, i + 1)) }}>▶</button>
          <button className="iconbtn" onClick={() => { setPlaying(false); const nx = decisions.find((x) => x.k > i + 1); setI(nx ? nx.k - 1 : frames.length - 1) }} title="Décision suivante">⏭</button>
          <button className={'iconbtn' + (reveal ? ' on' : '')} onClick={() => setReveal(!reveal)} title="Voir toutes les cartes">👁</button>
        </div>
      </div>
    </div>
  )
}
