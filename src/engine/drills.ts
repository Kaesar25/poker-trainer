import { newDeck, shuffle, parseCard, type Card, cardToString } from './cards'
import { evaluate, CATEGORY_LABEL, type HandCategory } from './evaluator'
import { handLabel, openDecision, vsRaiseDecision, pushDecision, callShoveDecision, POSITIONS, type Pos } from './ranges'

export type DrillType = 'preflop' | 'odds' | 'outs' | 'board' | 'pushfold' | 'icm' | 'pro'

export const DRILL_META: Record<DrillType, { name: string; icon: string; desc: string; timed?: number }> = {
  preflop: { name: 'Ranges préflop', icon: '♠', desc: 'Ouvrir, suivre ou relancer selon ta position et ta main.' },
  odds: { name: 'Cote du pot', icon: '%', desc: 'Calcule l\'équité nécessaire pour payer, en moins de 15 s.', timed: 15 },
  outs: { name: 'Compter les outs', icon: '♦', desc: 'Combien de cartes améliorent ta main ? Chrono 20 s.', timed: 20 },
  board: { name: 'Lecture du board', icon: '♣', desc: 'Quelle est la meilleure main possible sur ce tableau ?' },
  pushfold: { name: 'Push / fold', icon: '⇧', desc: 'Short stack en tournoi : tapis ou couché ?' },
  icm: { name: 'Prime de risque', icon: '♛', desc: 'Spots de fin de tournoi, gros stack contre gros stack.' },
  pro: { name: 'Spots de pros', icon: '★', desc: 'Grands classiques et coups célèbres : trouve la décision avant de voir ce qui s\'est passé.' },
}

export interface Question {
  type: DrillType
  prompt: string
  cards?: Card[]
  board?: Card[]
  facts?: { l: string; v: string }[]
  options: { id: string; label: string }[]
  correct: string
  explanation: string
  timeLimit?: number
}

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]
const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1))

function deal(n: number, exclude: Card[] = []): Card[] {
  const used = new Set(exclude.map((c) => c.rank + c.suit))
  return shuffle(newDeck().filter((c) => !used.has(c.rank + c.suit))).slice(0, n)
}

// ---------- Preflop ----------
export function genPreflop(): Question {
  const cards = deal(2)
  const label = handLabel(cards)
  const facingRaise = Math.random() < 0.45
  if (!facingRaise) {
    const pos = pick(['UTG', 'HJ', 'CO', 'BTN', 'SB'] as const)
    const ans = openDecision(label, pos)
    return {
      type: 'preflop',
      prompt: `Tout le monde s'est couché jusqu'à toi. Tu es ${pos} avec ${label}.`,
      cards,
      facts: [{ l: 'Position', v: pos }, { l: 'Action devant', v: 'Aucune' }, { l: 'Stack', v: '100 BB' }],
      options: [{ id: 'fold', label: 'Fold' }, { id: 'raise', label: 'Relancer (open)' }],
      correct: ans,
      explanation: ans === 'raise'
        ? `${label} fait partie du range d'ouverture depuis ${pos}. Relance (2,2 à 2,5 BB), ne limpe jamais.`
        : `${label} est en dessous du range d'ouverture depuis ${pos}. ${pos === 'UTG' || pos === 'HJ' ? 'Tôt en position, reste serré : il reste beaucoup de joueurs derrière.' : 'Même en position tardive, cette main se domine facilement.'}`,
    }
  }
  const raiserPos = pick(['UTG', 'HJ', 'CO', 'BTN'] as const)
  const laterPositions = POSITIONS.slice(POSITIONS.indexOf(raiserPos) + 1) as Pos[]
  const heroPos = pick(laterPositions)
  const ans = vsRaiseDecision(label, heroPos, raiserPos)
  const why = ans === 'raise'
    ? `${label} se 3-bet ici : ${/^(TT|JJ|QQ|KK|AA|AQs|AKs|AKo)$/.test(label) ? 'pour valeur, tu domines le range de l\'ouvreur.' : 'comme 3-bet bluff, tu as un as bloqueur ou une main jouable qui ne vaut pas un call.'}`
    : ans === 'call'
      ? `${label} vaut un call ${heroPos === 'BB' ? 'depuis la BB : tu as déjà investi et tu clôtures l\'action' : 'en position : tu joues le flop avec l\'avantage de parler en dernier'}.`
      : `${label} se couche face à une ouverture de ${raiserPos}${heroPos === 'SB' ? ' : hors de position, les mains moyennes perdent de la valeur' : ' : main dominée ou trop faible pour jouer un pot relancé'}.`
  return {
    type: 'preflop',
    prompt: `${raiserPos} ouvre à 2,5 BB. Tu es ${heroPos} avec ${label}.`,
    cards,
    facts: [{ l: 'Ouvreur', v: raiserPos }, { l: 'Toi', v: heroPos }, { l: 'Stacks', v: '100 BB' }],
    options: [{ id: 'fold', label: 'Fold' }, { id: 'call', label: 'Call' }, { id: 'raise', label: '3-bet' }],
    correct: ans,
    explanation: why,
  }
}

