import { useEffect, useState } from 'react'
import { legalActions, totalPot, type Action, type GameState } from '../engine/game'
import type { Advice } from '../engine/coach'

interface Props {
  state: GameState
  onAction: (a: Action) => void
  onNext: () => void
  heroIdx: number
  advice: Advice | null
  over: boolean
}

export function Controls({ state: s, onAction, onNext, heroIdx, advice, over }: Props) {
  const heroTurn = s.acting === heroIdx && s.street !== 'showdown' && s.street !== 'idle'
  const la = heroTurn ? legalActions(s, heroIdx) : null
  const [raiseTo, setRaiseTo] = useState(0)
  const pot = totalPot(s)

  useEffect(() => {
    if (la) setRaiseTo(advice?.amount && (advice.action === 'raise' || advice.action === 'bet') ? Math.min(la.maxRaiseTo, Math.max(la.minRaiseTo, advice.amount)) : la.minRaiseTo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.acting, s.street, s.handNumber, advice?.amount])

  if (s.street === 'showdown' || s.street === 'idle') {
    const alive = s.players.filter((p) => !p.out).length
    return (
      <div className="controls">
        <div className="row">
          <button className="btn next" onClick={onNext} disabled={alive < 2 || over}>
            {alive < 2 || over ? 'Terminé' : 'Main suivante →'}
          </button>
        </div>
      </div>
    )
  }

  if (!heroTurn || !la) {
    return (
      <div className="controls">
        <div className="thinking">{s.players[s.acting]?.name} réfléchit <span className="dots"><span /><span /><span /></span></div>
        <div className="row">
          <button className="btn fold" disabled>Fold</button>
          <button className="btn call" disabled>Call</button>
          <button className="btn raise" disabled>Raise</button>
        </div>
      </div>
    )
  }

  const hero = s.players[heroIdx]
  const presets: [string, number][] = [
    ['½ pot', Math.round(s.currentBet + (pot + la.callAmount) / 2)],
    ['¾', Math.round(s.currentBet + (pot + la.callAmount) * 0.75)],
    ['Pot', Math.round(s.currentBet + pot + la.callAmount)],
    ['Tapis', la.maxRaiseTo],
  ]
  const clamp = (v: number) => Math.min(la.maxRaiseTo, Math.max(la.minRaiseTo, v))
  const raiseLabel = s.currentBet === 0 ? 'Miser' : 'Relancer à'
  const isAllIn = raiseTo >= la.maxRaiseTo
  const hl = (k: string) => (advice && (advice.action === k || (k === 'raise' && (advice.action === 'bet' || advice.action === 'allin')) || (k === 'call' && advice.action === 'check')) ? ' hint-on' : '')

  return (
    <div className="controls">
      {la.canRaise && (
        <div className="sizing">
          {presets.map(([l, v]) => (
            <button key={l} className={'chipbtn' + (clamp(v) === raiseTo ? ' on' : '')} onClick={() => setRaiseTo(clamp(v))}>{l}</button>
          ))}
          <input type="range" min={la.minRaiseTo} max={la.maxRaiseTo} step={Math.max(1, s.blinds.sb)} value={raiseTo} onChange={(e) => setRaiseTo(clamp(Number(e.target.value)))} />
          <span className="amt">{raiseTo}</span>
        </div>
      )}
      <div className="row">
        <button className={'btn fold' + hl('fold')} onClick={() => onAction({ type: 'fold' })}>Fold</button>
        {la.canCheck ? (
          <button className={'btn call' + hl('call')} onClick={() => onAction({ type: 'check' })}>Check</button>
        ) : (
          <button className={'btn call' + hl('call')} onClick={() => onAction({ type: 'call' })}>
            {la.callAmount >= hero.stack ? `Tapis ${la.callAmount}` : `Call ${la.callAmount}`}
          </button>
        )}
        <button className={'btn raise' + hl('raise')} disabled={!la.canRaise} onClick={() => onAction(isAllIn ? { type: 'allin' } : { type: s.currentBet === 0 ? 'bet' : 'raise', amount: raiseTo })}>
          {isAllIn ? `Tapis ${la.maxRaiseTo}` : `${raiseLabel} ${raiseTo}`}
        </button>
      </div>
      <div className="hint">Pot {pot} · {la.callAmount > 0 ? `cote du pot ${Math.round((la.callAmount / (pot + la.callAmount)) * 100)} %` : 'parole'} · {Math.round(hero.stack / s.blinds.bb)} BB</div>
    </div>
  )
}
