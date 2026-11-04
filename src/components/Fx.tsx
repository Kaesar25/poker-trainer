import { useEffect, useRef, useState } from 'react'
import type { GameState } from '../engine/game'
import { chipList } from './Chips'
import { sfx } from '../fx/sound'

interface Fly { id: number; x0: number; y0: number; x1: number; y1: number; colors: string[]; delay: number }
interface Burst { id: number; x: number; y: number }

/**
 * Visual effects layer for the table: chips flying to the pot when a street ends,
 * the pot flying to the winner, a gold burst and sounds.
 */
export function TableFx({ state: s, seatPos, heroIdx }: { state: GameState; seatPos: (i: number) => [number, number]; heroIdx: number }) {
  const prev = useRef<GameState | null>(null)
  const [flies, setFlies] = useState<Fly[]>([])
  const [bursts, setBursts] = useState<Burst[]>([])
  const idRef = useRef(1)

  useEffect(() => {
    const p = prev.current
    prev.current = s
    if (!p) return
    const add: Fly[] = []
    // street advanced (or showdown): previous bets fly to the center
    if (p.street !== s.street && p.street !== 'idle') {
      p.players.forEach((pl, i) => {
        if (pl.bet > 0) {
          const [x, y] = seatPos(i)
          add.push({ id: idRef.current++, x0: x + (50 - x) * 0.42, y0: y + (50 - y) * 0.45, x1: 50, y1: 44, colors: chipList(pl.bet).slice(0, 4), delay: i * 40 })
        }
      })
      if (add.length) sfx.chips()
    }
    // new deal
    if (s.handNumber !== p.handNumber) sfx.deal()
    // showdown: pot flies to winners + burst
    if (s.result && !p.result) {
      const winners = s.result.winners
      const total = winners.reduce((a, w) => a + w.amount, 0)
      const heroWon = winners.some((w) => w.playerId === s.players[heroIdx].id)
      winners.forEach((w, k) => {
        const i = s.players.findIndex((pl) => pl.id === w.playerId)
        if (i < 0) return
        const [x, y] = seatPos(i)
        for (let j = 0; j < 3; j++) add.push({ id: idRef.current++, x0: 50, y0: 44, x1: x, y1: y, colors: chipList(Math.round(w.amount / 3)).slice(0, 4), delay: 350 + k * 60 + j * 90 })
        setBursts((b) => [...b, { id: idRef.current++, x, y }])
      })
      if (total > 0) setTimeout(() => (heroWon ? sfx.win() : sfx.chip()), 400)
      if (!heroWon && s.players[heroIdx].folded === false && !s.players[heroIdx].out && s.players[heroIdx].showCards) setTimeout(() => sfx.lose(), 500)
    }
    // hero's turn
    if (s.acting === heroIdx && p.acting !== heroIdx && s.street !== 'showdown' && s.street !== 'idle') sfx.turn()
    // actions
    const last = s.history[s.history.length - 1]
    if (last && s.history.length !== p.history.length) {
      if (last.action === 'check') sfx.check()
      else if (last.action === 'fold') sfx.fold()
      else if (last.action !== 'sb' && last.action !== 'bb' && last.action !== 'ante') sfx.chip()
    }
    if (add.length) {
      setFlies((f) => [...f, ...add])
      setTimeout(() => setFlies((f) => f.filter((x) => !add.some((a) => a.id === x.id))), 1400)
    }
    if (s.result && !p.result) setTimeout(() => setBursts([]), 1600)
  }, [s, seatPos, heroIdx])

  return (
    <>
      {flies.map((f) => (
        <div key={f.id} className="fly" style={{ ['--x0' as any]: `${f.x0}%`, ['--y0' as any]: `${f.y0}%`, ['--x1' as any]: `${f.x1}%`, ['--y1' as any]: `${f.y1}%`, animationDelay: `${f.delay}ms` }}>
          <div className="stack-vis">{f.colors.map((c, i) => <div key={i} className="chip" style={{ ['--c' as any]: c, top: `${-i * 3}px` }} />)}</div>
        </div>
      ))}
      {bursts.map((b) => (
        <div key={b.id} className="burst" style={{ left: `${b.x}%`, top: `${b.y}%` }}>
          {Array.from({ length: 14 }).map((_, i) => <span key={i} style={{ ['--a' as any]: `${(i / 14) * 360}deg`, ['--d' as any]: `${60 + (i % 3) * 25}px`, animationDelay: `${350 + (i % 4) * 30}ms` }} />)}
        </div>
      ))}
    </>
  )
}
