import { useState } from 'react'
import { badges, weeklyChallenges } from '../engine/challenges'
import type { Store } from '../store'

function ics(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1)
  const p = (n: number) => String(n).padStart(2, '0')
  const dt = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(h)}${p(m)}00`
  const url = location.href.split('#')[0]
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Poker Trainer//FR', 'BEGIN:VEVENT',
    `UID:poker-trainer-daily-${Date.now()}@kaesar25`, `DTSTAMP:${dt}`, `DTSTART:${dt}`, 'DURATION:PT10M', 'RRULE:FREQ=DAILY',
    'SUMMARY:♠ Poker Trainer · séance du jour', `DESCRIPTION:10 questions + quelques casse-tête pour garder ta série. ${url}`, `URL:${url}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Séance du jour', 'TRIGGER:PT0M', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n')
}

export function Challenges({ store, onBack, onClaim }: { store: Store; onBack: () => void; onClaim: (key: string, xp: number) => void }) {
  const wk = weeklyChallenges(store)
  const bs = badges(store)
  const [time, setTime] = useState('19:00')
  const days = Math.max(0, Math.ceil((wk.ends - Date.now()) / 86400000))
  const download = () => {
    try {
      const blob = new Blob([ics(time)], { type: 'text/calendar' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'poker-trainer-rappel.ics'
      document.body.appendChild(a); a.click(); a.remove()
    } catch { /* ignore */ }
  }
  return (
    <div className="screen">
      <button className="ghost" style={{ alignSelf: 'flex-start' }} onClick={onBack}>← Retour</button>
      <h2>Défis et badges</h2>
      <div className="l hint" style={{ textAlign: 'left' }}>Défis de la semaine · encore {days} jour{days > 1 ? 's' : ''}</div>
      {wk.list.map((c) => {
        const done = c.progress >= c.goal
        return (
          <div key={c.id} className={'challenge' + (done ? ' done' : '')}>
            <div className="ch-i">{c.icon}</div>
            <div style={{ flex: 1 }}>
              <div className="ch-t">{c.title} <span className="ch-xp">+{c.xp} XP</span></div>
              <div className="ch-d">{c.desc}</div>
              <div className="bar" style={{ marginTop: 6 }}><div style={{ width: `${Math.min(100, (c.progress / c.goal) * 100)}%`, background: done ? 'var(--green)' : undefined }} /></div>
            </div>
            {done && !store.claimed.includes(`${wk.key}:${c.id}`)
              ? <button className="primary ch-claim" onClick={() => onClaim(`${wk.key}:${c.id}`, c.xp)}>+{c.xp} XP</button>
              : <div className="ch-p">{done ? '✓' : `${Math.min(c.progress, c.goal)}/${c.goal}`}</div>}
          </div>
        )
      })}
      <div className="l hint" style={{ textAlign: 'left', marginTop: 8 }}>Badges · {bs.filter((b) => b.unlocked).length}/{bs.length}</div>
      <div className="badges">
        {bs.map((b) => (
          <div key={b.id} className={'badge-card' + (b.unlocked ? ' on' : '')}>
            <div className="bc-i">{b.icon}</div>
            <div className="bc-t">{b.title}</div>
            <div className="bc-d">{b.desc}</div>
            {!b.unlocked && b.progress && <div className="bc-p">{b.progress}</div>}
          </div>
        ))}
      </div>
      <div className="stat">
        <div className="l" style={{ marginBottom: 6 }}>Rappel quotidien</div>
        <div className="d" style={{ marginBottom: 8 }}>Ajoute un rappel à ton calendrier (iPhone, Google…) pour ne pas casser ta série. Il ouvre l'app d'un toucher.</div>
        <div className="row" style={{ alignItems: 'center' }}>
          <input className="num" type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ flex: 1 }} />
          <button className="primary" style={{ flex: 2 }} onClick={download}>Ajouter au calendrier</button>
        </div>
      </div>
    </div>
  )
}
