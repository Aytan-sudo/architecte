# L’Architecte

Vous posez les murs, la machine cherche le plus court chemin, et le but est de
l’allonger. Jouable au doigt, hors ligne, sans serveur ni dépendance — une page
statique posée sur GitHub Pages.

Sa particularité : **les rôles sont inversés**. Tous les autres jeux de la
collection demandent de résoudre ce qu’une machine a posé. Ici, c’est vous qui
construisez, et la machine qui résout après vous. À chaque mur, elle recalcule
son chemin, le redessine, et vous montre exactement ce que votre pose lui a
coûté. Le score est cette longueur.

## Version 1.0.0

- première version : défi du jour, partie libre, cinq thèmes, records par
  configuration, sons de synthèse, jouable hors ligne.

## Jouer

<https://aytan-sudo.github.io/architecte/>

**Tapez une case libre : un mur s’y pose. Retapez-la : il repart.** C’est le
seul geste du jeu.

Trois chiffres restent visibles en permanence :

- **le détour** — la longueur du plus court chemin actuel, votre score ;
- **les murs restants** — votre budget ;
- **le meilleur connu** — voir plus bas, ce chiffre mérite une explication.

Une règle dure, et une seule : **un mur qui rendrait la sortie inatteignable
est refusé**. La case recule, votre budget reste intact, et aucune boîte de
dialogue ne vient vous expliquer ce que vous venez de voir.

Annuler et refaire sont illimités. La pose est exploratoire : c’est en défaisant
qu’on trouve où le mur aurait vraiment dû aller.

Au clavier : les flèches déplacent, `Entrée` pose ou retire, `U` ou `Ctrl+Z`
annulent, `Y` refait, `R` relance la grille, `N` ouvre une partie libre, `T`
change de thème, `?` ouvre la notice, `Échap` ferme.

## Le meilleur connu — et pourquoi ce n’est pas « l’optimal »

Trouver le placement de K murs qui maximise le plus court chemin est un problème
d’optimisation combinatoire. Sur une grille de 16 × 16 avec 18 murs, il y a de
l’ordre de 10³⁰ placements : l’optimum exact est hors de portée, et le jeu ne
prétend pas le connaître.

Ce que le troisième chiffre annonce est donc **le meilleur résultat qu’une
recherche automatique a su trouver**, jamais l’optimum. La recherche a deux
étages :

1. **une recherche en faisceau**, qui construit le placement mur par mur. Elle
   n’essaie que les cases situées sur un plus court chemin et leurs voisines —
   un mur posé ailleurs ne change rien à la longueur, c’est ce qui rend la
   recherche possible ;
2. **un recuit simulé** par-dessus, qui déplace un mur à la fois et défait les
   premiers choix du faisceau, là où celui-ci reste prisonnier.

Le budget de recherche est compté **en itérations, jamais en secondes**. Un
budget en temps donnerait un chiffre différent selon le téléphone, et le défi du
jour cesserait d’être comparable — c’est tout ce qui fait sa valeur.

Pour le défi du jour, ce calcul est fait **hors ligne**, une fois, à la
fabrication du jeu (`npm run catalogue`) : quelques centaines de millisecondes
de recherche profonde par grille, dont le résultat voyage dans
`data/defis.json`. En partie libre, une recherche plus courte tourne dans le
navigateur, dans un fil séparé — donc un meilleur connu plus facile à battre.

**Si vous faites mieux, vous avez battu la machine**, et le jeu vous le dit.
C’est la meilleure chose qui puisse arriver dans cette page. L’égalité est déjà
un exploit : sur la plupart des grilles, personne ne sait s’il existe mieux.

## Les modes

**Défi du jour** — la même grille pour tout le monde, dérivée de la date, sans
serveur : le générateur la refabrique chez chacun. Le format change avec le jour
de la semaine — *Esquisse* (10 × 10, 8 murs) du lundi au jeudi, *Chantier*
(12 × 12, 12 murs) le vendredi, *Grand œuvre* (16 × 16, 18 murs) le week-end.
Adresse : `?jour=AAAA-MM-JJ`. Seul le défi joué le jour même compte pour la
série ; un lien du jour rouvert plus tard redonne la grille, hors série.

**Partie libre** — la taille et le budget de votre choix, de 8 × 8 à 20 × 20.
Partageable par `?taille=…&murs=…&seed=…`.

Les records sont tenus **par configuration** : un détour de 71 en grand œuvre ne
concourt pas contre un détour de 26 en esquisse.

Le bouton Partager copie un texte compact — le score, le meilleur connu, le
lien. Jamais la solution.

## Les thèmes

Cinq palettes, du clair au sombre : **Carmin**, **Menthe**, **Papier**,
**Encre**, **Prune**. Le parti pris ne change pas d’un thème à l’autre — le
chemin est traité comme une ligne de réseau, ruban épais à angles arrondis avec
une pastille à chaque virage — c’est la teinte de la ligne qui change, comme on
change de ligne sur un plan. Les couleurs vivent toutes dans `css/themes.css`,
et un test compare chaque palette à celle de référence : une variable oubliée ne
plante pas, elle laisse une couleur claire au milieu d’un thème sombre.

## Sous le capot

