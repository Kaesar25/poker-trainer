import { useMemo, useState } from 'react'
import { generatePuzzle, type Puzzle as P } from '../engine/puzzles'
import { Table } from './Table'
import { CardView } from './CardView'
import type { Store } from '../store'

export function PuzzleScreen({ store, onResult, onBack }: { store: Store; onResult: (ok: boolean) => void; onBack: () => void }) {
  const [n, setN] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const streak = store.puzzles.streak
  const puzzle: P = useMemo(() => generatePuzzle(streak), [n, streak])
  const ok = picked === puzzle.correct
  const answer = (id: string) => { if (picked) return; setPicked(id); onResult(id === puzzle.correct) }
  const next = () => { setPicked(null); setN((x) => x + 1) }
  return (
    <div className="puzzle">
      <div className="drill-top">
        <button className="ghost" onClick={onBack}>✕ Quitter</button>
        <div className="drill-title">Casse-tête</div>
        <div className="drill-score">🔥 {streak} · record {store.puzzles.best} · {store.puzzles.solved}/{store.puzzles.asked}</div>
      </div>
      {puzzle.kind === 'live' && puzzle.state && (
        <div className="puzzle-table">
          <Table state={puzzle.state} heroIdx={0} showLog={false} tournament={false} compact />
        </div>
      )}
      <div className="qcard">
        <div className="qkind"><span className="qicon">♟</span>{puzzle.title}<span className="badge pos" style={{ marginLeft: 'auto' }}>{'★'.repeat(puzzle.difficulty)}</span></div>
        <div className="qprompt" style={{ fontSize: 15, fontWeight: 500 }}>{puzzle.context}</div>
        {puzzle.kind === 'icm' && puzzle.question?.facts && <div className="facts">{puzzle.question.facts.map((f) => <div key={f.l} className="fact"><div className="fl">{f.l}</div><div className="fv">{f.v}</div></div>)}</div>}
        {puzzle.kind === 'live' && puzzle.state && (
          <div className="qcards">
            <div className="qgroup"><div className="ql">Ta main</div><div className="row-cards hero-cards">{puzzle.state.players[0].cards.map((c, i) => <CardView key={i} card={c} />)}</div></div>
            {puzzle.state.board.length > 0 && <div className="qgroup"><div className="ql">Board</div><div className="row-cards">{puzzle.state.board.map((c, i) => <CardView key={i} card={c} />)}</div></div>}
          </div>
        )}
        <div className="qoptions">
          {puzzle.options.map((o) => {
            const cls = ['opt', picked ? (o.id === puzzle.correct ? 'right' : o.id === picked ? 'wrong' : 'dim') : ''].join(' ')
            return <button key={o.id} className={cls} onClick={() => answer(o.id)} disabled={!!picked}>{o.label}</button>
          })}
        </div>
        {picked && (
          <div className={'feedback ' + (ok ? 'ok' : 'ko')}>
            <div className="fb-title">{ok ? 'Bien vu' : 'Pas ça'}</div>
            <div className="fb-text">{puzzle.explanation}</div>
            <button className="primary" onClick={next}>Casse-tête suivant →</button>
          </div>
        )}
      </div>
    </div>
  )
}
