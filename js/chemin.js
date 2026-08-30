// Le plus court chemin, et tout ce qui se deduit de lui.
//
// Ce module est le juge du jeu : c'est lui qui donne le score, lui qui refuse
// une pose, lui qui designe le trace dessine a l'ecran. Il ne connait ni le DOM
// ni le hasard — un parcours en largeur sur une grille, rien d'autre.
//
// Deux choix meritent d'etre ecrits :
//
// 1. L'ordre des voisins est fixe (haut, droite, bas, gauche). Quand plusieurs
//    plus courts chemins existent, c'est cet ordre qui decide lequel est
//    dessine. L'interface previent alors qu'il y en a d'autres : sans cela, le
//    trace qui saute d'un cote a l'autre apres une pose sans rapport passe pour
//    un bug.
//
// 2. Les tampons sont fournis par l'appelant dans les boucles chaudes. Le
//    solveur evalue des dizaines de milliers de positions ; allouer deux
//    tableaux a chaque fois couterait plus cher que le parcours lui-meme.

import { LIBRE, MUR, avecCases, posable } from './plateau.js';

export const creerTampons = taille => ({
    distances: new Int32Array(taille),
    file: new Int32Array(taille)
});

// Parcours en largeur depuis une case. Renvoie le tableau des distances, -1
// pour l'inatteignable. `arret` permet de s'arreter des que la sortie est vue :
// dans le solveur, on ne veut que la longueur, pas la carte complete.
export function remplirDistances(plateau, depart, tampons, arret = -1) {
    const { cases, colonnes, lignes } = plateau;
    const { distances, file } = tampons;
    distances.fill(-1);

    let tete = 0;
    let queue = 0;
    distances[depart] = 0;
    file[queue++] = depart;

    while (tete < queue) {
        const i = file[tete++];
        if (i === arret) return distances;
        const d = distances[i] + 1;
        const l = Math.floor(i / colonnes);
        const c = i % colonnes;

        if (l > 0) { const v = i - colonnes; if (cases[v] === LIBRE && distances[v] < 0) { distances[v] = d; file[queue++] = v; } }
        if (c < colonnes - 1) { const v = i + 1; if (cases[v] === LIBRE && distances[v] < 0) { distances[v] = d; file[queue++] = v; } }
        if (l < lignes - 1) { const v = i + colonnes; if (cases[v] === LIBRE && distances[v] < 0) { distances[v] = d; file[queue++] = v; } }
        if (c > 0) { const v = i - 1; if (cases[v] === LIBRE && distances[v] < 0) { distances[v] = d; file[queue++] = v; } }
    }
    return distances;
}

export function distances(plateau, depart) {
    const tampons = creerTampons(plateau.cases.length);
    return Int32Array.from(remplirDistances(plateau, depart, tampons));
}

// La longueur du plus court chemin, en pas. -1 si la sortie n'est plus
// joignable — c'est la seule chose que la regle dure a besoin de savoir.
export function longueur(plateau, tampons = null) {
    const t = tampons ?? creerTampons(plateau.cases.length);
    const d = remplirDistances(plateau, plateau.entree, t, plateau.sortie);
    return d[plateau.sortie];
}

export const relie = (plateau, tampons = null) => longueur(plateau, tampons) >= 0;

// La direction d'un pas, pour reperer les virages.
function direction(plateau, de, vers) {
    const ecart = vers - de;
    if (ecart === 1) return 'droite';
    if (ecart === -1) return 'gauche';
    return ecart > 0 ? 'bas' : 'haut';
}

