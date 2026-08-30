// La generation d'un plateau.
//
// Un plateau doit tenir quatre promesses, et chacune est verifiee avant d'etre
// livree (tests/test-generateur.mjs les reprend une a une) :
//
// 1. Un chemin existe de l'entree a la sortie.
// 2. Aucune case libre n'est un passage oblige : au premier coup, le joueur
//    peut poser ou il veut. Pas de piege invisible.
// 3. Le budget est entierement depensable — il existe une suite de poses
//    legales qui l'epuise. Un joueur ne peut pas se retrouver avec des murs en
//    main et aucune case ou les mettre.
// 4. Le plateau ne commence pas deja tordu : la longueur de depart ne depasse
//    pas la distance a vol d'oiseau de plus de deux pas. Le detour doit etre
//    l'oeuvre du joueur, pas un cadeau de la generation.
//
// Ce qui n'est pas promis : que le meilleur connu soit atteignable par un
// humain, ni qu'il soit l'optimum. Voir solveur.js.

import { creerHasard } from './hasard.js';
import { LIBRE, OBSTACLE, MUR, creerPlateau, indice, distanceMinimale, posable, voisins } from './plateau.js';
import { creerTampons, longueur, aucunPassageOblige, casesInterdites } from './chemin.js';

// Des blocs plutot que des cases isolees : un semis de points donne une
// grille grise et sans caractere, tandis que des petits pans de mur donnent des
// couloirs et des recoins — de la matiere a contourner.
const FORMES = [
    [[0, 0]],
    [[0, 0], [0, 1]],
    [[0, 0], [1, 0]],
    [[0, 0], [0, 1], [0, 2]],
    [[0, 0], [1, 0], [2, 0]],
    [[0, 0], [1, 0], [1, 1]],
    [[0, 0], [0, 1], [1, 1]],
    [[0, 0], [0, 1], [1, 0]]
];

const DENSITE = 0.12;

export function genererPlateau({ lignes, colonnes, murs, graine, tentatives = 400 }) {
    const hasard = creerHasard(graine);
    let densite = DENSITE;

    for (let essai = 0; essai < tentatives; essai++) {
        // Toutes les vingt tentatives, on desserre : une configuration trop
        // exigeante finit toujours par accoucher d'un plateau plus sage plutot
        // que de tourner en rond.
        if (essai > 0 && essai % 20 === 0) densite *= 0.85;

        const plateau = tenter({ lignes, colonnes, murs, hasard, densite });
        if (plateau) return { plateau, budget: murs, graine, essais: essai + 1 };
    }

    // Filet : une grille nue tient les quatre promesses par construction.
    return { plateau: grilleNue({ lignes, colonnes, hasard }), budget: murs, graine, essais: tentatives };
}

function bordsOpposes({ lignes, colonnes, hasard }) {
    // On evite les coins : une entree dans un coin se muselle avec deux murs,
    // et le plateau perd tout interet des le deuxieme coup.
    if (hasard.suivant() < 0.5) {
        const a = hasard.entre(1, lignes - 2);
        const b = hasard.entre(1, lignes - 2);
        return { entree: a * colonnes, sortie: b * colonnes + colonnes - 1 };
    }
    const a = hasard.entre(1, colonnes - 2);
    const b = hasard.entre(1, colonnes - 2);
    return { entree: a, sortie: (lignes - 1) * colonnes + b };
}

function grilleNue({ lignes, colonnes, hasard }) {
    const { entree, sortie } = bordsOpposes({ lignes, colonnes, hasard });
    return creerPlateau({ lignes, colonnes, entree, sortie });
}

function tenter({ lignes, colonnes, murs, hasard, densite }) {
    const plateau = grilleNue({ lignes, colonnes, hasard });
    const total = lignes * colonnes;
    const vise = Math.round(total * densite);

    // Les abords immediats de l'entree et de la sortie restent libres : le
    // joueur doit pouvoir y poser ses propres murs.
    const interdit = new Uint8Array(total);
    for (const bout of [plateau.entree, plateau.sortie]) {
        interdit[bout] = 1;
        for (const v of voisins(plateau, bout)) interdit[v] = 1;
    }

    let poses = 0;
    let echecs = 0;
    while (poses < vise && echecs < 200) {
        const forme = hasard.choisir(FORMES);
        const ligne = hasard.entier(lignes);
        const colonne = hasard.entier(colonnes);
        const cellules = [];
        let bon = true;
        for (const [dl, dc] of forme) {
            const l = ligne + dl;
            const c = colonne + dc;
            if (l >= lignes || c >= colonnes) { bon = false; break; }
            const i = indice(plateau, l, c);
            if (interdit[i] || plateau.cases[i] !== LIBRE) { bon = false; break; }
            cellules.push(i);
        }
        if (!bon) { echecs++; continue; }
        for (const i of cellules) plateau.cases[i] = OBSTACLE;
        poses += cellules.length;
    }

    return acceptable(plateau, murs, hasard) ? plateau : null;
}

function acceptable(plateau, murs, hasard) {
    const tampons = creerTampons(plateau.cases.length);
    const depart = longueur(plateau, tampons);
    if (depart < 0) return false;
    if (depart > distanceMinimale(plateau) + 2) return false;

    let libres = 0;
    for (let i = 0; i < plateau.cases.length; i++) if (plateau.cases[i] === LIBRE) libres++;
    if (libres < murs * 4) return false;

    if (!aucunPassageOblige(plateau)) return false;
    return budgetDepensable(plateau, murs, hasard);
}

// La troisieme promesse, verifiee en la jouant : on pose reellement le budget,
// au hasard parmi les cases legales, et on regarde si on va au bout. Une seule
// suite reussie suffit a prouver qu'elle existe.
export function budgetDepensable(plateau, budget, hasard = creerHasard(7)) {
    const cases = Uint8Array.from(plateau.cases);
    const copie = { ...plateau, cases };
    const tampons = creerTampons(cases.length);

    for (let pose = 0; pose < budget; pose++) {
        const interdites = casesInterdites(copie);
        const candidates = [];
        for (let i = 0; i < cases.length; i++) {
            if (posable(copie, i) && !interdites[i]) candidates.push(i);
        }
        if (candidates.length === 0) return false;
        cases[hasard.choisir(candidates)] = MUR;
        if (longueur(copie, tampons) < 0) return false;
    }
    return true;
}
