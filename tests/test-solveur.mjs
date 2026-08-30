// L'etalonnage du « meilleur connu ».
//
// Le chiffre affiche au joueur n'a de valeur que si quelqu'un a verifie que la
// recherche sait trouver ce qu'il y a a trouver. Sur les petites grilles,
// l'optimum se calcule exhaustivement : on exige que l'heuristique le retrouve.
// Au-dela, personne ne connait l'optimum — et le jeu ne pretend pas le connaitre.

import { counter } from './harness.mjs';
import { LIBRE, creerPlateau, posable } from '../js/plateau.js';
import { longueur, avecMurs } from '../js/chemin.js';
import { chercherMeilleur, optimumExhaustif, REGLAGES_RAPIDES, REGLAGES_PROFONDS } from '../js/solveur.js';
import { genererPlateau } from '../js/generateur.js';

const { check, report } = counter();
console.log('\nSolveur\n');

// 5x5 vide, 2 murs : 253 placements, l'optimum est connaissable.
const petit = creerPlateau({ lignes: 5, colonnes: 5, entree: 10, sortie: 14 });
const exact5 = optimumExhaustif(petit, 2);
const trouve5 = chercherMeilleur(petit, 2, { ...REGLAGES_RAPIDES, graine: 1 });
check(`5x5 a 2 murs : l optimum vaut ${exact5.longueur}`, exact5.longueur > longueur(petit));
check('l heuristique retrouve l optimum sur 5x5', trouve5.longueur === exact5.longueur,
    `${trouve5.longueur} contre ${exact5.longueur}`);

// 6x6 vide, 3 murs : environ 6 000 placements.
const moyen = creerPlateau({ lignes: 6, colonnes: 6, entree: 12, sortie: 17 });
const exact6 = optimumExhaustif(moyen, 3);
const trouve6 = chercherMeilleur(moyen, 3, { ...REGLAGES_RAPIDES, graine: 2 });
check(`6x6 a 3 murs : l optimum vaut ${exact6.longueur}`, exact6.longueur > longueur(moyen));
check('l heuristique retrouve l optimum sur 6x6', trouve6.longueur === exact6.longueur,
    `${trouve6.longueur} contre ${exact6.longueur}`);

// Sur des plateaux generes, obstacles compris.
let egales = 0;
let essais = 0;
for (let graine = 1; graine <= 6; graine++) {
    const { plateau } = genererPlateau({ lignes: 7, colonnes: 7, murs: 3, graine: graine * 7919 });
    const exact = optimumExhaustif(plateau, 3);
    const trouve = chercherMeilleur(plateau, 3, { ...REGLAGES_RAPIDES, graine });
    essais++;
    if (trouve.longueur === exact.longueur) egales++;
    else console.log(`  ...   graine ${graine} : ${trouve.longueur} contre ${exact.longueur}`);
}
check(`l heuristique retrouve l optimum sur ${essais} plateaux 7x7 avec obstacles`, egales === essais,
    `${egales}/${essais}`);

// La solution rendue est jouable : des cases posables, toutes distinctes, le
// budget entier, et un chemin qui existe encore.
const { plateau: douze } = genererPlateau({ lignes: 12, colonnes: 12, murs: 12, graine: 20260830 });
const solution = chercherMeilleur(douze, 12, { ...REGLAGES_RAPIDES, graine: 3 });
check('la solution depense tout le budget', solution.murs.length === 12, String(solution.murs.length));
check('la solution ne pose que sur des cases posables', solution.murs.every(i => posable(douze, i)));
check('la solution ne pose pas deux fois au meme endroit', new Set(solution.murs).size === solution.murs.length);
check('la solution laisse un chemin', longueur(avecMurs(douze, solution.murs)) === solution.longueur,
    `${longueur(avecMurs(douze, solution.murs))} contre ${solution.longueur}`);
check('la solution allonge vraiment le chemin', solution.longueur > longueur(douze),
    `${solution.longueur} contre ${longueur(douze)}`);

// Meme graine, meme resultat — sur n'importe quelle machine. C'est ce qui rend
// le chiffre du defi du jour comparable d'un joueur a l'autre.
const encore = chercherMeilleur(douze, 12, { ...REGLAGES_RAPIDES, graine: 3 });
check('la recherche est deterministe',
    encore.longueur === solution.longueur && encore.murs.join(',') === solution.murs.join(','));

// Le budget en iterations, pas en secondes : c'est la condition de ce
// determinisme. Un budget en temps donnerait un chiffre different selon le
// telephone.
const source = (await import('node:fs')).readFileSync(new URL('../js/solveur.js', import.meta.url), 'utf8');
check('le solveur n interroge jamais l horloge', !/Date\.now|performance\.now|hrtime/.test(source));
check('le solveur n appelle pas Math.random', !/Math\.random/.test(source));

// La recherche profonde fait au moins aussi bien que la rapide : c'est ce qui
// justifie de la payer a la generation du catalogue.
const rapide = chercherMeilleur(douze, 12, { ...REGLAGES_RAPIDES, graine: 5 });
const profond = chercherMeilleur(douze, 12, { ...REGLAGES_PROFONDS, graine: 5 });
console.log(`  ...   rapide ${rapide.longueur}, profond ${profond.longueur}`);
check('la recherche profonde ne fait jamais moins bien que la rapide', profond.longueur >= rapide.longueur,
    `${profond.longueur} contre ${rapide.longueur}`);

report();
