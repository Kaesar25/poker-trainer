import { computeStats, type HandRecord } from './stats'
import type { DrillType } from './drills'
import type { Store } from '../store'

export interface Leak {
  id: string
  title: string
  value: string
  target: string
  severity: number // 0..1
  why: string
  plan: string[]
  drill?: DrillType
  lesson?: string
  trend: 'up' | 'down' | 'flat' | 'new' // up = getting worse
}

const DAY = 86400000

interface Metric {
  id: string
  title: string
  min: number
  measure: (h: HandRecord[], s: Store) => { v: number; n: number } | null
  bad: (v: number) => number // 0..1 severity from value
  fmt: (v: number) => string
  target: string
  why: (v: number) => string
  plan: string[]
  drill?: DrillType
  lesson?: string
}

const pct = (x: number) => `${Math.round(x * 100)} %`

const METRICS: Metric[] = [
  {
    id: 'vpip-high', title: 'Tu joues trop de mains', min: 40,
    measure: (h) => { const s = computeStats(h, 0); return { v: s.vpip, n: s.hands } },
    bad: (v) => Math.max(0, Math.min(1, (v - 0.3) / 0.2)), fmt: pct, target: '20 à 28 %',
    why: (v) => `Tu entres dans ${pct(v)} des mains. Au-delà de 30 %, tu joues trop souvent des mains dominées, surtout hors de position.`,
    plan: ['Fais 3 séries du drill Ranges préflop cette semaine.', 'Avant chaque main, nomme ta position à voix haute : UTG et HJ = serré.', 'Interdis-toi de payer une relance hors de position sans paire ni broadway assorti.'],
    drill: 'preflop', lesson: 'ranges',
  },
  {
    id: 'vpip-low', title: 'Tu es trop passif préflop', min: 40,
    measure: (h) => { const s = computeStats(h, 0); return { v: s.vpip, n: s.hands } },
    bad: (v) => Math.max(0, Math.min(1, (0.16 - v) / 0.08)), fmt: pct, target: '20 à 28 %',
    why: (v) => `Seulement ${pct(v)} de mains jouées : tu laisses filer les blinds et les spots au bouton et au cutoff.`,
    plan: ['Ouvre tout le range BTN/CO du drill Ranges préflop.', 'Joue un Express en te fixant 1 vol de blinds par tour.'],
    drill: 'preflop', lesson: 'position',
  },
  {
    id: 'limp', title: 'Tu suis au lieu de relancer', min: 40,
    measure: (h) => { const s = computeStats(h, 0); return s.vpip > 0 ? { v: s.pfr / s.vpip, n: s.hands } : null },
    bad: (v) => Math.max(0, Math.min(1, (0.6 - v) / 0.3)), fmt: (v) => `${Math.round(v * 100)} % de tes entrées sont des relances`, target: 'Au moins 70 %',
    why: () => 'Limper ou payer laisse l\'initiative et te fait jouer des pots sans savoir où tu en es.',
    plan: ['Règle simple : premier à entrer = relance ou fold.', 'Refais la fiche « Penser en ranges ».'],
    drill: 'preflop', lesson: 'ranges',
  },
  {
    id: 'fold-cbet', title: 'Tu abandonnes trop face aux c-bets', min: 40,
    measure: (h) => { const s = computeStats(h, 0); return s.foldToCbetOpps >= 8 ? { v: s.foldToCbet, n: s.foldToCbetOpps } : null },
    bad: (v) => Math.max(0, Math.min(1, (v - 0.55) / 0.25)), fmt: pct, target: 'Moins de 55 %',
    why: (v) => `Tu couches ${pct(v)} des c-bets. Les bots agressifs l'ont repéré et misent n'importe quoi contre toi.`,
    plan: ['Défends avec tes tirages, tes paires et tes overcards + backdoor en position.', 'Drill Compter les outs pour savoir quand ton tirage paie.'],
    drill: 'outs', lesson: 'cbet',
  },
  {
    id: 'wtsd', title: 'Tu vas trop à l\'abattage', min: 40,
    measure: (h) => { const s = computeStats(h, 0); return { v: s.wtsd, n: s.hands } },
    bad: (v) => Math.max(0, Math.min(1, (v - 0.32) / 0.15)), fmt: pct, target: '25 à 30 %',
    why: (v) => `Tu vas à l'abattage dans ${pct(v)} des flops vus : tu paies trop de rivers.`,
    plan: ['Face à une mise river, demande-toi quelle main qu\'il bluffe ici. Si tu n\'en trouves pas, couche.', 'Drill Cote du pot pour mettre un chiffre sur chaque call.'],
    drill: 'odds', lesson: 'value',
  },
  {
    id: 'cover', title: 'Gros pots perdus contre les gros stacks', min: 10,
    measure: (h) => { const s = computeStats(h.filter((x) => x.mode !== 'cash'), 0); return { v: s.bigLossVsCover.count, n: s.hands } },
    bad: (v) => Math.max(0, Math.min(1, v / 4)), fmt: (v) => `${v} pot${v > 1 ? 's' : ''} de plus de 20 BB`, target: '0',
    why: () => 'C\'est ton leak historique : contre un joueur qui te couvre, chaque gros pot met ton tournoi en jeu.',
    plan: ['Joue 2 sessions Chip leader en gardant les pots petits contre les badges rouges.', 'Drill Prime de risque.', 'Relis la fiche « Gros stack contre gros stack ».'],
    drill: 'icm', lesson: 'bigstack',
  },
  {
    id: 'coach', title: 'Décisions qui s\'écartent du coach', min: 1,
    measure: (_h, s) => { const ss = s.sessions.slice(-8).filter((x) => x.decisions >= 10); const d = ss.reduce((a, x) => a + x.decisions, 0); return d >= 40 ? { v: ss.reduce((a, x) => a + x.errors, 0) / d, n: d } : null },
    bad: (v) => Math.max(0, Math.min(1, (v - 0.15) / 0.2)), fmt: pct, target: 'Moins de 15 %',
    why: (v) => `Sur tes dernières sessions, ${pct(v)} de tes décisions s'écartent nettement du coach.`,
    plan: ['Fais 20 casse-tête : ils entraînent exactement ces décisions.', 'Revois tes 5 dernières mains perdues avec « Revoir la main ».'],
    drill: 'preflop',
  },
]

