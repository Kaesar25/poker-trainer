import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameState } from '../engine/game'
import { totalPot } from '../engine/game'
import { positionOf } from '../engine/coach'
import { CardView } from './CardView'
import { Chips } from './Chips'
import { Seat } from './Seat'
import { TableFx } from './Fx'
import { useIsPhone } from '../hooks/useMedia'

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
  7: [[50, 86], [15, 66], [13, 38], [30, 12], [70, 12], [87, 38], [85, 66]],
  8: [[50, 86], [16, 70], [13, 46], [24, 19], [50, 8], [76, 19], [87, 46], [84, 70]],
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
  compact?: boolean
  children?: React.ReactNode
}

export function Table({ state: s, heroIdx, showLog, tournament, compact, children }: Props) {
  const n = s.players.length
  const portrait = usePortrait()
  const phone = useIsPhone()
  const phonePortrait = phone && portrait
  const baseLayout = (portrait ? PORTRAIT : LAYOUTS)[Math.min(8, Math.max(2, n))] ?? LAYOUTS[6]
  // Phone portrait: seats sit on the rail of a tall oval, evenly spaced, hero at the bottom.
  const layout: [number, number][] = phonePortrait
    ? Array.from({ length: n }, (_, k) => {
        if (k === 0) return [50, 97] as [number, number]
        // opponents spread over the oval, leaving a gap at the bottom for the hero strip
        const gap = (70 * Math.PI) / 180
        const span = 2 * Math.PI - gap
        const a = Math.PI / 2 + gap / 2 + (n === 2 ? span / 2 : ((k - 1) * span) / (n - 2))
        return [50 + 42 * Math.cos(a), 50 + 44 * Math.sin(a)] as [number, number]
      })
    : baseLayout
  const seatPos = useCallback((i: number): [number, number] => layout[(i - heroIdx + n) % n] ?? [50, 50], [layout, heroIdx, n])
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
    <div className={'table-wrap' + (compact ? ' compact' : '') + (phonePortrait ? ' phone' : '')}>
      <div className="table">
        <div className="felt-light" />
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
          if (phonePortrait && i === heroIdx) return null
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
              compactSeat={phonePortrait}
            />
          )
        })}
        {s.players.map((p, i) => {
          if (p.bet <= 0) return null
          const rel = (i - heroIdx + n) % n
          const [x, y] = layout[rel]
          const cx = phonePortrait && i === heroIdx ? 50 : x + (50 - x) * (phonePortrait ? 0.38 : portrait ? 0.5 : 0.42)
          const cy = phonePortrait && i === heroIdx ? 82 : y + (50 - y) * (phonePortrait ? 0.36 : portrait ? 0.42 : 0.45)
          return <Chips key={`c${p.id}-${p.bet}`} amount={p.bet} x={cx} y={cy} />
        })}
        {!compact && <TableFx state={s} seatPos={seatPos} heroIdx={heroIdx} />}
        {children}
      </div>
      {phonePortrait && (
        <Seat
          player={hero}
          x={50}
          y={50}
          isHero
          isDealer={s.dealer === heroIdx}
          isActing={s.acting === heroIdx}
          handNumber={s.handNumber}
          bb={s.blinds.bb}
          winAmount={winBy(hero.id) || undefined}
          description={s.result?.descriptions[hero.id]}
          position={s.street !== 'idle' && !hero.out ? positionOf(s, heroIdx) : undefined}
          compactSeat
          strip
        />
      )}
    </div>
  )
}
