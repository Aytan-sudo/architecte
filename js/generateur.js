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
import { LIBRE, OBSTACLE, MUR, creerPlateau, creerLiaison, indice, distanceMinimale, posable, voisins, bouts, ligneDe, colonneDe } from './plateau.js';
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

export function genererPlateau({ lignes, colonnes, murs, graine, stations = 0, doubleLigne = false, tentatives = 400 }) {
    const hasard = creerHasard(graine);
    let densite = DENSITE;

    for (let essai = 0; essai < tentatives; essai++) {
        // Toutes les vingt tentatives, on desserre : une configuration trop
        // exigeante finit toujours par accoucher d'un plateau plus sage plutot
        // que de tourner en rond.
        if (essai > 0 && essai % 20 === 0) densite *= 0.85;

        const plateau = tenter({ lignes, colonnes, murs, hasard, densite, stations, doubleLigne });
        if (plateau) return { plateau, budget: murs, graine, essais: essai + 1 };
    }

    // Filet : une grille nue tient les quatre promesses par construction.
    return {
        plateau: grilleNue({ lignes, colonnes, hasard, stations: 0, doubleLigne }),
        budget: murs, graine, essais: tentatives
    };
}

// On evite les coins : une entree dans un coin se muselle avec deux murs, et le
// plateau perd tout interet des le deuxieme coup.
function bordsOpposes({ lignes, colonnes, hasard, horizontal }) {
    if (horizontal) {
        const a = hasard.entre(1, lignes - 2);
        const b = hasard.entre(1, lignes - 2);
        return creerLiaison(a * colonnes, b * colonnes + colonnes - 1);
    }
    const a = hasard.entre(1, colonnes - 2);
    const b = hasard.entre(1, colonnes - 2);
    return creerLiaison(a, (lignes - 1) * colonnes + b);
}

// Les stations : des cases a desservir, posees loin des bords et loin les unes
// des autres, puis rangees dans l'ordre ou la liaison les rencontrera. Une
// station collee a l'entree ne demanderait aucun detour.
function poserStations({ lignes, colonnes, hasard, liaison, combien }) {
    const marge = 2;
    const choisies = [];
    const assezLoin = i => choisies.concat([liaison.entree, liaison.sortie]).every(autre => {
        const distance = Math.abs(Math.floor(i / colonnes) - Math.floor(autre / colonnes))
            + Math.abs((i % colonnes) - (autre % colonnes));
        return distance >= Math.max(3, Math.round((lignes + colonnes) / 6));
    });

    for (let essai = 0; essai < 400 && choisies.length < combien; essai++) {
        const l = hasard.entre(marge, lignes - 1 - marge);
        const c = hasard.entre(marge, colonnes - 1 - marge);
        const i = l * colonnes + c;
        if (!choisies.includes(i) && assezLoin(i)) choisies.push(i);
    }
    if (choisies.length < combien) return null;

    // L'ordre de desserte : celui de l'avancee de l'entree vers la sortie, pour
    // que la ligne ne fasse pas d'aller-retour absurde des le depart.
    const axe = i => Math.abs(Math.floor(i / colonnes) - Math.floor(liaison.entree / colonnes))
        + Math.abs((i % colonnes) - (liaison.entree % colonnes));
    return choisies.sort((a, b) => axe(a) - axe(b));
}

function grilleNue({ lignes, colonnes, hasard, stations = 0, doubleLigne = false }) {
    const horizontal = doubleLigne ? true : hasard.suivant() < 0.5;
    const liaisons = [bordsOpposes({ lignes, colonnes, hasard, horizontal })];

    // La seconde liaison prend l'autre axe : les deux se croisent forcement,
    // ce qui est tout l'interet — deux lignes paralleles ne se disputeraient
    // jamais un mur.
    if (doubleLigne) liaisons.push(bordsOpposes({ lignes, colonnes, hasard, horizontal: false }));

    if (stations > 0) {
        const posees = poserStations({ lignes, colonnes, hasard, liaison: liaisons[0], combien: stations });
        if (!posees) return null;
        liaisons[0].stations = posees;
    }

    // Deux liaisons ne partagent ni bout ni station : deux marqueurs sur la
    // meme case ne se distingueraient pas a l'ecran.
    const occupees = liaisons.flatMap(liaison => [liaison.entree, liaison.sortie, ...liaison.stations]);
    if (new Set(occupees).size !== occupees.length) return null;

    return creerPlateau({ lignes, colonnes, liaisons });
}

function tenter({ lignes, colonnes, murs, hasard, densite, stations, doubleLigne }) {
    const plateau = grilleNue({ lignes, colonnes, hasard, stations, doubleLigne });
    if (!plateau) return null;
    const total = lignes * colonnes;
    const vise = Math.round(total * densite);

    // Les abords immediats des bouts et des stations restent libres : le joueur
    // doit pouvoir y poser ses propres murs.
    const interdit = new Uint8Array(total);
    for (const bout of bouts(plateau)) {
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
