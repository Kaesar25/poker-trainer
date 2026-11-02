import { useState } from 'react'
import type { HandRecord } from '../engine/stats'
import { CardView } from './CardView'

const MODE: Record<string, string> = { cash: 'Cash', sng: 'SNG', chipleader: 'Chip leader' }
const ACT: Record<string, string> = { fold: 'fold', check: 'check', call: 'call', bet: 'mise', raise: 'relance', allin: 'tapis', sb: 'SB', bb: 'BB', ante: 'ante' }

export function History({ hands, onBack }: { hands: HandRecord[]; onBack: () => void }) {
  const [open, setOpen] = useState<string | null>(null)
  const list = hands.slice().reverse()
  return (
    <div className="screen">
      <button className="ghost" style={{ alignSelf: 'flex-start' }} onClick={onBack}>← Accueil</button>
      <h2>Historique des mains</h2>
      {list.length === 0 && <div className="empty">Aucune main jouée pour l'instant. Lance une partie !</div>}
      {list.map((h) => {
        const names = Object.fromEntries(h.players.map((p) => [p.id, p.name]))
        return (
          <div className="hand" key={h.id} onClick={() => setOpen(open === h.id ? null : h.id)}>
            <div className="top">
              <div className="mini">{h.heroCards.map((c, i) => <CardView key={i} card={c} />)}</div>
              <div className="mini">{h.board.map((c, i) => <CardView key={i} card={c} />)}</div>
              <div className={'delta ' + (h.heroDelta >= 0 ? 'pos' : 'neg')}>{h.heroDelta >= 0 ? '+' : ''}{h.heroDelta}</div>
            </div>
            <div className="sub">{MODE[h.mode]} · {h.position} · blinds {h.blinds.sb}/{h.blinds.bb} · {h.showdown ? 'abattage' : 'sans abattage'} · {h.winners.map((w) => `${w.name}${w.hand ? ` (${w.hand})` : ''}`).join(', ')}</div>
            {open === h.id && (
              <div className="detail">
                {(['preflop', 'flop', 'turn', 'river'] as const).map((st) => {
                  const acts = h.actions.filter((a) => a.street === st)
                  if (!acts.length) return null
                  return <div key={st}><b style={{ color: 'var(--gold)' }}>{st}</b> — {acts.map((a) => `${names[a.playerId] ?? a.playerId} ${ACT[a.action]}${a.amount && a.action !== 'fold' && a.action !== 'check' ? ` ${a.amount}` : ''}`).join(' · ')}</div>
                })}
                {h.players.filter((p) => p.cards).map((p) => <div key={p.id}>{p.name} montre {p.cards!.map((c) => (c.rank > 10 ? ['J', 'Q', 'K', 'A'][c.rank - 11] : c.rank) + ({ s: '♠', h: '♥', d: '♦', c: '♣' } as any)[c.suit]).join(' ')}</div>)}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