// ---------- Pot odds ----------
export function genOdds(): Question {
  const pot = pick([100, 150, 200, 300, 400, 600, 800, 1200])
  const frac = pick([0.33, 0.5, 0.66, 0.75, 1, 1.5])
  const bet = Math.round(pot * frac)
  const need = bet / (pot + 2 * bet)
  const pct = Math.round(need * 100)
  const distractors = new Set<number>()
  while (distractors.size < 3) {
    const d = pct + pick([-12, -8, -5, 5, 8, 12, 15])
    if (d > 5 && d < 70 && d !== pct) distractors.add(d)
  }
  const opts = shuffle([pct, ...distractors]).map((v) => ({ id: String(v), label: `${v} %` }))
  return {
    type: 'odds',
    prompt: `Le pot fait ${pot}. Ton adversaire mise ${bet}. Quelle équité minimum te faut-il pour payer ?`,
    facts: [{ l: 'Pot', v: String(pot) }, { l: 'Mise', v: `${bet} (${Math.round(frac * 100)} % du pot)` }],
    options: opts,
    correct: String(pct),
    explanation: `Tu dois payer ${bet} pour gagner ${pot + bet}. Équité nécessaire = ${bet} / (${pot} + ${bet} + ${bet}) = ${pct} %. Astuce : mise ½ pot → 25 %, ⅔ pot → 29 %, pot → 33 %, 1,5× pot → 37 %.`,
    timeLimit: 15,
  }
}

// ---------- Outs ----------
type Template = { name: string; build: () => { cards: Card[]; board: Card[] }; target: (cat: HandCategory, before: HandCategory, card: Card, hole: Card[]) => boolean; tip: string }
const S = ['s', 'h', 'd', 'c'] as const
const mk = (rank: number, suit: string): Card => ({ rank: rank as any, suit: suit as any })

