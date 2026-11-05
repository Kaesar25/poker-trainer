import { useEffect, useState } from 'react'
import type { GameState } from '../engine/game'
import { currentLevelIndex, estimateRank, levelTimeLeft, structureOf, type Tournament } from '../engine/tournament'
import { useIsPhone } from '../hooks/useMedia'

function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h ? `${h}h${String(m).padStart(2, '0')}` : `${m}:${String(s % 60).padStart(2, '0')}`
}

export function Hud({ state: s, tournament: t, mode, heroIdx, showLog, onToggleLog, coach, onToggleCoach, onQuit, playedMs, onPause, events, sound, onToggleSound, autoNext, onToggleAutoNext }: {
  state: GameState; tournament: Tournament | null; mode: string; heroIdx: number; showLog: boolean; onToggleLog: () => void; coach: boolean; onToggleCoach: () => void; onQuit: () => void; playedMs: number; onPause: () => void; events?: { t: number; text: string }[]; sound?: boolean; onToggleSound?: () => void; autoNext?: boolean; onToggleAutoNext?: () => void
}) {
  const [, tick] = useState(0)
  const [menu, setMenu] = useState(false)
  const phone = useIsPhone()
  useEffect(() => {
    if (!t) return
    const id = setInterval(() => tick((x) => x + 1), 1000)
    return () => clearInterval(id)
  }, [t])
  const hero = s.players[heroIdx]
  const alive = s.players.filter((p) => !p.out)
  const rank = alive.filter((p) => p.stack > hero.stack).length + 1
  const st = t ? structureOf(t) : null
  const li = t ? currentLevelIndex(t) : 0
  const lvl = st ? st.levels[li] : s.blinds
  const next = st ? st.levels[Math.min(li + 1, st.levels.length - 1)] : null
  const left = t ? levelTimeLeft(t) : 0
  const progress = t && st ? 1 - left / (st.levelSeconds * 1000) : 0
  const title = ({ cash: 'Cash game', sng: 'Sit & Go', marathon: 'Marathon', chipleader: 'Chip leader', headsup: 'Heads-up', express: 'Express' } as Record<string, string>)[mode] ?? mode
  const field = t ? (t.mode === 'marathon' ? `${t.field}/${t.entrants}` : `${alive.length}/${t.entrants}`) : null
  const place = t ? (t.mode === 'marathon' ? `≈${estimateRank(t, s, hero.stack)}e` : `${rank}${rank === 1 ? 'er' : 'e'}`) : null

  const menuSheet = menu && (
    <div className="sheet-back" onClick={() => setMenu(false)}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div className="sheet-title">{title}</div>
        <button className={'sheet-item' + (coach ? ' on' : '')} onClick={() => { onToggleCoach(); setMenu(false) }}><span>◆</span>Coach en direct<b>{coach ? 'activé' : 'désactivé'}</b></button>
        {mode !== 'cash' && <button className="sheet-item" onClick={() => { onPause(); setMenu(false) }}><span>❚❚</span>Pause guidée</button>}
        {onToggleSound && <button className={'sheet-item' + (sound ? ' on' : '')} onClick={() => { onToggleSound(); setMenu(false) }}><span>{sound ? '🔊' : '🔇'}</span>Son<b>{sound ? 'activé' : 'coupé'}</b></button>}
        {onToggleAutoNext && <button className={'sheet-item' + (autoNext ? ' on' : '')} onClick={() => { onToggleAutoNext(); setMenu(false) }}><span>⏭</span>Main suivante auto<b>{autoNext ? 'activée' : 'manuelle'}</b></button>}
        <button className={'sheet-item' + (showLog ? ' on' : '')} onClick={() => { onToggleLog(); setMenu(false) }}><span>☰</span>Journal des coups<b>{showLog ? 'affiché' : 'masqué'}</b></button>
        <button className="sheet-item danger" onClick={() => { setMenu(false); onQuit() }}><span>✕</span>Quitter la table</button>
      </div>
    </div>
  )

  if (phone) {
    return (
      <>
        <div className="hud phone">
          <div className="hp-l">
            <div className="hp-blinds">{lvl.sb}/{lvl.bb}{lvl.ante ? <small> a{lvl.ante}</small> : null}</div>
            <div className="hp-sub">{t ? `Niv. ${li + 1} · ${next ? `${next.sb}/${next.bb} dans ${fmt(left)}` : ''}` : `Main n°${s.handNumber}`}</div>
          </div>
          {t && (
            <div className="hp-c">
              <div className="hp-place">{place}</div>
              <div className="hp-sub">{field} restants</div>
            </div>
          )}
          <div className="hp-r">
            <button className={'iconbtn' + (coach ? ' on' : '')} onClick={onToggleCoach} aria-label="Coach">◆</button>
            <button className="iconbtn" onClick={() => setMenu(true)} aria-label="Menu">⋯</button>
          </div>
        </div>
        {t && <div className="levelbar"><div style={{ width: `${progress * 100}%` }} /></div>}
        {events && events.length > 0 && <div className="ticker" key={events[events.length - 1].t}>{events[events.length - 1].text}</div>}
        {menuSheet}
      </>
    )
  }

  return (
    <>
      <div className="hud">
        <div className="title">{title}</div>
        <div className="meta">
          {t && next ? (
            <>
              <div className="m"><div className="l">Niveau {li + 1}</div><div className="v gold">{lvl.sb}/{lvl.bb}{lvl.ante ? ` · a${lvl.ante}` : ''}</div></div>
              <div className="m next"><div className="l">Suivant</div><div className="v">{next.sb}/{next.bb} dans {fmt(left)}</div></div>
              <div className="m"><div className="l">Restants</div><div className="v">{field} · {place}</div></div>
              {t.mode === 'marathon' && <div className="m next"><div className="l">Table</div><div className="v">n°{t.tableNumber ?? 1} · {rank}{rank === 1 ? 'er' : 'e'} ici</div></div>}
            </>
          ) : (
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
          <button className="ghost" onClick={() => setMenu(true)} title="Menu">⋯</button>
        </div>
      </div>
      {t && <div className="levelbar"><div style={{ width: `${progress * 100}%` }} /></div>}
      {events && events.length > 0 && <div className="ticker" key={events[events.length - 1].t}>{events[events.length - 1].text}</div>}
      {menuSheet}
    </>
  )
}
