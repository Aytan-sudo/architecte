// Le juge du jeu : plus court chemin, traces multiples, poses interdites.

import { counter, plateauDessine } from './harness.mjs';
import { MUR, LIBRE, creerPlateau } from '../js/plateau.js';
import { analyser, longueur, poseLegale, casesInterdites, aucunPassageOblige, creerTampons, avecMurs } from '../js/chemin.js';

const { check, report } = counter();
console.log('\nChemin\n');

// Une ligne droite, sans surprise.
const droit = plateauDessine(`
    . . .
    E . S
    . . .
`);
const analyseDroite = analyser(droit).liaisons[0];
check('la ligne droite mesure deux pas', analyseDroite.longueur === 2, String(analyseDroite.longueur));
check('le trace passe par le milieu', analyseDroite.chemin.join(',') === '3,4,5', analyseDroite.chemin.join(','));
check('un seul trace possible', analyseDroite.nombreTraces === 1, String(analyseDroite.nombreTraces));
check('aucun virage sur une droite', analyseDroite.virages.length === 0);

// Un obstacle au milieu : deux contournements de meme longueur.
const contourne = plateauDessine(`
    . . .
    E # S
    . . .
`);
const analyseContour = analyser(contourne).liaisons[0];
check('contourner coute quatre pas', analyseContour.longueur === 4, String(analyseContour.longueur));
check('deux traces existent', analyseContour.nombreTraces === 2, String(analyseContour.nombreTraces));
check('le trace retenu passe par le haut', analyseContour.chemin.join(',') === '3,0,1,2,5', analyseContour.chemin.join(','));
check('le trace du bas est signale comme alternative',
    analyseContour.alternatives.includes(6) && analyseContour.alternatives.includes(7),
    analyseContour.alternatives.join(','));
check('le contournement compte deux virages', analyseContour.virages.length === 2, analyseContour.virages.join(','));

// Le meme plateau analyse deux fois donne le meme trace : le dessin ne depend
// pas de l'ordre d'insertion dans une table, il depend de l'ordre des voisins.
check('l analyse est deterministe',
    JSON.stringify(analyser(contourne).liaisons[0].chemin) === JSON.stringify(analyseContour.chemin));

// Sortie muree : le moteur le dit, il ne plante pas.
const ferme = plateauDessine(`
    . . #
    E . #
    . . #
`);
check('une sortie inatteignable renvoie -1',
    analyser({ ...ferme, liaisons: [{ entree: ferme.liaisons[0].entree, sortie: 8, stations: [] }] }).longueur === -1);

// La regle dure.
const couloir = plateauDessine(`
    # # #
    E . S
    # # #
`);
check('poser dans le couloir est refuse', poseLegale(couloir, 4) === false);
check('l entree n est pas posable', poseLegale(couloir, 3) === false);
const interdites = casesInterdites(couloir);
check('la case du couloir est signalee interdite', interdites[4] === 1);
check('le couloir a un passage oblige', aucunPassageOblige(couloir) === false);
check('la grille libre n en a aucun', aucunPassageOblige(creerPlateau({ lignes: 5, colonnes: 5, entree: 10, sortie: 14 })));

// Poser un mur ne raccourcit jamais : c'est la propriete sur laquelle repose
// toute la strategie du solveur.
const grand = creerPlateau({ lignes: 8, colonnes: 8, entree: 24, sortie: 31 });
let croissant = true;
let position = grand;
for (const mur of [25, 33, 41, 42]) {
    const avant = longueur(position);
    position = avecMurs(position, [mur]);
    const apres = longueur(position);
    if (apres >= 0 && apres < avant) croissant = false;
}
check('un mur n a jamais raccourci le chemin', croissant);

// Le cout, mesure plutot que suppose. Le prompt demandait de passer au calcul
// incremental si le recalcul complet ramait sur 20x20 : voici le chiffre.
const vingt = creerPlateau({ lignes: 20, colonnes: 20, entree: 200, sortie: 219 });
const tampons = creerTampons(400);
const debut = process.hrtime.bigint();
const TOURS = 20000;
for (let i = 0; i < TOURS; i++) {
    vingt.cases[i % 400] = vingt.cases[i % 400] === MUR ? LIBRE : MUR;
    longueur(vingt, tampons);
    vingt.cases[i % 400] = LIBRE;
}
const micros = Number(process.hrtime.bigint() - debut) / 1000 / TOURS;
console.log(`  ...   un recalcul complet sur 20x20 : ${micros.toFixed(1)} microsecondes`);
check('le recalcul complet reste sous 100 microsecondes sur 20x20', micros < 100, `${micros.toFixed(1)} us`);

report();
