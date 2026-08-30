// Les quatre promesses de la generation, verifiees une a une sur des dizaines
// de plateaux. Une promesse non testee est une intention.

import { counter } from './harness.mjs';
import { LIBRE, signature, distanceMinimale, posable } from '../js/plateau.js';
import { longueur, aucunPassageOblige, casesInterdites } from '../js/chemin.js';
import { genererPlateau, budgetDepensable } from '../js/generateur.js';
import { creerHasard } from '../js/hasard.js';

const { check, report } = counter();
console.log('\nGenerateur\n');

const CONFIGURATIONS = [
    { lignes: 10, colonnes: 10, murs: 8 },
    { lignes: 12, colonnes: 12, murs: 12 },
    { lignes: 16, colonnes: 16, murs: 18 }
];

let chemins = 0;
let sansPiege = 0;
let depensables = 0;
let droits = 0;
let total = 0;
let obstaclesVus = 0;

for (const configuration of CONFIGURATIONS) {
    for (let graine = 1; graine <= 20; graine++) {
        const { plateau, budget } = genererPlateau({ ...configuration, graine: graine * 7919 });
        total++;
        if (longueur(plateau) >= 0) chemins++;
        if (aucunPassageOblige(plateau)) sansPiege++;
        if (budgetDepensable(plateau, budget, creerHasard(graine))) depensables++;
        if (longueur(plateau) <= distanceMinimale(plateau) + 2) droits++;
        if (plateau.cases.some(valeur => valeur !== LIBRE)) obstaclesVus++;
    }
}

check(`les ${total} plateaux ont un chemin`, chemins === total, `${chemins}/${total}`);
check('aucun plateau ne commence avec un passage oblige', sansPiege === total, `${sansPiege}/${total}`);
check('le budget est depensable partout', depensables === total, `${depensables}/${total}`);
check('aucun plateau ne commence deja tordu', droits === total, `${droits}/${total}`);
check('les plateaux portent des obstacles', obstaclesVus === total, `${obstaclesVus}/${total}`);

// Meme graine, meme plateau : c'est ce qui permet au defi du jour de se passer
// de serveur, et au catalogue de ne transporter qu'un nombre.
const a = genererPlateau({ lignes: 12, colonnes: 12, murs: 12, graine: 424242 });
const b = genererPlateau({ lignes: 12, colonnes: 12, murs: 12, graine: 424242 });
check('deux generations de meme graine coincident', signature(a.plateau) === signature(b.plateau));
const c = genererPlateau({ lignes: 12, colonnes: 12, murs: 12, graine: 424243 });
check('une graine voisine donne un autre plateau', signature(a.plateau) !== signature(c.plateau));

// L'entree et la sortie se font face, sur des bords opposes, et jamais dans un
// coin — un coin se muselle avec deux murs.
let bordsCorrects = 0;
let horsCoins = 0;
for (let graine = 1; graine <= 30; graine++) {
    const { plateau } = genererPlateau({ lignes: 12, colonnes: 12, murs: 12, graine: graine * 104729 });
    const { entree, sortie, lignes, colonnes } = plateau;
    const le = Math.floor(entree / colonnes);
    const ce = entree % colonnes;
    const ls = Math.floor(sortie / colonnes);
    const cs = sortie % colonnes;
    const opposesHorizontal = ce === 0 && cs === colonnes - 1;
    const opposesVertical = le === 0 && ls === lignes - 1;
    if (opposesHorizontal || opposesVertical) bordsCorrects++;
    const coin = position => (position === 0 || position === lignes - 1 || position === colonnes - 1);
    if (opposesHorizontal ? !coin(le) && !coin(ls) : !coin(ce) && !coin(cs)) horsCoins++;
}
check('entree et sortie sont sur des bords opposes', bordsCorrects === 30, String(bordsCorrects));
check('ni l entree ni la sortie ne sont dans un coin', horsCoins === 30, String(horsCoins));

// Les abords des deux bouts restent libres : le joueur doit pouvoir y batir.
let abordsLibres = 0;
for (let graine = 1; graine <= 30; graine++) {
    const { plateau } = genererPlateau({ lignes: 12, colonnes: 12, murs: 12, graine: graine * 15485863 });
    const interdites = casesInterdites(plateau);
    const autour = i => [i - 12, i + 12, i - 1, i + 1]
        .filter(v => v >= 0 && v < plateau.cases.length)
        .filter(v => posable(plateau, v) && !interdites[v]);
    if (autour(plateau.entree).length >= 2 && autour(plateau.sortie).length >= 2) abordsLibres++;
}
check('les abords de l entree et de la sortie sont batissables', abordsLibres === 30, String(abordsLibres));

report();
