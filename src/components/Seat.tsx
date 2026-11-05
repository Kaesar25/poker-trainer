import type { Player } from '../engine/game'
import { CardView } from './CardView'

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #e9d48a, #8f7322)',
  'linear-gradient(135deg, #4f8fe0, #1f3c8f)',
  'linear-gradient(135deg, #e04f4f, #7a1f1f)',
  'linear-gradient(135deg, #8d6cf0, #3f2a8a)',
  'linear-gradient(135deg, #35d08a, #166b45)',
  'linear-gradient(135deg, #f08a4f, #8a3f1a)',
  'linear-gradient(135deg, #4fd0e0, #1a6b7a)',
]

interface Props {
  player: Player
  x: number
  y: number
  isHero: boolean
  isDealer: boolean
  isActing: boolean
  handNumber: number
  bb: number
  winAmount?: number
  description?: string
  coverage?: 'covers' | 'covered' | null
  position?: string
  compactSeat?: boolean
  strip?: boolean
}

export function Seat({ player: p, x, y, isHero, isDealer, isActing, handNumber, bb, winAmount, description, coverage, position, compactSeat, strip }: Props) {
  const cls = ['seat', isHero ? 'hero' : '', compactSeat ? 'mini' : '', strip ? 'strip' : '', isActing ? 'acting' : '', p.folded ? 'folded' : '', p.out ? 'out' : '', winAmount ? 'winner' : '', coverage ? 'cv-' + coverage : '', p.allIn && !p.out ? 'is-allin' : ''].join(' ')
  const showCards = p.cards.length > 0 && !p.folded && !p.out
  const initials = p.name.slice(0, 2).toUpperCase()
  const cards = (big: boolean) => (
    <div className={'cards' + (big ? ' hero-cards' : '')}>
      {showCards ? p.cards.map((c, i) => <CardView key={`${handNumber}-${i}`} card={c} hidden={!isHero && !p.showCards} anim={p.showCards && !isHero ? 'flip' : 'deal'} delay={i * 90} />) : null}
    </div>
  )
  const bbs = bb > 0 ? Math.round(p.stack / bb) : 0
  if (compactSeat) {
    // Phone layout: avatar on top, stack under it, cards tucked on the avatar, coverage shown by ring colour.
    return (
      <div className={cls} style={strip ? undefined : { left: `${x}%`, top: `${y}%` }}>
        {isHero && cards(true)}
        <div className="mini-av">
          <div className="avatar" style={{ background: AVATAR_GRADIENTS[p.id % AVATAR_GRADIENTS.length] }}>{initials}</div>
          {!isHero && cards(false)}
          {isDealer && <div className="dealer-btn">D</div>}
          {position && !p.out && <span className="mini-pos">{position}</span>}
        </div>
        <div className="mini-txt">
          <div className="name">{p.name}</div>
          <div className="stack">{p.out ? 'Out' : bbs >= 1 ? `${bbs} BB` : p.stack}</div>
        </div>
        {winAmount ? <span className="badge winb">+{winAmount}{description ? ` · ${description}` : ''}</span> : p.allIn && !p.out ? <span className="badge allin">TAPIS</span> : null}
      </div>
    )
  }
  return (
    <div className={cls} style={{ left: `${x}%`, top: `${y}%` }}>
      {!isHero && cards(false)}
      <div className="plate">
        <div className="avatar" style={{ background: AVATAR_GRADIENTS[p.id % AVATAR_GRADIENTS.length] }}>{initials}</div>
        <div className="txt">
          <div className="name">{p.name}</div>
          <div className="stack">{p.out ? 'Out' : p.stack}{!p.out && bb > 0 ? <small>{bbs} BB</small> : null}</div>
        </div>
        {isDealer && <div className="dealer-btn">D</div>}
      </div>
      <div style={{ display: 'flex', gap: 4, minHeight: 18 }}>
        {winAmount ? <span className="badge winb">+{winAmount}{description ? ` · ${description}` : ''}</span> : null}
        {position && !p.out && !winAmount ? <span className="badge pos">{position}</span> : null}
        {winAmount ? null : p.allIn && !p.out ? <span className="badge allin">TAPIS</span> : coverage === 'covers' ? <span className="badge cover">Te couvre</span> : coverage === 'covered' ? <span className="badge covered">Couvert</span> : null}
      </div>
      {isHero && cards(true)}
    </div>
  )
}
