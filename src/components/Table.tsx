import { useEffect, useRef, useState } from 'react'
import type { GameState } from '../engine/game'
import { totalPot } from '../engine/game'
import { positionOf } from '../engine/coach'
import { CardView } from './CardView'
import { Chips } from './Chips'
import { Seat } from './Seat'

const LAYOUTS: Record<number, [number, number][]> = {
  2: [[50, 84], [50, 16]],
  3: [[50, 84], [15, 32], [85, 32]],
  4: [[50, 84], [10, 50], [50, 13], [90, 50]],
  5: [[50, 84], [11, 64], [22, 17], [78, 17], [89, 64]],
  6: [[50, 84], [9, 66], [16, 21], [50, 11], [84, 21], [91, 66]],
  7: [[50, 84], [8, 64], [12, 26], [36, 11], [64, 11], [88, 26], [92, 64]],
  8: [[50, 84], [10, 72], [7, 42], [22, 15], [50, 10], [78, 15], [93, 42], [90, 72]],
}
const PORTRAIT: Record<number, [number, number][]> = {
  2: [[50, 86], [50, 12]],
  3: [[50, 86], [18, 30], [82, 30]],
  4: [[50, 86], [12, 55], [50, 10], [88, 55]],
  5: [[50, 86], [12, 62], [18, 22], [82, 22], [88, 62]],
  6: [[50, 86], [12, 64], [14, 28], [50, 9], [86, 28], [88, 64]],
  7: [[50, 86], [12, 66], [10, 38], [28, 12], [72, 12], [90, 38], [88, 66]],
  8: [[50, 86], [12, 70], [8, 46], [20, 20], [50, 8], [80, 20], [92, 46], [88, 70]],
}

function usePortrait() {
  const [p, setP] = useState(() => window.matchMedia('(orientation: portrait)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait)')
    const h = () => setP(mq.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])
  return p
}

interface Props {
  state: GameState
  heroIdx: number
  showLog: boolean
  tournament: boolean
  children?: React.ReactNode
}

export function Table({ state: s, heroIdx, showLog, tournament, children }: Props) {
  const n = s.players.length
  const portrait = usePortrait()
  const layout = (portrait ? PORTRAIT : LAYOUTS)[n] ?? LAYOUTS[6]
  const pot = totalPot(s)
  const winners = s.result?.winners ?? []
  const winBy = (id: number) => winners.filter((w) => w.playerId === id).reduce((a, w) => a + w.amount, 0)
  const hero = s.players[heroIdx]

  // pot bump animation
  const prevPot = useRef(pot)
  const [bump, setBump] = useState(false)
  useEffect(() => {
    if (pot !== prevPot.current) { setBump(true); const t = setTimeout(() => setBump(false), 350); prevPot.current = pot; return () => clearTimeout(t) }
  }, [pot])

  return (
    <div className="table-wrap">
      <div className="table">
        <div className="logo">POKER TRAINER</div>
        {showLog && <div className="log">{s.log.slice(-10).map((l, i) => <div key={i}>{l}</div>)}</div>}
        <div className="center">
          <div className={'pot' + (bump ? ' bump' : '')}>
            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>POT</span> {pot}
          </div>
          <div className="board">
            {[0, 1, 2, 3, 4].map((i) => (s.board[i] ? <CardView key={`${s.handNumber}-${i}`} card={s.board[i]} anim="flip" delay={(i % 3) * 120} /> : <CardView key={`ph-${i}`} placeholder />))}
          </div>
        </div>
        {s.players.map((p, i) => {
          const rel = (i - heroIdx + n) % n
          const [x, y] = layout[rel]
          const coverage = tournament && !p.out && i !== heroIdx && !hero.out ? (p.stack + p.bet > hero.stack + hero.bet ? 'covers' : 'covered') : null
          return (
            <Seat
              key={p.id}
              player={p}
              x={x}
              y={y}
              isHero={i === heroIdx}
              isDealer={s.dealer === i}
              isActing={s.acting === i}
              handNumber={s.handNumber}
              bb={s.blinds.bb}
              winAmount={winBy(p.id) || undefined}
              description={s.result?.descriptions[p.id]}
              coverage={coverage}
              position={s.street !== 'idle' && !p.out ? positionOf(s, i) : undefined}
            />
          )
        })}
        {s.players.map((p, i) => {
          if (p.bet <= 0) return null
          const rel = (i - heroIdx + n) % n
          const [x, y] = layout[rel]
          const cx = x + (50 - x) * (portrait ? 0.5 : 0.42)
          const cy = y + (50 - y) * (portrait ? 0.42 : 0.45)
          return <Chips key={`c${p.id}-${p.bet}`} amount={p.bet} x={cx} y={cy} />
        })}
        {children}
      </div>
    </div>
  )
}
