import { useEffect, useState } from 'react'
import { legalActions, totalPot, type Action, type GameState } from '../engine/game'
import type { Advice } from '../engine/coach'
import { useIsPhone } from '../hooks/useMedia'

interface Props {
  state: GameState
  onAction: (a: Action) => void
  onNext: () => void
  heroIdx: number
  advice: Advice | null
  over: boolean
  autoNextMs?: number | null
}

type Pre = 'checkfold' | 'check' | 'callany' | null

export function Controls({ state: s, onAction, onNext, heroIdx, advice, over, autoNextMs }: Props) {
  const [pre, setPre] = useState<Pre>(null)
  const heroTurn = s.acting === heroIdx && s.street !== 'showdown' && s.street !== 'idle'
  const la = heroTurn ? legalActions(s, heroIdx) : null
  const [raiseTo, setRaiseTo] = useState(0)
  const [sheet, setSheet] = useState(false)
  const phone = useIsPhone()
  const pot = totalPot(s)

  // pre-actions: reset when a new street or hand starts, or when someone bets into a "check" pre-action
  useEffect(() => { setPre(null) }, [s.handNumber])
  useEffect(() => { setPre((p) => (p === 'check' && s.currentBet > s.players[heroIdx].bet ? null : p)) }, [s.currentBet])
  useEffect(() => {
    if (!heroTurn || !la || !pre) return
    const p = pre
    setPre(null)
    if (p === 'checkfold') onAction(la.canCheck ? { type: 'check' } : { type: 'fold' })
    else if (p === 'check' && la.canCheck) onAction({ type: 'check' })
    else if (p === 'callany') onAction(la.canCheck ? { type: 'check' } : { type: 'call' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heroTurn, s.acting, s.street])

  useEffect(() => {
    setSheet(false)
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
            {autoNextMs && !over && alive >= 2 ? <span className="autobar" key={s.handNumber} style={{ animationDuration: `${autoNextMs}ms` }} /> : null}
          </button>
        </div>
      </div>
    )
  }

  if (!heroTurn || !la) {
    const me = s.players[heroIdx]
    const inHand = !me.folded && !me.out && !me.allIn
    const facing = s.currentBet > me.bet
    const preBtn = (k: Exclude<Pre, null>, label: string) => <button className={'prebtn' + (pre === k ? ' on' : '')} onClick={() => setPre(pre === k ? null : k)}><i />{label}</button>
    return (
      <div className="controls waiting">
        <div className="thinking">{s.players[s.acting]?.name} réfléchit <span className="dots"><span /><span /><span /></span></div>
        {inHand && (
          <div className="pre-row">
            {preBtn('checkfold', facing ? 'Fold' : 'Check / Fold')}
            {!facing && preBtn('check', 'Check')}
            {preBtn('callany', facing ? `Suivre ${Math.min(me.stack, s.currentBet - me.bet)}` : 'Suivre tout')}
          </div>
        )}
        {!phone && (
          <div className="row">
            <button className="btn fold" disabled>Fold</button>
            <button className="btn call" disabled>Call</button>
            <button className="btn raise" disabled>Raise</button>
          </div>
        )}
      </div>
    )
  }

  const hero = s.players[heroIdx]
  const presets: [string, number][] = [
    ['½ pot', Math.round(s.currentBet + (pot + la.callAmount) / 2)],
    ['¾ pot', Math.round(s.currentBet + (pot + la.callAmount) * 0.75)],
    ['Pot', Math.round(s.currentBet + pot + la.callAmount)],
    ['Tapis', la.maxRaiseTo],
  ]
  if (s.street === 'preflop') presets.splice(0, 2, ['2,5 BB', Math.round(s.blinds.bb * 2.5)], ['3 BB', s.blinds.bb * 3])
  const clamp = (v: number) => Math.min(la.maxRaiseTo, Math.max(la.minRaiseTo, v))
  const raiseLabel = s.currentBet === 0 ? 'Miser' : 'Relancer'
  const isAllIn = raiseTo >= la.maxRaiseTo
  const hl = (k: string) => (advice && (advice.action === k || (k === 'raise' && (advice.action === 'bet' || advice.action === 'allin')) || (k === 'call' && advice.action === 'check')) ? ' hint-on' : '')
  const doRaise = () => { setSheet(false); onAction(isAllIn ? { type: 'allin' } : { type: s.currentBet === 0 ? 'bet' : 'raise', amount: raiseTo }) }
  const bbOf = (v: number) => (v / s.blinds.bb).toFixed(v / s.blinds.bb >= 10 ? 0 : 1)

  const sizing = (
    <div className="sizing">
      {presets.map(([l, v]) => (
        <button key={l} className={'chipbtn' + (clamp(v) === raiseTo ? ' on' : '')} onClick={() => setRaiseTo(clamp(v))}>{l}</button>
      ))}
      {!phone && <input type="range" min={la.minRaiseTo} max={la.maxRaiseTo} step={Math.max(1, s.blinds.sb)} value={raiseTo} onChange={(e) => setRaiseTo(clamp(Number(e.target.value)))} />}
      {!phone && <span className="amt">{raiseTo}</span>}
    </div>
  )

  if (phone) {
    return (
      <div className="controls phone">
        {sheet && la.canRaise && (
          <div className="raise-sheet">
            <div className="rs-head">
              <span>{raiseLabel} à</span>
              <b>{raiseTo}</b>
              <span className="rs-bb">{bbOf(raiseTo)} BB</span>
            </div>
            {sizing}
            <div className="rs-slider">
              <button className="chipbtn" onClick={() => setRaiseTo(clamp(raiseTo - s.blinds.bb))}>−</button>
              <input type="range" min={la.minRaiseTo} max={la.maxRaiseTo} step={Math.max(1, s.blinds.sb)} value={raiseTo} onChange={(e) => setRaiseTo(clamp(Number(e.target.value)))} />
              <button className="chipbtn" onClick={() => setRaiseTo(clamp(raiseTo + s.blinds.bb))}>+</button>
            </div>
            <div className="row">
              <button className="btn ghostbtn" onClick={() => setSheet(false)}>Annuler</button>
              <button className={'btn raise' + hl('raise')} onClick={doRaise}>{isAllIn ? `Tapis ${la.maxRaiseTo}` : `${raiseLabel} à ${raiseTo}`}</button>
            </div>
          </div>
        )}
        {!sheet && (
          <div className="row">
            <button className={'btn fold' + (la.canCheck ? ' soft' : '') + hl('fold')} onClick={() => onAction({ type: 'fold' })}>Fold</button>
            {la.canCheck ? (
              <button className={'btn call' + hl('call')} onClick={() => onAction({ type: 'check' })}>Check</button>
            ) : (
              <button className={'btn call' + hl('call')} onClick={() => onAction({ type: 'call' })}>
                <span>{la.callAmount >= hero.stack ? 'Tapis' : 'Call'}</span><small>{la.callAmount}</small>
              </button>
            )}
            <button className={'btn raise' + hl('raise')} disabled={!la.canRaise} onClick={() => setSheet(true)}>
              <span>{s.currentBet === 0 ? 'Miser' : 'Relancer'}</span><small>…</small>
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="controls">
      {la.canRaise && sizing}
      <div className="row">
        <button className={'btn fold' + hl('fold')} onClick={() => onAction({ type: 'fold' })}>Fold</button>
        {la.canCheck ? (
          <button className={'btn call' + hl('call')} onClick={() => onAction({ type: 'check' })}>Check</button>
        ) : (
          <button className={'btn call' + hl('call')} onClick={() => onAction({ type: 'call' })}>
            {la.callAmount >= hero.stack ? `Tapis ${la.callAmount}` : `Call ${la.callAmount}`}
          </button>
        )}
        <button className={'btn raise' + hl('raise')} disabled={!la.canRaise} onClick={doRaise}>
          {isAllIn ? `Tapis ${la.maxRaiseTo}` : `${raiseLabel}${s.currentBet === 0 ? '' : ' à'} ${raiseTo}`}
        </button>
      </div>
      <div className="hint">Pot {pot} · {la.callAmount > 0 ? `cote du pot ${Math.round((la.callAmount / (pot + la.callAmount)) * 100)} %` : 'parole'} · {Math.round(hero.stack / s.blinds.bb)} BB</div>
    </div>
  )
}
