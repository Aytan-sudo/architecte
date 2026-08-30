// Le plus court chemin, et tout ce qui se deduit de lui.
//
// Ce module est le juge du jeu : c'est lui qui donne le score, lui qui refuse
// une pose, lui qui designe le trace dessine a l'ecran. Il ne connait ni le DOM
// ni le hasard — des parcours en largeur sur une grille, rien d'autre.
//
// Une liaison va de son entree a sa sortie en desservant ses stations dans
// l'ordre : elle se mesure donc en autant de segments qu'il y a d'etapes, et le
// score du plateau est la somme de toutes ses liaisons. Le jeu canonique est le
// cas a une liaison, zero station, un seul segment — la generalisation ne lui
// coute rien.
//
// Trois choix meritent d'etre ecrits :
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
//
// 3. Un segment ignore les stations des autres segments : le trace peut donc se
//    recouper. C'est voulu — sur un plan de reseau, une ligne se croise elle-meme
//    sans que cela pose de question a personne.

import { LIBRE, MUR, avecCases, posable, etapes } from './plateau.js';

export const creerTampons = taille => ({
    distances: new Int32Array(taille),
    file: new Int32Array(taille)
});

// Parcours en largeur depuis une case. Renvoie le tableau des distances, -1
// pour l'inatteignable. `arret` permet de s'arreter des que la cible est vue :
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

// La longueur totale : toutes les liaisons, tous leurs segments. -1 des qu'une
// etape n'est plus joignable — c'est la seule chose que la regle dure a besoin
// de savoir.
export function longueur(plateau, tampons = null) {
    const t = tampons ?? creerTampons(plateau.cases.length);
    let total = 0;
    for (const liaison of plateau.liaisons) {
        const points = etapes(liaison);
        for (let k = 1; k < points.length; k++) {
            const d = remplirDistances(plateau, points[k - 1], t, points[k]);
            if (d[points[k]] < 0) return -1;
            total += d[points[k]];
        }
    }
    return total;
}

export const relie = (plateau, tampons = null) => longueur(plateau, tampons) >= 0;

// La direction d'un pas, pour reperer les virages.
function direction(plateau, de, vers) {
    const ecart = vers - de;
    if (ecart === 1) return 'droite';
    if (ecart === -1) return 'gauche';
    return ecart > 0 ? 'bas' : 'haut';
}

const PLAFOND_TRACES = 999;

// Un segment : d'une etape a la suivante. C'est ici que se decide le trace
// dessine, et ce qu'on saura des autres traces de meme longueur.
function analyserSegment(plateau, depart, arrivee, tampons) {
    const n = plateau.cases.length;
    const depuisDepart = Int32Array.from(remplirDistances(plateau, depart, tampons));
    const total = depuisDepart[arrivee];
    if (total < 0) return null;

    const depuisArrivee = Int32Array.from(remplirDistances(plateau, arrivee, tampons));

    // Le trace retenu : on descend vers l'arrivee en suivant l'ordre des
    // voisins, ce qui donne toujours le meme chemin pour la meme grille.
    const chemin = [depart];
    let courante = depart;
    while (courante !== arrivee) {
        const cible = depuisArrivee[courante] - 1;
        const { colonnes, lignes, cases } = plateau;
        const l = Math.floor(courante / colonnes);
        const c = courante % colonnes;
        let suivante = -1;
        if (l > 0 && cases[courante - colonnes] === LIBRE && depuisArrivee[courante - colonnes] === cible) suivante = courante - colonnes;
        else if (c < colonnes - 1 && cases[courante + 1] === LIBRE && depuisArrivee[courante + 1] === cible) suivante = courante + 1;
        else if (l < lignes - 1 && cases[courante + colonnes] === LIBRE && depuisArrivee[courante + colonnes] === cible) suivante = courante + colonnes;
        else if (c > 0 && cases[courante - 1] === LIBRE && depuisArrivee[courante - 1] === cible) suivante = courante - 1;
        if (suivante < 0) break;
        chemin.push(suivante);
        courante = suivante;
    }

    // Toute case qui appartient a un plus court chemin : sa distance depuis le
    // depart plus sa distance depuis l'arrivee fait exactement le total.
    const surUnChemin = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
        if (depuisDepart[i] < 0 || depuisArrivee[i] < 0) continue;
        if (depuisDepart[i] + depuisArrivee[i] === total) surUnChemin[i] = 1;
    }

    return {
        longueur: total,
        chemin,
        surUnChemin,
        nombreTraces: compterTraces(plateau, depart, arrivee, depuisDepart, surUnChemin, total)
    };
}

