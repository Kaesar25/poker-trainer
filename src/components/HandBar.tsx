import { describeDetailed } from '../engine/evaluator'
import type { GameState } from '../engine/game'

const COLOR: Record<string, string> = { monster: 'var(--green)', strong: '#9fe8c4', medium: 'var(--gold)', weak: '#ffb86b', nothing: 'var(--muted)' }

export function HandBar({ state: s, heroIdx }: { state: GameState; heroIdx: number }) {
  const hero = s.players[heroIdx]
  if (!hero.cards.length || hero.folded || hero.out || s.street === 'idle') return null
  const d = describeDetailed(hero.cards, s.board)
  return (
    <div className="handbar">
      <span className="hb-dot" style={{ background: COLOR[d.strength] }} />
      <span className="hb-made" style={{ color: COLOR[d.strength] }}>{d.made}</span>
      {d.draws.map((x) => <span key={x} className="hb-draw">{x}</span>)}
      {d.nutsWarning && s.street !== 'showdown' && <span className="hb-warn">⚠ {d.nutsWarning}</span>}
    </div>
  )
}