const TEMPLATES: Template[] = [
  {
    name: 'tirage couleur',
    build: () => { const s = pick([...S]); const rs = shuffle([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]); const other = pick(S.filter((x) => x !== s)); return { cards: [mk(rs[0], s), mk(rs[1], s)], board: [mk(rs[2], s), mk(rs[3], s), mk(rs[4], other)] } },
    target: (c) => c >= 5, tip: '13 cartes de la couleur − 4 vues = 9 outs.',
  },
  {
    name: 'tirage quinte ouvert',
    build: () => { const lo = rnd(4, 10); const ranks = [lo, lo + 1, lo + 2, lo + 3]; const suits = shuffle([...S, ...S]); const hole = [mk(ranks[0], suits[0]), mk(ranks[3], suits[1])]; const extra = pick([2, 3, 14].filter((r) => r < lo - 1 || r > lo + 4)); return { cards: hole, board: [mk(ranks[1], suits[2]), mk(ranks[2], suits[3]), mk(extra, suits[4] === suits[2] && suits[4] === suits[3] ? pick(S.filter((x) => x !== suits[2])) : suits[4])] } },
    target: (c) => c >= 4, tip: 'Deux rangs complètent la quinte, 4 cartes chacun = 8 outs.',
  },
  {
    name: 'tirage ventral',
    build: () => { const lo = rnd(4, 10); const ranks = [lo, lo + 1, lo + 3, lo + 4]; const suits = shuffle([...S, ...S]); const extra = pick([2, 14].filter((r) => r < lo - 1 || r > lo + 5)); return { cards: [mk(ranks[0], suits[0]), mk(ranks[3], suits[1])], board: [mk(ranks[1], suits[2]), mk(ranks[2], suits[3]), mk(extra, suits[4] === suits[2] && suits[4] === suits[3] ? pick(S.filter((x) => x !== suits[2])) : suits[4])] } },
    target: (c) => c >= 4, tip: 'Un seul rang manque au milieu : 4 outs.',
  },
  {
    name: 'top paire avec deux overcards',
    build: () => { const hi = shuffle([12, 13, 14]).slice(0, 2); const suits = shuffle([...S, ...S]); const lows = shuffle([2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 3); return { cards: [mk(hi[0], suits[0]), mk(hi[1], suits[1])], board: lows.map((r, i) => mk(r, suits[2 + i] === suits[0] && suits[2 + i] === suits[1] ? pick(S.filter((x) => x !== suits[0])) : suits[2 + i])) } },
    target: (_c, _b, card, hole) => hole.some((h) => h.rank === card.rank), tip: '3 cartes restantes pour chaque overcard = 6 outs (mais une top paire reste fragile).',
  },
  {
    name: 'couleur + quinte ouverte',
    build: () => { const s = pick([...S]); const lo = rnd(5, 9); const other = pick(S.filter((x) => x !== s)); return { cards: [mk(lo, s), mk(lo + 1, s)], board: [mk(lo + 2, s), mk(lo + 3, other), mk(rnd(2, 3) === 2 ? 2 : 14, s)] } },
    target: (c) => c >= 4, tip: '9 outs couleur + 8 outs quinte − 2 cartes comptées deux fois = 15 outs.',
  },
  {
    name: 'brelan vers full/carré',
    build: () => { const r = rnd(2, 14); const suits = shuffle([...S]); const others = shuffle([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].filter((x) => x !== r)).slice(0, 2); return { cards: [mk(r, suits[0]), mk(r, suits[1])], board: [mk(r, suits[2]), mk(others[0], pick([...S])), mk(others[1], pick([...S]))] } },
    target: (c) => c >= 6, tip: 'Carré : 1 out. Full : 3 cartes pour chacune des 2 autres cartes du board = 6. Total 7 outs.',
  },
]

export function genOuts(): Question {
  const t = pick(TEMPLATES)
  const { cards, board } = t.build()
  const used = new Set([...cards, ...board].map((c) => c.rank + c.suit))
  const before = evaluate([...cards, ...board]).category
  let outs = 0
  for (const c of newDeck()) {
    if (used.has(c.rank + c.suit)) continue
    const v = evaluate([...cards, ...board, c])
    if (t.target(v.category, before, c, cards)) outs++
  }
  const set = new Set<number>([outs])
  while (set.size < 4) { const d = outs + pick([-4, -3, -2, -1, 1, 2, 3, 4, 6]); if (d >= 1 && d <= 20) set.add(d) }
  const pctTurnRiver = Math.round(outs * 4 - (outs > 8 ? outs - 8 : 0))
  return {
    type: 'outs',
    prompt: `Flop. Combien d'outs pour compléter : ${t.name} ?`,
    cards, board,
    options: shuffle([...set]).map((v) => ({ id: String(v), label: `${v} outs` })),
    correct: String(outs),
    explanation: `${outs} outs. ${t.tip} Règle du 4 et 2 : ≈ ${pctTurnRiver} % sur turn + river, ≈ ${outs * 2} % sur une seule carte.`,
    timeLimit: 20,
  }
}

// ---------- Board reading ----------
export function genBoard(): Question {
  const board = deal(5)
  const used = new Set(board.map((c) => c.rank + c.suit))
  const rest = newDeck().filter((c) => !used.has(c.rank + c.suit))
  let best = -1, bestCat: HandCategory = 0, bestHole: Card[] = []
  for (let i = 0; i < rest.length; i++) for (let j = i + 1; j < rest.length; j++) {
    const v = evaluate([rest[i], rest[j], ...board])
    if (v.score > best) { best = v.score; bestCat = v.category; bestHole = [rest[i], rest[j]] }
  }
  const cats = new Set<HandCategory>([bestCat])
  const all: HandCategory[] = [1, 2, 3, 4, 5, 6, 7, 8]
  while (cats.size < 4) cats.add(pick(all))
  return {
    type: 'board',
    prompt: 'Quelle est la meilleure main possible (les « nuts ») sur ce tableau ?',
    board,
    options: shuffle([...cats]).sort((a, b) => b - a).map((c) => ({ id: String(c), label: CATEGORY_LABEL[c] })),
    correct: String(bestCat),
    explanation: `Les nuts sont ${CATEGORY_LABEL[bestCat].toLowerCase()} avec ${bestHole.map(cardToString).join(' ')}. Avant de miser gros, demande-toi toujours quelles mains te battent.`,
  }
}

// ---------- Push / fold ----------
export function genPushFold(): Question {
  const cards = deal(2)
  const label = handLabel(cards)
  const bbs = pick([4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])
  if (Math.random() < 0.7) {
    const pos = pick(['UTG', 'HJ', 'CO', 'BTN', 'SB'] as const)
    const ans = pushDecision(label, pos, bbs)
    return {
      type: 'pushfold',
      prompt: `Tournoi, ${bbs} BB. Tout le monde se couche jusqu'à toi en ${pos} avec ${label}.`,
      cards,
      facts: [{ l: 'Stack', v: `${bbs} BB` }, { l: 'Position', v: pos }, { l: 'Joueurs derrière', v: String(POSITIONS.length - 1 - POSITIONS.indexOf(pos)) }],
      options: [{ id: 'fold', label: 'Fold' }, { id: 'push', label: 'Tapis' }],
      correct: ans,
      explanation: ans === 'push'
        ? `À ${bbs} BB, ${label} se pousse depuis ${pos} : la fold equity plus l'équité quand tu es payé rendent le tapis rentable. Ne relance jamais petit ici.`
        : `${label} est trop faible pour pousser depuis ${pos} à ${bbs} BB${pos === 'UTG' || pos === 'HJ' ? ' : trop de joueurs derrière peuvent te payer avec mieux' : ''}. Attends un meilleur spot, les blinds ne te tuent pas encore.`,
    }
  }
  const shoverPos = pick(['CO', 'BTN', 'SB'] as const)
  const ans = callShoveDecision(label, bbs)
  return {
    type: 'pushfold',
    prompt: `${shoverPos} fait tapis pour ${bbs} BB. Tu es en BB avec ${label} et tu le couvres.`,
    cards,
    facts: [{ l: 'Tapis adverse', v: `${bbs} BB` }, { l: 'Pousseur', v: shoverPos }, { l: 'Toi', v: 'BB, couvre' }],
    options: [{ id: 'fold', label: 'Fold' }, { id: 'call', label: 'Payer' }],
    correct: ans,
    explanation: ans === 'call'
      ? `Face à un tapis de ${bbs} BB depuis ${shoverPos} (range large), ${label} a assez d'équité pour payer, d'autant que tu as déjà 1 BB investi.`
      : `${label} ne paie pas un tapis de ${bbs} BB : ${bbs <= 6 ? 'même contre un range très large, cette main est dominée trop souvent.' : 'le pousseur a un range encore correct à cette profondeur ; garde tes jetons.'}`,
  }
}

// ---------- ICM / risk premium ----------
const ICM: Omit<Question, 'type'>[] = [
  {
    prompt: 'Table finale, 6 restants, 4 payés. Tu es chip leader (80 BB). Le 2e stack (70 BB) relance au bouton, tu es en BB avec A♠J♦. Que fais-tu ?',
    facts: [{ l: 'Toi', v: '80 BB, 1er' }, { l: 'Relanceur', v: '70 BB, 2e' }, { l: 'Autres', v: '25, 15, 9, 6 BB' }],
    options: [{ id: 'fold', label: 'Fold' }, { id: 'call', label: 'Call' }, { id: '3bet', label: '3-bet' }, { id: 'jam', label: 'Tapis' }],
    correct: 'call',
    explanation: 'Contre le seul joueur qui peut vraiment te faire mal, pas de guerre : tu paies et tu joues petit postflop. Le 3-bet gonfle un pot contre un stack qui te couvre presque, alors que quatre petits stacks attendent de sauter. Ta prime de risque est maximale contre lui.',
  },
  {
    prompt: 'Même table. Cette fois c\'est le stack de 9 BB qui fait tapis depuis le CO. Tu es au bouton avec K♣T♣, 80 BB.',
    facts: [{ l: 'Toi', v: '80 BB, chip leader' }, { l: 'Pousseur', v: '9 BB' }, { l: 'Derrière toi', v: 'SB 70 BB, BB 25 BB' }],
    options: [{ id: 'fold', label: 'Fold' }, { id: 'call', label: 'Payer' }, { id: 'iso', label: 'Sur-relancer (isoler)' }],
    correct: 'iso',
    explanation: 'Le petit stack doit pousser large ; KTs a de l\'équité et tu ne risques que 9 BB sur 80. Sur-relancer isole et empêche les stacks derrière de venir à bon prix. Payer simplement invite le 70 BB à squeezer.',
  },
  {
    prompt: 'Bulle, 7 restants pour 6 payés. Tu as 45 BB (2e). Le chip leader (90 BB) ouvre UTG, tu es au CO avec Q♥Q♦.',
    facts: [{ l: 'Toi', v: '45 BB' }, { l: 'Ouvreur', v: '90 BB' }, { l: 'Plus petit stack', v: '4 BB' }],
    options: [{ id: 'fold', label: 'Fold' }, { id: 'call', label: 'Call' }, { id: '3bet', label: '3-bet pour valeur' }, { id: 'jam', label: 'Tapis' }],
    correct: '3bet',
    explanation: 'QQ est trop forte pour la coucher, mais un tapis de 45 BB contre le seul stack qui te couvre, à la bulle, est inutile : il ne paie qu\'avec KK+ et AK. 3-bet pour valeur, puis prudence si tu te fais 4-bet. Avec un 4 BB à table, pas besoin de risquer ton tournoi.',
  },
  {
    prompt: 'Cash game 100 BB. Un joueur ouvre au bouton, tu es en BB avec Q♥Q♦. Même question qu\'avant, mais en cash.',
    facts: [{ l: 'Format', v: 'Cash game' }, { l: 'Stacks', v: '100 BB effectifs' }],
    options: [{ id: 'call', label: 'Call' }, { id: '3bet', label: '3-bet' }, { id: 'jam', label: 'Tapis' }],
    correct: '3bet',
    explanation: 'En cash, pas de prime de risque : tu 3-bet pour valeur et tu peux aller à tapis préflop contre un 4-bet d\'un joueur agressif. Les jetons valent leur valeur faciale, contrairement au tournoi.',
  },
  {
    prompt: 'Table finale, 5 restants, tous payés avec gros écarts. Tu es 2e stack (60 BB). Le chip leader (75 BB) te mise la river pot (40 BB) sur K♠9♦4♥2♣7♠. Tu as K♦Q♦ (top paire).',
    facts: [{ l: 'Pot', v: '40 BB' }, { l: 'Mise', v: '40 BB (pot)' }, { l: 'Si tu paies et perds', v: 'tu tombes à 20 BB, 4e/5' }],
    options: [{ id: 'fold', label: 'Fold' }, { id: 'call', label: 'Call' }],
    correct: 'fold',
    explanation: 'Cote du pot 33 %, mais une paire de rois face à une mise pot du seul joueur qui te couvre, en table finale, a besoin de bien plus que 33 % à cause de l\'ICM. Perdre ce pot te coûte deux places de prix potentielles. Contre un stack moyen, ce call serait discutable ; contre le chip leader, c\'est un fold.',
  },
  {
    prompt: 'Tu es chip leader (100 BB) à une table de 6 avec trois stacks de 15 à 20 BB. On te pose souvent la question : qui attaquer ?',
    facts: [{ l: 'Toi', v: '100 BB' }, { l: '2e', v: '55 BB' }, { l: 'Autres', v: '20, 18, 15, 12 BB' }],
    options: [{ id: 'big', label: 'Le 2e stack, pour creuser l\'écart' }, { id: 'mid', label: 'Les stacks moyens (12-20 BB)' }, { id: 'all', label: 'Tout le monde, tu couvres tout' }],
    correct: 'mid',
    explanation: 'Les stacks moyens sont coincés : trop gros pour pousser n\'importe quoi, trop petits pour te payer sans risquer leur tournoi. Ils sur-foldent, tu voles. Le 2e stack est le seul qui peut te faire mal : évite-le sans main.',
  },
  {
    prompt: 'Table finale 4 restants. Tu es chip leader (90 BB), le 2e (70 BB) fait tapis sur toi après ton open au bouton. Tu as A♣Q♣.',
    facts: [{ l: 'Toi', v: '90 BB' }, { l: 'Lui', v: '70 BB' }, { l: 'Autres', v: '14 et 9 BB' }],
    options: [{ id: 'fold', label: 'Fold' }, { id: 'call', label: 'Call' }],
    correct: 'fold',
    explanation: 'AQs est une belle main, mais payer 70 BB contre le seul joueur qui peut te ramener à 20 BB, alors que deux stacks courts vont sauter, détruit ton équité de tournoi. Son range de tapis est serré. Tu gardes 87 BB et la position dominante.',
  },
  {
    prompt: 'Sit & Go 6 joueurs, 3 payés, 4 restants. Tu as 12 BB en SB. Le bouton (8 BB) se couche. BB a 30 BB. Tu as K♦7♠.',
    facts: [{ l: 'Toi', v: '12 BB, SB' }, { l: 'BB', v: '30 BB' }, { l: 'Autre', v: '8 BB' }],
    options: [{ id: 'fold', label: 'Fold' }, { id: 'push', label: 'Tapis' }, { id: 'limp', label: 'Compléter' }],
    correct: 'push',
    explanation: 'En SB contre la BB seule, K7o se pousse à 12 BB : le BB doit coucher beaucoup, et les blinds représentent 12 % de ton stack. Compléter laisse l\'initiative. Attention : si la BB était un 8 BB (bulle), on serait plus prudent.',
  },
]

export function genIcm(): Question {
  const q = pick(ICM)
  return { type: 'icm', ...q }
}

const C = (x: string) => x.split(' ').map(parseCard)

const PRO_SPOTS: Omit<Question, 'type'>[] = [
  {
    prompt: 'Inspiré du WSOP 2003, tête-à-tête final. Tu as raté tes tirages : à la river, ton adversaire checke. Il a souvent une paire moyenne qu\'il ne peut pas miser. Tu as plus de jetons que lui.',
    cards: C('Ks 7h'), board: C('9s 2d 6s 8s 3h'),
    facts: [{ l: 'Ta main', v: 'Hauteur roi' }, { l: 'Lui', v: 'Checke la river' }],
    options: [{ id: 'check', label: 'Check' }, { id: 'small', label: 'Petite mise' }, { id: 'jam', label: 'Tapis' }],
    correct: 'jam',
    explanation: 'Check, tu perds contre n\'importe quelle paire. Une petite mise se fait payer par une paire. Le tapis raconte une couleur ou une quinte, deux tirages arrivés sur ce board, et met tout son tournoi en jeu. C\'est le bluff célèbre de Chris Moneymaker contre Sam Farha : Farha s\'est couché avec une paire de 9.',
  },
  {
    prompt: 'Inspiré du Main Event 1988. Tu touches la quinte max au flop face à un adversaire agressif qui a probablement touché une paire. Tu parles en premier.',
    cards: C('Jc 9c'), board: C('Qc 8d Th'),
    facts: [{ l: 'Ta main', v: 'Quinte max' }, { l: 'Lui', v: 'Agressif, top paire probable' }],
    options: [{ id: 'check', label: 'Check (le laisser miser)' }, { id: 'bet', label: 'Miser ½ pot' }, { id: 'jam', label: 'Tapis' }],
    correct: 'check',
    explanation: 'Contre un joueur qui va miser sa top paire, le check rapporte plus : tu le laisses construire le pot, puis tu relances ou tu suis pour l\'emmener à la turn. Johnny Chan a joué ce coup lentement contre Erik Seidel, qui a fini par mettre tous ses jetons avec sa paire de dames.',
  },
  {
    prompt: 'Classique : flop sec et as en tête. Un joueur très serré (nit) qui avait suivi préflop mise gros au flop dans ton dos, après ton c-bet.',
    cards: C('Kd Kc'), board: C('Ah 7c 2s'),
    facts: [{ l: 'Adversaire', v: 'Nit' }, { l: 'Action', v: 'Relance ×3 ton c-bet' }],
    options: [{ id: 'fold', label: 'Fold' }, { id: 'call', label: 'Call' }, { id: 'jam', label: 'Tapis' }],
    correct: 'fold',
    explanation: 'Un nit ne relance pas un flop A-7-2 sans as ou mieux. Ta paire de rois ne bat que des bluffs qu\'il ne fait presque jamais. Couche : c\'est exactement le genre de main qu\'on perd par fierté.',
  },
  {
    prompt: 'Classique de bulle : 7 joueurs, 6 payés. Tu as 55 BB, les deux joueurs à ta gauche ont 14 et 11 BB. Tout le monde se couche jusqu\'à toi au cutoff.',
    cards: C('Qh 6h'), board: [],
    facts: [{ l: 'Toi', v: '55 BB, cutoff' }, { l: 'Derrière', v: '14 et 11 BB' }],
    options: [{ id: 'fold', label: 'Fold' }, { id: 'raise', label: 'Relancer à 2 BB' }],
    correct: 'raise',
    explanation: 'À la bulle, les stacks moyens ne peuvent pas défendre sans risquer la place payée. Tu ouvres très large : chaque vol de blinds est quasiment gratuit. C\'est le cœur du jeu de gros stack.',
  },
  {
    prompt: 'Classique : un maniaque mise trois rues. River, il mise le pot. Tu as une deuxième paire.',
    cards: C('9h 8h'), board: C('Kd 9c 4s 2h 6d'),
    facts: [{ l: 'Adversaire', v: 'Maniac' }, { l: 'Mise river', v: 'Pot' }],
    options: [{ id: 'fold', label: 'Fold' }, { id: 'call', label: 'Call' }, { id: 'raise', label: 'Relance' }],
    correct: 'call',
    explanation: 'Contre un maniaque, son range de mise river contient énormément de bluffs. Il te faut 33 % d\'équité, ta deuxième paire bat largement ce seuil. Relancer ne fait coucher que ses bluffs : paie.',
  },
  {
    prompt: 'Classique : tu as touché brelan. À la river, quatre cartes de la même couleur sont au board. Un joueur serré fait tapis.',
    cards: C('7d 7c'), board: C('7s Js 2s 9h 4s'),
    facts: [{ l: 'Adversaire', v: 'Serré' }, { l: 'Action', v: 'Tapis river' }],
    options: [{ id: 'fold', label: 'Fold' }, { id: 'call', label: 'Call' }],
    correct: 'fold',
    explanation: 'Avec quatre piques au board, n\'importe quel pique bat ton brelan. Un joueur serré ne fait pas tapis ici sans couleur. Couche ta grosse main : savoir lâcher un brelan est une compétence de pro.',
  },
  {
    prompt: 'Classique de fin de tournoi : il te reste 3 BB en small blind. Tout le monde se couche, seule la grosse blind reste.',
    cards: C('8c 3d'), board: [],
    facts: [{ l: 'Toi', v: '3 BB, SB' }, { l: 'BB', v: 'Te couvre' }],
    options: [{ id: 'fold', label: 'Fold' }, { id: 'jam', label: 'Tapis' }],
    correct: 'jam',
    explanation: 'À 3 BB, tu dois pousser toutes tes mains ici : la BB doit souvent coucher, et même payé, 8-3 a environ 30 % d\'équité. Attendre te fait perdre ta dernière fold equity.',
  },
  {
    prompt: 'Classique : en position, tu as payé une relance. Le relanceur fait un petit c-bet au flop.',
    cards: C('Ad Qd'), board: C('9s 6d 2c'),
    facts: [{ l: 'Position', v: 'Tu parles en dernier' }, { l: 'C-bet', v: '⅓ pot' }],
    options: [{ id: 'fold', label: 'Fold' }, { id: 'call', label: 'Call (float)' }, { id: 'raise', label: 'Relancer' }],
    correct: 'call',
    explanation: 'Deux overcards, un backdoor couleur et la position contre une petite mise : tu as assez d\'équité et de jouabilité pour suivre. Coucher est trop faible, relancer gonfle le pot avec une main qui gagne surtout en touchant.',
  },
  {
    prompt: 'Classique : contre une calling station, tu as une paire moyenne à la river et elle checke.',
    cards: C('Th 9d'), board: C('Kc Ts 5h 3d 2c'),
    facts: [{ l: 'Adversaire', v: 'Calling station' }, { l: 'Action', v: 'Checke la river' }],
    options: [{ id: 'check', label: 'Check' }, { id: 'small', label: 'Petite mise (⅓ pot)' }, { id: 'big', label: 'Grosse mise' }],
    correct: 'small',
    explanation: 'Une calling station paie avec n\'importe quelle paire inférieure et même hauteur as. Une petite mise pour valeur est rentable. Une grosse mise ne se fait payer que par mieux.',
  },
  {
    prompt: 'Classique : un joueur ouvre au cutoff, un autre suit au bouton. Tu es en small blind avec un as assorti faible.',
    cards: C('As 5s'), board: [],
    facts: [{ l: 'Action', v: 'Open CO + call BTN' }, { l: 'Toi', v: 'SB, 100 BB' }],
    options: [{ id: 'fold', label: 'Fold' }, { id: 'call', label: 'Call' }, { id: 'squeeze', label: '3-bet (squeeze)' }],
    correct: 'squeeze',
    explanation: 'Le squeeze est rentable : le relanceur doit se méfier du joueur derrière, et celui qui a seulement suivi a rarement une grosse main. A5s bloque les as et reste jouable si tu es payé. Payer hors de position à trois est la pire option.',
  },
]

export function genPro(): Question {
  const q = pick(PRO_SPOTS)
  return { type: 'pro', ...q, board: q.board && q.board.length ? q.board : undefined }
}

export function proSession(): Question[] {
  return shuffle(PRO_SPOTS).map((q) => ({ type: 'pro' as const, ...q, board: q.board && q.board.length ? q.board : undefined }))
}

export function generate(type: DrillType): Question {
  switch (type) {
    case 'preflop': return genPreflop()
    case 'odds': return genOdds()
    case 'outs': return genOuts()
    case 'board': return genBoard()
    case 'pushfold': return genPushFold()
    case 'icm': return genIcm()
    case 'pro': return genPro()
  }
}

export function dailySession(): Question[] {
  const plan: DrillType[] = ['preflop', 'preflop', 'odds', 'outs', 'board', 'pushfold', 'pushfold', 'icm', 'preflop', 'outs']
  return plan.map(generate)
}
