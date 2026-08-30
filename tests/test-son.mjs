// Le son se concoit au telephone, pas a l'ordinateur.
//
// Compter les notes emises ne dit rien de ce qui arrive a l'oreille : une note
// sous 300 Hz s'entend parfaitement sur un ordinateur et n'existe pas sur un
// haut-parleur d'iPhone. Ce test tient le plancher — pour l'echelle, et pour
// les timbres a hauteur fixe, releves a la source.

import { readFileSync } from 'node:fs';
import { counter } from './harness.mjs';
import { hauteurDe, degreDe, FONDAMENTALE, PLANCHER } from '../js/son.js';

const { check, report } = counter();
console.log('\nSon\n');

const echelle = Array.from({ length: 15 }, (_, degre) => hauteurDe(degre));
check('toute l echelle est au-dessus du plancher de 300 Hz',
    echelle.every(frequence => frequence >= PLANCHER), `${Math.min(...echelle).toFixed(0)} Hz`);
check('l echelle monte', echelle.every((frequence, i) => i === 0 || frequence > echelle[i - 1]));
check('la fondamentale est le mi 4', FONDAMENTALE === 330);
check('un degre negatif ne descend pas sous la fondamentale', hauteurDe(-5) === FONDAMENTALE);
check('un degre demesure reste borne', hauteurDe(999) === hauteurDe(14));

// Le degre suit le detour : rien de gagne sonne en bas de l'echelle, le
// meilleur connu atteint sonne en haut.
check('sans detour, le degre est nul', degreDe({ longueur: 20, depart: 20, meilleurConnu: 60 }) === 0);
check('au meilleur connu, le degre est au sommet',
    Math.round(degreDe({ longueur: 60, depart: 20, meilleurConnu: 60 })) === 12);
check('a mi-parcours, le degre est au milieu',
    Math.round(degreDe({ longueur: 40, depart: 20, meilleurConnu: 60 })) === 6);
check('sans meilleur connu, le degre reste borne',
    degreDe({ longueur: 500, depart: 10, meilleurConnu: null }) <= 12);

// Les timbres a hauteur fixe, releves dans le code plutot que dans le souvenir
// qu'on en a.
const source = readFileSync(new URL('../js/son.js', import.meta.url), 'utf8');
const fixes = [...source.matchAll(/note\((\d{2,5})[,)]/g)].map(([, valeur]) => Number(valeur));
const listes = [...source.matchAll(/\[(\d{3}(?:,\s*\d{3,4})+)\]/g)]
    .flatMap(([, liste]) => liste.split(',').map(valeur => Number(valeur.trim())));
const toutes = [...fixes, ...listes];
check(`les ${toutes.length} hauteurs fixes du fichier tiennent le plancher`,
    toutes.every(frequence => frequence >= PLANCHER), toutes.filter(f => f < PLANCHER).join(' '));

// La descente d'un son ne doit pas passer sous le plancher non plus : c'est la
// moitie de la note qui disparaitrait.
const descentes = [...source.matchAll(/vers:\s*([A-Z_]+\s*\+\s*\d+|\d+)/g)].map(([, valeur]) => valeur);
check('aucune descente ne vise un nombre sous le plancher',
    descentes.every(valeur => /[A-Z]/.test(valeur) || Number(valeur) >= PLANCHER), descentes.join(' '));

// Le deblocage au geste : sans lui, un iPhone reste muet toute la partie.
check('le contexte se prepare sur un evenement d activation',
    source.includes("'pointerdown'") && source.includes("'touchend'") && source.includes('preparerSon'));
check('le son se tait quand l onglet passe derriere',
    source.includes('visibilitychange') && source.includes('suspend'));
check('aucun fichier audio n est charge', !/new Audio\(|\.mp3|\.wav|\.ogg/.test(source));

report();