function drillLeak(s: Store): Leak | null {
  let worst: { t: DrillType; acc: number; n: number } | null = null
  for (const [t, d] of Object.entries(s.drills)) {
    if (!d || d.recent.length < 15) continue
    const acc = d.recent.filter(Boolean).length / d.recent.length
    if (!worst || acc < worst.acc) worst = { t: t as DrillType, acc, n: d.recent.length }
  }
  if (!worst || worst.acc >= 0.75) return null
  const names: Record<string, string> = { preflop: 'les ranges préflop', odds: 'la cote du pot', outs: 'le comptage des outs', board: 'la lecture du board', pushfold: 'le push/fold', icm: 'la prime de risque', pro: 'les spots de pros' }
  return {
    id: 'drill-' + worst.t, title: `Point faible : ${names[worst.t] ?? worst.t}`, value: pct(worst.acc) + ' de réussite', target: '75 % ou plus',
    severity: Math.min(1, (0.75 - worst.acc) / 0.3), why: `C'est ton drill le moins réussi sur tes ${worst.n} dernières réponses.`,
    plan: ['Une série de 10 questions par jour jusqu\'à dépasser 75 %.', 'Lis l\'explication même quand tu as juste.'], drill: worst.t, trend: 'flat',
  }
}

/** Top leaks, worst first, with a weekly trend. */
export function computeLeaks(s: Store, now = Date.now()): Leak[] {
  const recent = s.hands.filter((h) => h.ts >= now - 14 * DAY)
  const thisWeek = s.hands.filter((h) => h.ts >= now - 7 * DAY)
  const lastWeek = s.hands.filter((h) => h.ts < now - 7 * DAY && h.ts >= now - 14 * DAY)
  const base = recent.length >= 40 ? recent : s.hands.slice(-300)
  const out: Leak[] = []
  for (const m of METRICS) {
    const r = m.measure(base, s)
    if (!r || r.n < m.min) continue
    const sev = m.bad(r.v)
    if (sev <= 0.05) continue
    const a = thisWeek.length >= 30 ? m.measure(thisWeek, s) : null
    const b = lastWeek.length >= 30 ? m.measure(lastWeek, s) : null
    let trend: Leak['trend'] = 'new'
    if (a && b) { const da = m.bad(a.v), db = m.bad(b.v); trend = da > db + 0.08 ? 'up' : da < db - 0.08 ? 'down' : 'flat' }
    out.push({ id: m.id, title: m.title, value: m.fmt(r.v), target: m.target, severity: sev, why: m.why(r.v), plan: m.plan, drill: m.drill, lesson: m.lesson, trend })
  }
  const d = drillLeak(s)
  if (d) out.push(d)
  return out.sort((x, y) => y.severity - x.severity)
}
