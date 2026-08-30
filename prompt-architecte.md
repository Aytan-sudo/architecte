# Prompt Claude Code — L'Architecte

```
Je veux un jeu de construction jouable dans le navigateur, hébergé sur GitHub Pages.
Interface en français. Mobile d'abord.

MES CONVENTIONS — reprends-les à l'identique (modèle : github.com/Aytan-sudo/demineur)
  index.html (aucune logique) · css/ (toutes les couleurs en variables CSS) · js/ (modules ES)
  tests/ (exécutables en Node) · assets/ · sw.js (jouable hors ligne)
  manifest.webmanifest · package.json (npm test, npm run serve) · README.md en français
- Aucune dépendance, aucun bundler, aucune étape de compilation. Modules ES natifs.
- Les modules ES ne se chargent pas en file:// : prévois npm run serve. Ne me dis jamais
  d'ouvrir index.html directement.
- LE NOYAU NE TOUCHE PAS AU DOM : génération, plus court chemin, score, défi du jour se
  testent en Node sans navigateur. C'est la contrainte d'architecture la plus importante.
- js/hasard.js isole le générateur pseudo-aléatoire à graine ; rien d'autre n'appelle
  Math.random. Graine dérivée de la date = même puzzle pour tout le monde, sans serveur.
- Thèmes en variables CSS, avec un test comparant chaque palette à celle de référence.
- Cibles tactiles de 44 px minimum, comme dans mes autres jeux.
- README au format de celui du démineur, avec sa section « Ce qui n'est pas là ».
- À la fin, ajoute le jeu au hub :
  node ~/dev/python/Jeux_Pages/HUB/ajouter-jeu.mjs --tags "réflexion,construction,solo,quotidien"

L'IDÉE, ET POURQUOI ELLE EST DIFFÉRENTE DE MES AUTRES JEUX
Tous mes jeux demandent de RÉSOUDRE un puzzle qu'une machine a posé. Celui-ci inverse les
rôles : le joueur CONSTRUIT, et la machine résout après lui. Ne perds jamais ça de vue,
c'est la seule raison d'être du projet.

RÈGLES
- Une grille (12×12 pour commencer), une case d'entrée sur un bord, une case de sortie sur
  le bord opposé. Quelques obstacles fixes posés par la génération.
- Le joueur dispose d'un budget de murs (12 par exemple). Il transforme des cases libres
  en cases pleines.
- Après chaque pose, le moteur recalcule le plus court chemin de l'entrée à la sortie et
  l'affiche, tracé sur la grille, avec sa longueur.
- Le score est cette longueur. Le but est de la maximiser en ayant posé tous ses murs.
- RÈGLE DURE : un mur qui rendrait la sortie inatteignable est refusé. Le chemin doit
  toujours exister. Refuse le placement par un simple retour visuel, sans boîte de dialogue.
- Annuler et refaire sans limite : la pose est exploratoire, c'est le cœur du plaisir.

LE PAR — sois honnête sur ce point, c'est important
Trouver le placement de K murs qui maximise le plus court chemin est un problème
d'optimisation combinatoire dont je ne veux PAS l'optimum exact : c'est hors de portée en
temps raisonnable dès que la grille grandit. Fais donc ceci :
- À la génération, lance une recherche heuristique hors ligne (recuit simulé ou recherche
  en faisceau, quelques secondes) et stocke le meilleur résultat trouvé avec le puzzle.
- Appelle-le « le meilleur connu », jamais « l'optimal ». Le README doit le dire aussi.
- Si un joueur fait mieux, le jeu le célèbre explicitement : il vient de battre la machine.
  C'est la meilleure sensation que ce jeu puisse produire, mets-la en valeur.

ÉTAPE A — LE NOYAU, testé en Node avant toute interface
- Plus court chemin par BFS sur grille avec obstacles. Recalcul après chaque pose : mesure
  le coût, et si ça rame sur 20×20, passe à un recalcul incrémental.
- Générateur de plateaux : entrée, sortie, obstacles fixes, budget de murs. Vérifie qu'un
  chemin existe avant toute pose, et que le budget ne permet jamais de fermer la grille.
- La recherche heuristique du meilleur connu, avec ses tests : sur un plateau vide 5×5 à
  2 murs, l'optimum est calculable exhaustivement — sers-t'en pour vérifier que
  l'heuristique le retrouve.

ÉTAPE B — L'INTERFACE
- Taper une case libre y pose un mur, la retaper le retire. Rien d'autre.
- Le chemin se redessine en temps réel, avec une animation courte : voir le tracé
  s'allonger et contourner ce qu'on vient de poser, c'est TOUT le plaisir du jeu.
  C'est là que va ton budget d'animation, pas ailleurs.
- Trois chiffres visibles en permanence : longueur actuelle, murs restants, meilleur connu.
- Quand plusieurs plus courts chemins existent, dessine celui que le solveur a retenu mais
  indique discrètement qu'il en existe d'autres — sinon le joueur croit à un bug quand le
  tracé saute d'un côté à l'autre après une pose sans rapport.

ÉTAPE C — MODES
- Défi du jour : plateau et budget identiques pour tous, dérivés de la date. Partage en
  texte : score obtenu, meilleur connu, murs utilisés.
- Libre : choix de la taille et du budget.
- Records par configuration en localStorage.

CE QUE TU N'IMPLÉMENTES PAS MAINTENANT
Murs à coûts variables, obligation de laisser deux chemins disjoints, portes à ouvrir.
Structure le code pour qu'ils entrent sans réécriture et dis-moi où, en trois lignes.

DESIGN
Le sujet, c'est la construction et le détour imposé. Propose-moi une direction — palette de
4 à 6 couleurs nommées, deux familles typographiques, un élément signature — AVANT d'écrire
le CSS. Le tracé du chemin est l'objet le plus important de l'écran, traite-le comme tel.
Évite le fond sombre à accent fluo et le style « plan d'architecte » au trait bleu : ce sont
les deux réflexes attendus.

ORDRE DE LIVRAISON : A, puis B, puis C, puis l'habillage. Montre-moi chaque étape avant de
passer à la suivante. Commence par ton plan et ta stratégie pour l'heuristique. Je valide,
tu codes.
```
