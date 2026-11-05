import { useState } from 'react'
import type { Advice } from '../engine/coach'
import { useIsPhone } from '../hooks/useMedia'

export function CoachPanel({ advice, position }: { advice: Advice; position: string }) {
  const phone = useIsPhone()
  const [open, setOpen] = useState(false)
  const pct = (x: number) => Math.round(x * 100)
  const eqColor = advice.equity >= 0.6 ? 'var(--green)' : advice.equity >= 0.4 ? 'var(--gold)' : 'var(--red)'
  if (phone) {
    return (
      <button className={'coach mini' + (open ? ' open' : '')} onClick={() => setOpen((v) => !v)}>
        <div className="cm-row">
          <span style={{ color: 'var(--gold)' }}>◆</span>
          <span className={'advice ' + advice.action}>{advice.title}</span>
          <span className="cm-pill" style={{ color: eqColor }}>{pct(advice.equity)} %</span>
          {advice.potOdds > 0 && <span className="cm-pill">cote {pct(advice.potOdds)} %</span>}
          <span className="cm-more">{open ? '▴' : 'pourquoi ▾'}</span>
        </div>
        {open && <div className="why">{advice.reason}</div>}
      </button>
    )
  }
  return (
    <div className="coach">
      <div className="head">
        <span style={{ color: 'var(--gold)' }}>◆</span>
        <span className="t">Coach</span>
        <span className="pos">{position}</span>
      </div>
      <div className="meters">
        <div className="meter">
          <div className="l"><span>Équité</span><span>{pct(advice.equity)} %</span></div>
          <div className="bar"><div style={{ width: `${pct(advice.equity)}%`, background: eqColor }} /></div>
        </div>
        <div className="meter">
          <div className="l"><span>Cote du pot</span><span>{advice.potOdds ? pct(advice.potOdds) + ' %' : '—'}</span></div>
          <div className="bar"><div style={{ width: `${pct(advice.potOdds)}%`, background: 'var(--blue)' }} /></div>
        </div>
      </div>
      <div className="txt">
        <div className={'advice ' + advice.action}>{advice.title}</div>
        <div className="why">{advice.reason}</div>
      </div>
    </div>
  )
}
