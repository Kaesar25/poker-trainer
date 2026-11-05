import { endurance, levelFor, weekKey, type Store } from '../store'
import { LEVELS } from '../content/lessons'

export interface Challenge { id: string; title: string; desc: string; goal: number; progress: number; icon: string; xp: number }
export interface Badge { id: string; title: string; desc: string; icon: string; unlocked: boolean; progress?: string }

const WEEK_MS = 7 * 86400000

function weekStart(ts = Date.now()): number {
  const d = new Date(ts)
  const day = (d.getDay() + 6) % 7
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day).getTime()
}

type Tpl = (s: Store, since: number) => Omit<Challenge, 'id'>

const TEMPLATES: Record<string, Tpl> = {
  itm: (s, since) => ({ title: 'Dans l\'argent', desc: 'Termine 3 tournois dans les places payées.', icon: '🏆', goal: 3, xp: 120, progress: s.tournaments.filter((t) => t.ts >= since && t.paid).length }),
  win: (s, since) => ({ title: 'Couronne', desc: 'Gagne un tournoi (Sit & Go, express, heads-up ou marathon).', icon: '♛', goal: 1, xp: 150, progress: s.tournaments.filter((t) => t.ts >= since && t.place === 1).length }),
  puzzles: (s) => ({ title: 'Cerveau en feu', desc: 'Résous 20 casse-tête.', icon: '♟', goal: 20, xp: 100, progress: s.weekly[weekKey()]?.puzzles ?? 0 }),
  drills: (s) => ({ title: 'Gammes', desc: 'Réponds à 60 questions de drills.', icon: '◆', goal: 60, xp: 100, progress: s.weekly[weekKey()]?.drills ?? 0 }),
  marathon: (s, since) => ({ title: 'Endurance', desc: 'Joue 120 minutes en mode Marathon.', icon: '⏱', goal: 120, xp: 150, progress: s.sessions.filter((x) => x.ts >= since && x.mode === 'marathon').reduce((a, x) => a + x.minutes, 0) }),
  journal: (s, since) => ({ title: 'Introspection', desc: 'Remplis le journal après 3 sessions.', icon: '✎', goal: 3, xp: 80, progress: s.journal.filter((j) => j.ts >= since).length }),
  hands: (s, since) => ({ title: 'Volume', desc: 'Joue 300 mains.', icon: '♠', goal: 300, xp: 100, progress: s.hands.filter((h) => h.ts >= since).length }),
  coach: (s, since) => {
    const ss = s.sessions.filter((x) => x.ts >= since && x.decisions >= 20)
    const best = ss.reduce((a, x) => Math.max(a, Math.round((1 - x.errors / x.decisions) * 100)), 0)
    return { title: 'Discipline', desc: 'Termine une session de 20 décisions ou plus avec au moins 85 % de décisions alignées avec le coach.', icon: '✓', goal: 85, xp: 120, progress: best }
  },
  heads: (s, since) => ({ title: 'Duel', desc: 'Gagne 2 heads-up.', icon: '⚔', goal: 2, xp: 120, progress: s.tournaments.filter((t) => t.ts >= since && t.mode === 'headsup' && t.place === 1).length }),
  express: (s, since) => ({ title: 'Sprint', desc: 'Joue 4 sessions express.', icon: '⚡', goal: 4, xp: 80, progress: s.tournaments.filter((t) => t.ts >= since && t.mode === 'express').length }),
}

/** Three challenges per week, chosen deterministically from the week key. */
export function weeklyChallenges(s: Store, now = Date.now()): { key: string; ends: number; list: Challenge[] } {
  const key = weekKey(now)
  let h = 0
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const ids = Object.keys(TEMPLATES)
  const picked: string[] = []
  while (picked.length < 3) { const id = ids[h % ids.length]; if (!picked.includes(id)) picked.push(id); h = (h * 1103515245 + 12345) >>> 0 }
  const since = weekStart(now)
  return { key, ends: since + WEEK_MS, list: picked.map((id) => ({ id, ...TEMPLATES[id](s, since) })) }
}

export function badges(s: Store): Badge[] {
  const wins = s.tournaments.filter((t) => t.place === 1).length
  const itm = s.tournaments.filter((t) => t.paid).length
  const en = endurance(s)
  const drills = Object.values(s.drills).reduce((a, d) => a + (d?.asked ?? 0), 0)
  const allLessons = LEVELS.reduce((a, L) => a + L.lessons.length, 0)
  const lv = levelFor(s.xp)
  const b = (id: string, title: string, desc: string, icon: string, unlocked: boolean, progress?: string): Badge => ({ id, title, desc, icon, unlocked, progress })
  return [
    b('first-win', 'Première couronne', 'Gagner un tournoi.', '♛', wins >= 1),
    b('three-wins', 'Triplé', 'Gagner 3 tournois, comme à Malte.', '👑', wins >= 3, `${Math.min(wins, 3)}/3`),
    b('itm10', 'Régulier', '10 places payées.', '💰', itm >= 10, `${Math.min(itm, 10)}/10`),
    b('hu', 'Duelliste', 'Gagner un heads-up.', '⚔', s.tournaments.some((t) => t.mode === 'headsup' && t.place === 1)),
    b('marathon1', 'Une heure', 'Session de 60 minutes.', '⏱', en.longest >= 60, `${Math.min(en.longest, 60)}/60 min`),
    b('marathon3', 'Trois heures', 'Session de 180 minutes, la durée d\'un day 1.', '🏃', en.longest >= 180, `${Math.min(en.longest, 180)}/180 min`),
    b('bigwin', 'Grand champ', 'Gagner un marathon de 120 joueurs ou plus.', '🌟', s.tournaments.some((t) => t.mode === 'marathon' && t.place === 1 && t.entrants >= 120)),
    b('puzzle10', 'Lucide', 'Série de 10 casse-tête.', '♟', s.puzzles.best >= 10, `${Math.min(s.puzzles.best, 10)}/10`),
    b('puzzle25', 'Imbattable', 'Série de 25 casse-tête.', '🧠', s.puzzles.best >= 25, `${Math.min(s.puzzles.best, 25)}/25`),
    b('drills500', 'Gammes', '500 réponses aux drills.', '◆', drills >= 500, `${Math.min(drills, 500)}/500`),
    b('streak7', 'Une semaine', '7 jours d\'entraînement d\'affilée.', '🔥', s.streak.count >= 7, `${Math.min(s.streak.count, 7)}/7`),
    b('lessons', 'Érudit', 'Lire toutes les fiches de cours.', '📖', s.lessonsRead.length >= allLessons, `${s.lessonsRead.length}/${allLessons}`),
    b('journal10', 'Lucidité', '10 entrées de journal.', '✎', s.journal.length >= 10, `${Math.min(s.journal.length, 10)}/10`),
    b('reads10', 'Physionomiste', '10 lectures d\'adversaires justes.', '👁', s.reads.right >= 10, `${Math.min(s.reads.right, 10)}/10`),
    b('shark', 'Shark', 'Atteindre le niveau Shark (1 800 XP).', '🦈', lv.level >= 5),
  ]
}