**Le noyau ne touche pas au DOM.** Génération, plus court chemin, score,
recherche du meilleur connu, défi du jour : tout se teste en Node, sans
navigateur. C’est la contrainte d’architecture la plus importante du projet, et
`tests/test-page.mjs` vérifie qu’elle tient.

```
js/hasard.js       le seul générateur pseudo-aléatoire du projet, à graine
js/plateau.js      la grille, ses cases, son empreinte
js/chemin.js       parcours en largeur, tracé retenu, tracés multiples, poses interdites
js/generateur.js   les plateaux, et les quatre promesses ci-dessous
js/solveur.js      faisceau + recuit — jamais chargé par la page
js/partie.js       budget, pose, annulation illimitée, score
js/rendu.js        la grille en DOM, le tracé en SVG
js/entree.js       doigt, souris, clavier
js/defi.js         la date → la graine → la grille ; le partage
js/recherche.js    le meilleur connu : catalogue d’abord, fil séparé ensuite
js/stockage.js     préférences, reprise, records, migrations
```

**Le tracé est l’objet le plus important de l’écran**, et tout le budget
d’animation va là : il pousse depuis l’entrée en un peu moins d’une demi-seconde,
et ses pastilles de virage apparaissent dans son sillage. Voir le chemin
contourner ce qu’on vient de poser, c’est le jeu entier.

**Quand plusieurs plus courts chemins existent**, un seul est dessiné — celui
que l’ordre des voisins désigne, fixé une fois pour toutes — et les autres
apparaissent en pointillés, avec leur nombre annoncé sous les compteurs. Sans
cela, le tracé qui saute d’un côté à l’autre après une pose sans rapport passe
pour un bug.

### Ce que la génération promet

Quatre promesses, vérifiées avant qu’un plateau soit livré :

1. **un chemin existe** de l’entrée à la sortie ;
2. **aucune case libre n’est un passage obligé** au départ : au premier coup, on
   peut poser où l’on veut, sans piège invisible ;
3. **le budget est entièrement dépensable** — une suite de poses légales
   l’épuise, vérifiée en la jouant ;
4. **le plateau ne commence pas déjà tordu** : la longueur de départ ne dépasse
   pas la distance à vol d’oiseau de plus de deux pas. Le détour doit être votre
   œuvre, pas un cadeau.

Ce qui n’est **pas** promis : que le meilleur connu soit atteignable par un
humain, ni qu’il soit l’optimum. Personne ne connaît l’optimum.

### Le coût, mesuré

Le prompt de départ prévoyait de passer à un recalcul incrémental si le
recalcul complet ramait sur une grille de 20 × 20. Il ne rame pas : **2 µs par
recalcul complet**, mesurés dans `tests/test-chemin.mjs`, qui refuse de passer
au-delà de 100 µs. Le calcul incrémental attendra d’être nécessaire.

### Le son

Synthèse WebAudio, aucun fichier audio. La hauteur de la note monte avec le
détour : on entend le chantier progresser sans regarder les chiffres. Toute
l’échelle vit **au-dessus de 300 Hz** — un haut-parleur de téléphone ne
restitue à peu près rien en dessous — et un test tient ce plancher. Le contexte
audio se prépare au premier geste, faute de quoi iOS le laisserait suspendu pour
toute la partie.

### Où entrent les extensions prévues

Trois variantes ont été écartées de cette version, mais le code les attend :

- **murs à coûts variables** : dans `partie.js`, là où le budget se décrémente
  d’un — il suffit d’un `coutMur(case)` ;
- **obligation de laisser deux chemins disjoints** : dans `chemin.js`, derrière
  `analyser()`, qui rend déjà un objet plutôt qu’un nombre ;
- **portes à ouvrir** : dans le test de franchissabilité du parcours en largeur,
  aujourd’hui un `=== LIBRE` qui deviendrait un prédicat.

## Développement

Aucune dépendance de production, aucun bundler, aucune étape de compilation. Les
modules ES sont chargés par le navigateur — **ils ne fonctionnent pas en
`file://`**, il faut un serveur :

```bash
npm run serve     # http://localhost:8772
npm test          # 209 vérifications, en Node, sans navigateur
npm run check     # node --check sur chaque module
npm run catalogue # refabrique data/defis.json (quelques minutes)
```

Le catalogue ne se refabrique que si la génération ou le solveur changent :
chaque entrée porte l’empreinte de sa grille, et le jeu écarte un chiffre dont
l’empreinte ne correspond pas plutôt que de l’afficher à tort.

## Ce qui n’est pas là

**L’optimum exact.** Il est hors de portée, et prétendre le connaître serait le
seul vrai mensonge que ce jeu pourrait faire. Le mot « optimal » n’apparaît
nulle part dans l’interface.

**La solution de la machine.** Le catalogue ne transporte que des nombres,
jamais un placement : un fichier public qui porterait les murs serait un fichier
de spoilers. Vous ne verrez donc jamais *comment* elle a fait — seulement
qu’elle l’a fait.

**Les diagonales.** Le chemin se déplace en quatre directions. Les huit
directions rendraient les murs beaucoup moins efficaces et le tracé beaucoup
moins lisible.

**Le glissé pour poser une rangée de murs.** Un seul geste, une seule case. Le
plaisir du jeu est dans l’hésitation, pas dans la vitesse de pose.

**Le chronomètre.** Rien ne presse. Un jeu de construction où l’on se dépêche
n’a plus d’intérêt.
