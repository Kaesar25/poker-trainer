import type { DrillType } from '../engine/drills'

export interface Lesson {
  id: string
  title: string
  minutes: number
  summary: string
  sections: { h: string; p: string[] }[]
  drill?: DrillType
}

export interface Level {
  id: 'debutant' | 'intermediaire' | 'avance'
  name: string
  tagline: string
  lessons: Lesson[]
  /** To unlock the next level: accuracy on these drills over the last N answers. */
  gate: { drills: DrillType[]; minAnswers: number; accuracy: number }
}

export const LEVELS: Level[] = [
  {
    id: 'debutant',
    name: 'Fondations',
    tagline: 'Position, ranges, cotes : les bases qui font 80 % du résultat.',
    gate: { drills: ['preflop', 'odds'], minAnswers: 30, accuracy: 0.75 },
    lessons: [
      {
        id: 'position', title: 'La position, ton premier avantage', minutes: 4, drill: 'preflop',
        summary: 'Parler en dernier vaut plus qu\'une bonne main.',
        sections: [
          { h: 'Pourquoi ça compte', p: ['Au poker, l\'information est la ressource rare. Parler après ton adversaire, c\'est le voir agir avant de décider : tu sais s\'il a checké, misé, hésité.', 'Le bouton (BTN) est la meilleure place : tu parles en dernier sur toutes les rues postflop. Les blinds (SB, BB) sont les pires : tu parles en premier.'] },
          { h: 'Les positions à 6 joueurs', p: ['UTG (premier à parler) → HJ (hijack) → CO (cutoff) → BTN (bouton) → SB → BB.', 'Plus tu es proche du bouton, plus tu peux jouer de mains. Depuis UTG, cinq joueurs peuvent encore se réveiller avec une grosse main.'] },
          { h: 'Règle simple', p: ['Ouvre serré en début de parole, large en fin de parole. Évite d\'entrer dans un pot hors de position avec une main moyenne : tu la joueras à l\'aveugle sur trois rues.'] },
        ],
      },
      {
        id: 'ranges', title: 'Penser en ranges, pas en mains', minutes: 5, drill: 'preflop',
        summary: 'Ton adversaire n\'a pas « une main », il a un ensemble de mains.',
        sections: [
          { h: 'Le range d\'ouverture', p: ['Depuis chaque position, tu ouvres un ensemble fixe de mains (ton range). UTG : environ 15 % des mains, les paires 66+, les gros as, quelques broadways assortis. Au bouton : 45 % ou plus.', 'L\'intérêt : tu ne te demandes plus « est-ce que je sens cette main », tu appliques un plan.'] },
          { h: 'Relancer ou se coucher', p: ['Premier à entrer dans le pot, tu relances ou tu te couches. Limper (juste payer la blind) laisse l\'initiative aux autres et t\'oblige à jouer un pot multi-joueurs sans savoir où tu en es.'] },
          { h: 'Face à une relance', p: ['Trois réponses : 3-bet (sur-relance) avec tes meilleures mains et quelques bluffs à bloqueur (A5s), call avec les mains qui jouent bien en position (paires, connecteurs assortis, broadways assortis), fold le reste.', 'Hors de position (SB), resserre fortement : préfère 3-bet ou fold.'] },
        ],
      },
      {
        id: 'odds', title: 'Cote du pot et équité', minutes: 5, drill: 'odds',
        summary: 'Un call est bon quand ton équité dépasse le prix demandé.',
        sections: [
          { h: 'Le calcul', p: ['Équité nécessaire = mise à payer / (pot + mise adverse + ta mise). Face à une mise d\'un demi-pot, il te faut 25 % ; mise pot, 33 % ; mise 2× pot, 40 %.', 'Si ta main gagne plus souvent que ça contre le range adverse, le call est rentable à long terme.'] },
          { h: 'Les outs et la règle du 4 et 2', p: ['Un out est une carte qui transforme ta main en main gagnante. Tirage couleur : 9 outs. Quinte ouverte : 8. Ventrale : 4. Deux overcards : 6.', 'Probabilité ≈ outs × 4 sur turn + river, outs × 2 pour une seule carte. 9 outs au flop ≈ 36 % d\'ici la river.'] },
          { h: 'Attention', p: ['Les outs « sales » : un tirage couleur peut donner une couleur supérieure à l\'adversaire si le board se paire ou s\'il a un tirage plus haut. Soustrais un ou deux outs quand le doute existe.'] },
        ],
      },
      {
        id: 'bankroll', title: 'Gérer sa bankroll et sa variance', minutes: 3,
        summary: 'La meilleure stratégie du monde ne survit pas à une bankroll trop courte.',
        sections: [
          { h: 'Le principe', p: ['La variance au poker est énorme : un excellent joueur de tournoi peut enchaîner 30 tournois sans place payée. La bankroll absorbe ces séries.', 'Repères : 50 à 100 buy-ins pour les tournois, 20 à 30 caves pour le cash game.'] },
          { h: 'Dans cette app', p: ['Ta bankroll fictive fonctionne de la même façon : 100 ₵ par tournoi. Observe sa courbe sur plusieurs dizaines de tournois, pas sur une soirée.'] },
        ],
      },
    ],
  },
  {
    id: 'intermediaire',
    name: 'Postflop et tournoi',
    tagline: 'Mises pour valeur, c-bet, push/fold : jouer juste quand les jetons bougent.',
    gate: { drills: ['outs', 'board', 'pushfold'], minAnswers: 40, accuracy: 0.75 },
    lessons: [
      {
        id: 'cbet', title: 'Le continuation bet', minutes: 5, drill: 'board',
        summary: 'Tu as relancé préflop : le flop t\'appartient souvent, mais pas toujours.',
        sections: [
          { h: 'Quand c-bet', p: ['Tu as l\'initiative et l\'avantage de range sur les boards hauts et secs (A72 rainbow, K94) : mise petit (⅓ pot) très souvent, ton adversaire a raté le flop deux fois sur trois.', 'Sur les boards bas et connectés (765 à deux couleurs), le range qui a payé est souvent devant : c-bet moins, et plus gros quand tu le fais.'] },
          { h: 'Heads-up vs multi', p: ['Face à deux adversaires ou plus, un c-bet sans main passe beaucoup moins. Réserve-le aux vraies mains et aux gros tirages.'] },
          { h: 'Lecture du board', p: ['Avant chaque mise, demande-toi : quelle est la meilleure main possible ? Qui a le plus de combinaisons fortes ici, moi ou lui ? Le drill « lecture du board » entraîne ce réflexe.'] },
        ],
      },
      {
        id: 'value', title: 'Value bet ou bluff : la mise doit avoir un but', minutes: 5, drill: 'outs',
        summary: 'Chaque mise fait soit payer une moins bonne main, soit coucher une meilleure. Sinon, elle est inutile.',
        sections: [
          { h: 'Miser pour valeur', p: ['Tu mises pour valeur quand des mains moins bonnes que la tienne peuvent payer. Top paire bon kicker contre un joueur qui paie large : mise trois rues.', 'La taille suit l\'objectif : plus gros contre les calling stations, plus fin contre les joueurs serrés.'] },
          { h: 'Bluffer avec un plan', p: ['Un bon bluff raconte une histoire cohérente et vise des mains précises qui peuvent se coucher. Bluffe avec des tirages (semi-bluff) plutôt qu\'avec rien : tu as deux façons de gagner.', 'Ne bluffe pas une calling station. Ne bluffe pas trois adversaires.'] },
          { h: 'Le pot control', p: ['Main moyenne (deuxième paire, top paire kicker faible) : checke, paie une mise raisonnable, ne gonfle pas le pot. Contre un gros stack en tournoi, c\'est encore plus vrai.'] },
        ],
      },
      {
        id: 'pushfold', title: 'Push/fold : le jeu à moins de 15 BB', minutes: 4, drill: 'pushfold',
        summary: 'Short stack, il n\'y a que deux boutons : tapis ou fold.',
        sections: [
          { h: 'Pourquoi tout ou rien', p: ['Avec 12 BB, une relance à 2,5 BB engage un cinquième de ton tapis : tu ne peux plus te coucher ensuite, et tu offres de bonnes cotes à la BB. Pousser maximise la fold equity et évite les décisions postflop sans marge.'] },
          { h: 'Les ranges', p: ['Ils s\'élargissent quand ton stack baisse et quand il y a moins de joueurs derrière. À 5 BB au bouton, presque tout se pousse. À 15 BB UTG, il faut une vraie main.', 'Face à un tapis, ton range de call est bien plus serré que son range de push : tu as besoin d\'équité réelle, pas de fold equity.'] },
          { h: 'Erreur classique', p: ['Attendre « une meilleure main » en passant de 12 à 7 BB. Chaque tour de blinds te coûte 10 % de ton stack et ta fold equity s\'évapore.'] },
        ],
      },
      {
        id: 'structure', title: 'Lire une structure de tournoi', minutes: 3,
        summary: 'Blinds, antes, niveaux : adapter son rythme à la structure.',
        sections: [
          { h: 'Les phases', p: ['Début (stacks > 50 BB) : jeu profond, postflop, prends l\'information sur tes adversaires. Milieu (20 à 40 BB) : les antes arrivent, voler les blinds devient rentable. Fin (< 20 BB) : push/fold et ICM.'] },
          { h: 'Les antes changent tout', p: ['Avec antes, le pot préflop grossit de 30 à 50 % : ouvrir plus large pour le voler devient correct, et défendre sa BB aussi.'] },
          { h: 'Le mode marathon (bientôt)', p: ['Les structures live comme à Malte durent des heures. Tenir la concentration est une compétence à part entière, qu\'on travaillera au palier suivant.'] },
        ],
      },
    ],
  },
  {
    id: 'avance',
    name: 'Fin de tournoi et gros stacks',
    tagline: 'ICM, prime de risque, bully : convertir un gros tapis en victoire.',
    gate: { drills: ['icm', 'pushfold', 'preflop'], minAnswers: 50, accuracy: 0.8 },
    lessons: [
      {
        id: 'icm', title: 'L\'ICM, ou pourquoi les jetons ne valent pas leur prix', minutes: 6, drill: 'icm',
        summary: 'En tournoi, perdre 1 000 jetons te coûte plus que gagner 1 000 jetons ne te rapporte.',
        sections: [
          { h: 'Le principe', p: ['Les prix sont répartis par places, pas proportionnellement aux jetons. Doubler ton stack ne double pas ton gain attendu ; sauter le réduit à zéro. Cette asymétrie, c\'est l\'ICM (Independent Chip Model).', 'Conséquence : un call « rentable en jetons » (équité > cote du pot) peut être perdant en argent réel.'] },
          { h: 'La prime de risque', p: ['C\'est l\'équité supplémentaire qu\'il te faut pour risquer ton tournoi. Elle est maximale à la bulle et en table finale, et contre le joueur qui te couvre.', 'Ordre de grandeur : face au chip leader, ajoute 10 à 15 points d\'équité à la cote du pot avant de payer un tapis.'] },
          { h: 'Qui en profite', p: ['Le chip leader. Les stacks moyens sont coincés par la prime de risque : ils doivent coucher des mains correctes. C\'est là que tu prends tes jetons gratuitement.'] },
        ],
      },
      {
        id: 'bigstack', title: 'Gros stack contre gros stack', minutes: 6, drill: 'icm',
        summary: 'Ton leak principal : ne jamais jouer un pot énorme contre le seul joueur qui peut te sortir.',
        sections: [
          { h: 'La règle d\'or', p: ['Avec un gros tapis, tes deux seules sources de risque sont les joueurs qui te couvrent ou presque. Contre eux : pas de 3-bet léger, pas de call de 4-bet sans main premium, pas de hero call river.', 'Ce n\'est pas de la peur, c\'est de l\'arithmétique : tu as beaucoup à perdre et peu à gagner, alors que les petits stacks t\'offrent le contraire.'] },
          { h: 'Le scénario classique', p: ['Tu es chip leader, le 2e stack relance, tu 3-bet avec AJ « parce que tu as les jetons ». Il 4-bet. Tu paies « pour ne pas te laisser faire ». Flop A-haut, tu mises, il relance, tu paies avec top paire... et tu rends la moitié de ton stack à AQ.', 'À chaque étape, la bonne décision était la plus petite : call préflop, pot control, fold face à l\'agression.'] },
          { h: 'Dans l\'app', p: ['Les badges « Te couvre » rouges te rappellent contre qui le pot doit rester petit. Le mode Chip leader te met exactement dans cette situation ; l\'objectif est de finir le tournoi avec le même tapis ou plus, sans jamais avoir été à tapis contre un gros stack sans premium.'] },
        ],
      },
      {
        id: 'bully', title: 'Le mode bully : mettre la pression au bon endroit', minutes: 4, drill: 'pushfold',
        summary: 'Un gros tapis se fait grandir par les petits pots volés, pas par les coin flips.',
        sections: [
          { h: 'Cibles', p: ['Les stacks de 10 à 25 BB en milieu et fin de tournoi : ils ne peuvent ni payer sans risque ni pousser large. Ouvre sur leurs blinds avec un range très large, 3-bet leurs ouvertures avec des mains jouables.'] },
          { h: 'Sizing', p: ['Petit : 2 à 2,2 BB à l\'ouverture. Tu n\'as pas besoin de miser gros, tu veux un fold. Si tu es payé, joue le flop avec l\'avantage de la position et du stack.'] },
          { h: 'Limites', p: ['Ne bully pas les stacks de moins de 10 BB : ils vont pousser, et tu devras payer avec n\'importe quoi. Et ne bully jamais le joueur qui te couvre.'] },
        ],
      },
      {
        id: 'exploit', title: 'Exploiter les profils', minutes: 4,
        summary: 'Chaque style adverse a une faille. Les bots de l\'app aussi.',
        sections: [
          { h: 'Les quatre profils', p: ['Tight-passif : fold beaucoup, mise rarement. Vole ses blinds, mais respecte ses mises.', 'Loose : joue trop de mains. Value bet plus fin, bluffe moins.', 'Agressif (LAG) : mise et relance sans cesse. Laisse-le bluffer : checke tes fortes mains, paie plus large.', 'Calling station : ne se couche jamais. Ne bluffe jamais, mise gros pour valeur.'] },
          { h: 'Les bots s\'adaptent', p: ['Depuis cette version, les bots observent ton jeu. Si tu couches trop souvent face à une mise, ils bluffent davantage. Si tu paies trop, ils arrêtent de bluffer et misent plus gros pour valeur. Tes stats te diront lequel des deux tu es.'] },
        ],
      },
    ],
  },
]