// Combien de plus courts chemins ? Un comptage par couches sur le graphe des
// cases utiles. Plafonne : au-dela de mille, le chiffre exact n'apprend plus
// rien au joueur et deborderait vite.
function compterTraces(plateau, depart, arrivee, depuisDepart, surUnChemin, total) {
    const n = plateau.cases.length;
    const nombre = new Float64Array(n);
    const parCouche = Array.from({ length: total + 1 }, () => []);
    for (let i = 0; i < n; i++) {
        if (surUnChemin[i]) parCouche[depuisDepart[i]].push(i);
    }
    nombre[depart] = 1;
    const { colonnes, lignes } = plateau;
    for (let d = 0; d < total; d++) {
        for (const i of parCouche[d]) {
            if (nombre[i] === 0) continue;
            const l = Math.floor(i / colonnes);
            const c = i % colonnes;
            const pousser = v => {
                if (surUnChemin[v] && depuisDepart[v] === d + 1) {
                    nombre[v] = Math.min(PLAFOND_TRACES + 1, nombre[v] + nombre[i]);
                }
            };
            if (l > 0) pousser(i - colonnes);
            if (c < colonnes - 1) pousser(i + 1);
            if (l < lignes - 1) pousser(i + colonnes);
            if (c > 0) pousser(i - 1);
        }
    }
    return Math.min(PLAFOND_TRACES + 1, nombre[arrivee]);
}

// Une liaison entiere : ses segments mis bout a bout.
export function analyserLiaison(plateau, liaison, tampons = null) {
    const t = tampons ?? creerTampons(plateau.cases.length);
    const points = etapes(liaison);
    const vide = {
        longueur: -1, chemin: [], virages: [], alternatives: [], nombreTraces: 0,
        stations: liaison.stations, entree: liaison.entree, sortie: liaison.sortie
    };

    let total = 0;
    let traces = 1;
    const chemin = [];
    const surUnChemin = new Uint8Array(plateau.cases.length);

    for (let k = 1; k < points.length; k++) {
        const segment = analyserSegment(plateau, points[k - 1], points[k], t);
        if (!segment) return vide;
        total += segment.longueur;
        traces = Math.min(PLAFOND_TRACES + 1, traces * segment.nombreTraces);
        // La case de jonction appartient aux deux segments : on ne la compte
        // qu'une fois, sinon le trace bafouille a chaque station.
        chemin.push(...(chemin.length ? segment.chemin.slice(1) : segment.chemin));
        for (let i = 0; i < surUnChemin.length; i++) surUnChemin[i] ||= segment.surUnChemin[i];
    }

    // Les virages : la ou la direction change. Ils portent une pastille a
    // l'ecran, et ils disent d'un coup d'oeil combien le trace a du plier. Les
    // stations en sont exclues : elles ont deja leur propre marque.
    const virages = [];
    const stations = new Set(liaison.stations);
    for (let k = 1; k < chemin.length - 1; k++) {
        if (stations.has(chemin[k])) continue;
        if (direction(plateau, chemin[k - 1], chemin[k]) !== direction(plateau, chemin[k], chemin[k + 1])) {
            virages.push(chemin[k]);
        }
    }

    const dansLeTrace = new Set(chemin);
    const alternatives = [];
    for (let i = 0; i < surUnChemin.length; i++) {
        if (surUnChemin[i] && !dansLeTrace.has(i)) alternatives.push(i);
    }

    return {
        longueur: total,
        chemin,
        virages,
        alternatives,
        nombreTraces: traces,
        surUnChemin,
        stations: liaison.stations,
        entree: liaison.entree,
        sortie: liaison.sortie
    };
}

// L'analyse complete, celle dont l'interface a besoin.
export function analyser(plateau) {
    const tampons = creerTampons(plateau.cases.length);
    const liaisons = plateau.liaisons.map(liaison => analyserLiaison(plateau, liaison, tampons));
    const coupee = liaisons.some(analyse => analyse.longueur < 0);

    return {
        longueur: coupee ? -1 : liaisons.reduce((somme, analyse) => somme + analyse.longueur, 0),
        // Le nombre de traces du plateau est le produit de ceux des liaisons :
        // chaque combinaison est une facon de dessiner la meme partie.
        nombreTraces: coupee ? 0 : Math.min(PLAFOND_TRACES + 1,
            liaisons.reduce((produit, analyse) => produit * analyse.nombreTraces, 1)),
        liaisons
    };
}

// Les cases qui valent la peine d'etre essayees par le solveur : celles qui
// portent un plus court chemin, tous segments confondus. Un mur pose ailleurs
// ne change pas la longueur — c'est l'elagage sur lequel repose toute la
// recherche. Deux jeux de tampons parce qu'il faut deux cartes de distances a
// la fois.
export function casesUtiles(plateau, tamponsA, tamponsB) {
    const n = plateau.cases.length;
    const utiles = new Uint8Array(n);
    let total = 0;

    for (const liaison of plateau.liaisons) {
        const points = etapes(liaison);
        for (let k = 1; k < points.length; k++) {
            const depuisDepart = remplirDistances(plateau, points[k - 1], tamponsA);
            const segment = depuisDepart[points[k]];
            if (segment < 0) return { total: -1, utiles };
            const depuisArrivee = remplirDistances(plateau, points[k], tamponsB);
            total += segment;
            for (let i = 0; i < n; i++) {
                if (depuisDepart[i] >= 0 && depuisArrivee[i] >= 0 && depuisDepart[i] + depuisArrivee[i] === segment) {
                    utiles[i] = 1;
                }
            }
        }
    }
    return { total, utiles };
}

// La regle dure, cote moteur : poser ici laisserait-il toutes les liaisons
// praticables ?
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
// Cout : un parcours par case libre et par segment, soit 65 000 visites sur une
// grille de 256 cases a une liaison. Mesure a moins d'une milliseconde ; le
// calcul incremental attendra d'etre necessaire.
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
