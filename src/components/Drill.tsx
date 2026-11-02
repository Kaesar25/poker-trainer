import { useEffect, useRef, useState } from 'react'
import { DRILL_META, generate, type DrillType, type Question } from '../engine/drills'
import { CardView } from './CardView'

interface Props {
  questions: Question[] | null // null = endless of `type`
  type?: DrillType
  title: string
  onAnswer: (type: DrillType, ok: boolean, ms?: number) => void
  onExit: (summary: { asked: number; correct: number }) => void
}

export function Drill({ questions, type, title, onAnswer, onExit }: Props) {
  const [idx, setIdx] = useState(0)
  const [q, setQ] = useState<Question>(() => (questions ? questions[0] : generate(type!)))
  const [picked, setPicked] = useState<string | null>(null)
  const [score, setScore] = useState({ asked: 0, correct: 0 })
  const [left, setLeft] = useState<number | null>(q.timeLimit ?? null)
  const startRef = useRef(Date.now())
  const total = questions?.length

  useEffect(() => {
    if (!q.timeLimit || picked) return
    const id = setInterval(() => {
      const elapsed = (Date.now() - startRef.current) / 1000
      const l = Math.max(0, q.timeLimit! - elapsed)
      setLeft(l)
      if (l <= 0) { clearInterval(id); answer('__timeout') }
    }, 100)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, picked])

  const answer = (id: string) => {
    if (picked) return
    const ok = id === q.correct
    const ms = Date.now() - startRef.current
    setPicked(id)
    setScore((s) => ({ asked: s.asked + 1, correct: s.correct + (ok ? 1 : 0) }))
    onAnswer(q.type, ok, q.timeLimit ? ms : undefined)
  }

  const next = () => {
    const n = idx + 1
    if (total && n >= total) { onExit({ asked: score.asked, correct: score.correct }); return }
    setIdx(n)
    setQ(questions ? questions[n] : generate(type!))
    setPicked(null)
    startRef.current = Date.now()
    setLeft(questions ? questions[n].timeLimit ?? null : generate(type!).timeLimit ?? null)
  }

  const meta = DRILL_META[q.type]
  const ok = picked === q.correct
  return (
    <div className="drill">
      <div className="drill-top">
        <button className="ghost" onClick={() => onExit(score)}>✕ Quitter</button>
        <div className="drill-title">{title}</div>
        <div className="drill-score">{score.correct}/{score.asked}{total ? ` · ${idx + 1}/${total}` : ''}</div>
      </div>
      {total ? <div className="progress"><div style={{ width: `${(idx / total) * 100}%` }} /></div> : null}
      <div className="qcard" key={idx}>
        <div className="qkind"><span className="qicon">{meta.icon}</span>{meta.name}{left !== null && !picked ? <span className={'timer' + (left < 5 ? ' hot' : '')}>{Math.ceil(left)} s</span> : null}</div>
        <div className="qprompt">{q.prompt}</div>
        {(q.cards || q.board) && (
          <div className="qcards">
            {q.cards && <div className="qgroup"><div className="ql">Ta main</div><div className="row-cards hero-cards">{q.cards.map((c, i) => <CardView key={i} card={c} anim="deal" delay={i * 80} />)}</div></div>}
            {q.board && <div className="qgroup"><div className="ql">Board</div><div className="row-cards">{q.board.map((c, i) => <CardView key={i} card={c} anim="flip" delay={i * 80} />)}</div></div>}
          </div>
        )}
        {q.facts && <div className="facts">{q.facts.map((f) => <div key={f.l} className="fact"><div className="fl">{f.l}</div><div className="fv">{f.v}</div></div>)}</div>}
        <div className="qoptions">
          {q.options.map((o) => {
            const cls = ['opt', picked ? (o.id === q.correct ? 'right' : o.id === picked ? 'wrong' : 'dim') : ''].join(' ')
            return <button key={o.id} className={cls} onClick={() => answer(o.id)} disabled={!!picked}>{o.label}</button>
          })}
        </div>
        {picked && (
          <div className={'feedback ' + (ok ? 'ok' : 'ko')}>
            <div className="fb-title">{ok ? 'Bien joué' : picked === '__timeout' ? 'Trop lent' : 'Raté'}</div>
            <div className="fb-text">{q.explanation}</div>
            <button className="primary" onClick={next}>{total && idx + 1 >= total ? 'Voir le résultat' : 'Question suivante →'}</button>
          </div>
        )}
      </div>
    </div>
  )
}