// L'analyse complete, celle dont l'interface a besoin : le trace retenu, les
// cases ou passe un autre plus court chemin, le nombre de traces, et les
// virages — l'element signature du dessin.
export function analyser(plateau) {
    const n = plateau.cases.length;
    const tampons = creerTampons(n);
    const depuisEntree = Int32Array.from(remplirDistances(plateau, plateau.entree, tampons));
    const total = depuisEntree[plateau.sortie];

    if (total < 0) {
        return { longueur: -1, chemin: [], virages: [], alternatives: [], nombreTraces: 0 };
    }

    const depuisSortie = Int32Array.from(remplirDistances(plateau, plateau.sortie, tampons));

    // Le trace retenu : on descend vers la sortie en suivant l'ordre des
    // voisins, ce qui donne toujours le meme chemin pour la meme grille.
    const chemin = [plateau.entree];
    let courante = plateau.entree;
    while (courante !== plateau.sortie) {
        const cible = depuisSortie[courante] - 1;
        const { colonnes, lignes, cases } = plateau;
        const l = Math.floor(courante / colonnes);
        const c = courante % colonnes;
        let suivante = -1;
        if (l > 0 && cases[courante - colonnes] === LIBRE && depuisSortie[courante - colonnes] === cible) suivante = courante - colonnes;
        else if (c < colonnes - 1 && cases[courante + 1] === LIBRE && depuisSortie[courante + 1] === cible) suivante = courante + 1;
        else if (l < lignes - 1 && cases[courante + colonnes] === LIBRE && depuisSortie[courante + colonnes] === cible) suivante = courante + colonnes;
        else if (c > 0 && cases[courante - 1] === LIBRE && depuisSortie[courante - 1] === cible) suivante = courante - 1;
        if (suivante < 0) break;
        chemin.push(suivante);
        courante = suivante;
    }

    // Les virages : la ou la direction change. Ils portent une pastille a
    // l'ecran, et ils disent d'un coup d'oeil combien le trace a du plier.
    const virages = [];
    for (let k = 1; k < chemin.length - 1; k++) {
        if (direction(plateau, chemin[k - 1], chemin[k]) !== direction(plateau, chemin[k], chemin[k + 1])) {
            virages.push(chemin[k]);
        }
    }

    // Toute case qui appartient a un plus court chemin : sa distance depuis
    // l'entree plus sa distance depuis la sortie fait exactement le total.
    const surUnChemin = new Uint8Array(n);
    const alternatives = [];
    const dansLeTrace = new Set(chemin);
    for (let i = 0; i < n; i++) {
        if (depuisEntree[i] < 0 || depuisSortie[i] < 0) continue;
        if (depuisEntree[i] + depuisSortie[i] !== total) continue;
        surUnChemin[i] = 1;
        if (!dansLeTrace.has(i)) alternatives.push(i);
    }

    return {
        longueur: total,
        chemin,
        virages,
        alternatives,
        nombreTraces: compterTraces(plateau, depuisEntree, surUnChemin, total),
        surUnChemin
    };
}

// Combien de plus courts chemins ? Un comptage par couches sur le graphe des
// cases utiles. Plafonne : au-dela de mille, le chiffre exact n'apprend plus
// rien au joueur et deborderait vite.
const PLAFOND_TRACES = 999;

function compterTraces(plateau, depuisEntree, surUnChemin, total) {
    const n = plateau.cases.length;
    const nombre = new Float64Array(n);
    const parCouche = Array.from({ length: total + 1 }, () => []);
    for (let i = 0; i < n; i++) {
        if (surUnChemin[i]) parCouche[depuisEntree[i]].push(i);
    }
    nombre[plateau.entree] = 1;
    const { colonnes, lignes } = plateau;
    for (let d = 0; d < total; d++) {
        for (const i of parCouche[d]) {
            if (nombre[i] === 0) continue;
            const l = Math.floor(i / colonnes);
            const c = i % colonnes;
            const pousser = v => {
                if (surUnChemin[v] && depuisEntree[v] === d + 1) {
                    nombre[v] = Math.min(PLAFOND_TRACES + 1, nombre[v] + nombre[i]);
                }
            };
            if (l > 0) pousser(i - colonnes);
            if (c < colonnes - 1) pousser(i + 1);
            if (l < lignes - 1) pousser(i + colonnes);
            if (c > 0) pousser(i - 1);
        }
    }
    return Math.min(PLAFOND_TRACES + 1, nombre[plateau.sortie]);
}

// La regle dure, cote moteur : poser ici laisserait-il un chemin ?
export function poseLegale(plateau, i, tampons = null) {
    if (!posable(plateau, i)) return false;
    const t = tampons ?? creerTampons(plateau.cases.length);
    plateau.cases[i] = MUR;
    const ok = longueur(plateau, t) >= 0;
    plateau.cases[i] = LIBRE;
    return ok;
}

// Toutes les cases interdites d'un coup. L'interface s'en sert pour refuser une
// pose sans delai, et pour reconnaitre l'impasse — le cas, rarissime, ou il
// reste des murs mais plus aucune pose legale.
//
// Cout : un parcours par case libre, soit 65 000 visites sur une grille de 256
// cases. Mesure a moins d'une milliseconde ; le calcul incremental attendra
// d'etre necessaire.
export function casesInterdites(plateau) {
    const n = plateau.cases.length;
    const interdites = new Uint8Array(n);
    const tampons = creerTampons(n);
    for (let i = 0; i < n; i++) {
        if (!posable(plateau, i)) continue;
        plateau.cases[i] = MUR;
        if (longueur(plateau, tampons) < 0) interdites[i] = 1;
        plateau.cases[i] = LIBRE;
    }
    return interdites;
}

// Un plateau sans piege au premier coup : aucune case libre n'est un point de
// passage oblige. La generation s'en sert comme critere de qualite.
export function aucunPassageOblige(plateau) {
    const interdites = casesInterdites(plateau);
    return !interdites.includes(1);
}

// Poser une liste de murs sur une copie, sans toucher a l'original.
export function avecMurs(plateau, murs) {
    const cases = Uint8Array.from(plateau.cases);
    for (const i of murs) cases[i] = MUR;
    return avecCases(plateau, cases);
}
