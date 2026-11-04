import { useEffect, useState } from 'react'
import type { GameState } from '../engine/game'
import { currentLevelIndex, estimateRank, levelTimeLeft, structureOf, type Tournament } from '../engine/tournament'

function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function Hud({ state: s, tournament: t, mode, heroIdx, showLog, onToggleLog, coach, onToggleCoach, onQuit, playedMs, onPause, events, sound, onToggleSound }: {
  state: GameState; tournament: Tournament | null; mode: string; heroIdx: number; showLog: boolean; onToggleLog: () => void; coach: boolean; onToggleCoach: () => void; onQuit: () => void; playedMs: number; onPause: () => void; events?: { t: number; text: string }[]; sound?: boolean; onToggleSound?: () => void
}) {
  const [, tick] = useState(0)
  useEffect(() => {
    if (!t) return
    const id = setInterval(() => tick((x) => x + 1), 1000)
    return () => clearInterval(id)
  }, [t])
  const hero = s.players[heroIdx]
  const alive = s.players.filter((p) => !p.out)
  const rank = alive.filter((p) => p.stack > hero.stack).length + 1
  let levelInfo = null
  if (t) {
    const st = structureOf(t)
    const li = currentLevelIndex(t)
    const lvl = st.levels[li]
    const next = st.levels[Math.min(li + 1, st.levels.length - 1)]
    const left = levelTimeLeft(t)
    levelInfo = (
      <>
        <div className="m"><div className="l">Niveau {li + 1}</div><div className="v gold">{lvl.sb}/{lvl.bb}{lvl.ante ? ` · a${lvl.ante}` : ''}</div></div>
        <div className="m next"><div className="l">Suivant</div><div className="v">{next.sb}/{next.bb} dans {fmt(left)}</div></div>
        <div className="m"><div className="l">Restants</div><div className="v">{t.mode === 'marathon' ? `${t.field}/${t.entrants} · ≈${estimateRank(t, s, hero.stack)}e` : `${alive.length}/${t.entrants} · ${rank}${rank === 1 ? 'er' : 'e'}`}</div></div>
        {t.mode === 'marathon' && <div className="m next"><div className="l">Table</div><div className="v">n°{t.tableNumber ?? 1} · {rank}{rank === 1 ? 'er' : 'e'} ici</div></div>}
      </>
    )
  }
  const st = t ? structureOf(t) : null
  const progress = t && st ? 1 - levelTimeLeft(t) / (st.levelSeconds * 1000) : 0
  return (
    <>
      <div className="hud">
        <div className="title">{mode === 'cash' ? 'Cash game' : mode === 'sng' ? 'Sit & Go' : mode === 'marathon' ? 'Marathon' : 'Chip leader'}</div>
        <div className="meta">
          {levelInfo ?? (
            <>
              <div className="m"><div className="l">Blinds</div><div className="v gold">{s.blinds.sb}/{s.blinds.bb}</div></div>
              <div className="m"><div className="l">Main</div><div className="v">n°{s.handNumber}</div></div>
            </>
          )}
          <div className="m"><div className="l">Ton tapis</div><div className="v">{hero.stack} · {Math.round(hero.stack / s.blinds.bb)} BB</div></div>
          <div className="m next"><div className="l">Temps de jeu</div><div className="v">{fmt(playedMs)}</div></div>
        </div>
        <div className="actions">
          <button className={'ghost' + (coach ? ' on' : '')} onClick={onToggleCoach}>◆ Coach</button>
          {mode !== 'cash' && <button className="ghost" onClick={onPause} title="Pause">❚❚</button>}
          {onToggleSound && <button className={'ghost' + (sound ? ' on' : '')} onClick={onToggleSound} title="Son">{sound ? '🔊' : '🔇'}</button>}
          <button className={'ghost' + (showLog ? ' on' : '')} onClick={onToggleLog}>☰</button>
          <button className="ghost" onClick={onQuit}>✕</button>
        </div>
      </div>
      {t && <div className="levelbar"><div style={{ width: `${progress * 100}%` }} /></div>}
      {events && events.length > 0 && <div className="ticker" key={events[events.length - 1].t}>{events[events.length - 1].text}</div>}
    </>
  )
}
