import { RANK_LABEL, SUIT_SYMBOL, type Card } from '../engine/cards'

export function CardView({ card, hidden, placeholder, anim, delay = 0 }: { card?: Card; hidden?: boolean; placeholder?: boolean; anim?: 'deal' | 'flip'; delay?: number }) {
  if (placeholder) return <div className="card placeholder" />
  const style = { animationDelay: `${delay}ms` }
  if (hidden || !card) return <div className={'card back' + (anim ? ' ' + anim : '')} style={style} />
  const red = card.suit === 'h' || card.suit === 'd'
  return (
    <div className={'card' + (red ? ' red' : '') + (anim ? ' ' + anim : '')} style={style}>
      <span className="r">{RANK_LABEL[card.rank]}<small>{SUIT_SYMBOL[card.suit]}</small></span>
      <span className="big">{SUIT_SYMBOL[card.suit]}</span>
    </div>
  )
}
