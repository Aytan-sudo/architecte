// La recherche du « meilleur connu ».
//
// Le probleme pose : ou placer K murs pour que le plus court chemin de l'entree
// a la sortie soit le plus long possible ? C'est un probleme d'optimisation
// combinatoire, et l'optimum exact est hors de portee des que la grille
// grandit — sur 16x16 a 18 murs, il faudrait examiner de l'ordre de 10^30
// placements. Ce module ne pretend donc jamais donner l'optimum : il donne le
// meilleur resultat qu'il a su trouver, et le jeu l'appelle « le meilleur
// connu ». Quand un joueur fait mieux, il a reellement battu la machine.
//
// Deux etages :
//
// 1. Une recherche en faisceau, K niveaux. L'elagage repose sur une remarque :
//    un mur pose hors des plus courts chemins ne change pas la longueur. On
//    n'essaie donc que les cases situees sur un plus court chemin, et leurs
//    voisines — celles qui ne paient que plus tard. Cinquante candidates au
//    lieu de deux cents.
//
// 2. Un recuit simule par-dessus, qui deplace un mur a la fois. Le faisceau
//    construit vite une bonne solution mais reste prisonnier de ses premiers
//    choix ; le recuit defait ces choix-la.
//
// Le budget est compte en iterations, jamais en secondes. Un budget en temps
// donnerait un « meilleur connu » different selon la machine, et le chiffre du
// defi du jour cesserait d'etre comparable — c'est tout ce qui fait sa valeur.

import { creerHasard } from './hasard.js';
import { LIBRE, MUR, avecCases, posable } from './plateau.js';
import { creerTampons, casesUtiles, longueur } from './chemin.js';

export const REGLAGES_RAPIDES = { faisceau: 10, recuit: 6000, reprises: 1 };
export const REGLAGES_PROFONDS = { faisceau: 32, recuit: 70000, reprises: 4 };

export function chercherMeilleur(plateau, budget, options = {}) {
    const { faisceau = 16, recuit = 20000, reprises = 1, graine = 20260830 } = options;
    const hasard = creerHasard(graine);

    let meilleur = { longueur: longueur(plateau), murs: [] };

    for (let reprise = 0; reprise < reprises; reprise++) {
        // Chaque reprise repart du faisceau avec un grain de sel different :
        // les egalites ne se departagent pas de la meme facon, donc les
        // trajectoires divergent.
        const depart = rechercheEnFaisceau(plateau, budget, faisceau, hasard);
        const affine = recuitSimule(plateau, depart.murs, budget, hasard, recuit);
        const candidat = affine.longueur >= depart.longueur ? affine : depart;
        if (candidat.longueur > meilleur.longueur) meilleur = candidat;
    }

    return { longueur: meilleur.longueur, murs: [...meilleur.murs].sort((a, b) => a - b) };
}

// --- Etage 1 : la recherche en faisceau -----------------------------------

function poserMurs(plateau, murs) {
    const cases = Uint8Array.from(plateau.cases);
    for (const i of murs) cases[i] = MUR;
    return avecCases(plateau, cases);
}

// Les cases qui valent la peine d'etre essayees : celles d'un plus court
// chemin — toutes liaisons et tous segments confondus — plus leurs voisines
// immediates, celles qui ne paient que plus tard.
function candidats(position, tampons, tamponsBis) {
    const n = position.cases.length;
    const { total, utiles } = casesUtiles(position, tampons, tamponsBis);
    if (total < 0) return { total, liste: [] };

    const retenu = new Uint8Array(n);
    const { colonnes, lignes } = position;
    for (let i = 0; i < n; i++) {
        if (!utiles[i]) continue;
        retenu[i] = 1;
        const l = Math.floor(i / colonnes);
        const c = i % colonnes;
        if (l > 0) retenu[i - colonnes] ||= 2;
        if (c < colonnes - 1) retenu[i + 1] ||= 2;
        if (l < lignes - 1) retenu[i + colonnes] ||= 2;
        if (c > 0) retenu[i - 1] ||= 2;
    }

    const liste = [];
    for (let i = 0; i < n; i++) {
        if (retenu[i] && posable(position, i)) liste.push(i);
    }
    return { total, liste };
}

function rechercheEnFaisceau(plateau, budget, largeur, hasard) {
    const tampons = creerTampons(plateau.cases.length);
    const tamponsBis = creerTampons(plateau.cases.length);
    let faisceau = [{ murs: [], longueur: longueur(plateau, tampons) }];
    let meilleur = faisceau[0];

    for (let niveau = 0; niveau < budget; niveau++) {
        const enfants = new Map();

        for (const etat of faisceau) {
            const position = poserMurs(plateau, etat.murs);
            const { liste } = candidats(position, tampons, tamponsBis);

            for (const i of liste) {
                position.cases[i] = MUR;
                const nouvelle = longueur(position, tampons);
                position.cases[i] = LIBRE;
                if (nouvelle < 0) continue;

                const murs = [...etat.murs, i].sort((a, b) => a - b);
                const cle = murs.join(',');
                if (!enfants.has(cle)) enfants.set(cle, { murs, longueur: nouvelle });
            }
        }

        if (enfants.size === 0) break;

        // Le grain de sel departage les egalites — et elles sont nombreuses.
        // Sans lui, le faisceau se remplit de variantes du meme placement.
        const classes = [...enfants.values()]
            .map(etat => ({ etat, rang: etat.longueur + hasard.suivant() * 0.9 }))
            .sort((a, b) => b.rang - a.rang)
            .slice(0, largeur)
            .map(({ etat }) => etat);

        faisceau = classes;

        // Ajouter un mur n'a jamais raccourci un chemin : la tete du faisceau
        // ne peut donc que monter d'un niveau au suivant, et celle du dernier
        // niveau est a la fois la meilleure et la plus complete.
        const tete = faisceau.reduce((a, b) => (b.longueur > a.longueur ? b : a));
        if (tete.murs.length > meilleur.murs.length || tete.longueur > meilleur.longueur) meilleur = tete;
    }

    return meilleur;
}

// --- Etage 2 : le recuit simule -------------------------------------------

// Les cases ou un mur a une chance de servir : sur le chemin actuel ou juste a
// cote. Le recuit y puise les trois quarts de ses propositions ; le reste va
// n'importe ou, sans quoi il ne quitterait jamais la region ou il est ne.
function zoneUtile(position, tampons, tamponsBis) {
    const { liste } = candidats(position, tampons, tamponsBis);
    return liste;
}

function recuitSimule(plateau, mursDepart, budget, hasard, iterations) {
    if (iterations <= 0 || mursDepart.length === 0) {
        return { murs: [...mursDepart], longueur: longueur(poserMurs(plateau, mursDepart)) };
    }

    const tampons = creerTampons(plateau.cases.length);
    const tamponsBis = creerTampons(plateau.cases.length);
    const position = poserMurs(plateau, mursDepart);
    const murs = [...mursDepart];
    let courante = longueur(position, tampons);

    let meilleurLongueur = courante;
    let meilleurMurs = [...murs];

    const libres = [];
    for (let i = 0; i < plateau.cases.length; i++) {
        if (posable(plateau, i)) libres.push(i);
    }
    let utiles = zoneUtile(position, tampons, tamponsBis);

    const T0 = 1.1;
    const T1 = 0.05;

    for (let pas = 0; pas < iterations; pas++) {
        const temperature = T0 * (T1 / T0) ** (pas / iterations);

        const rang = hasard.entier(murs.length);
        const ancienne = murs[rang];
        const bassin = hasard.suivant() < 0.75 && utiles.length ? utiles : libres;
        const cible = hasard.choisir(bassin);
        if (cible === undefined || position.cases[cible] !== LIBRE || cible === ancienne) continue;

        position.cases[ancienne] = LIBRE;
        position.cases[cible] = MUR;
        const proposee = longueur(position, tampons);

        const ecart = proposee - courante;
        const accepte = proposee >= 0 && (ecart >= 0 || hasard.suivant() < Math.exp(ecart / temperature));

        if (accepte) {
            murs[rang] = cible;
            courante = proposee;
            utiles = zoneUtile(position, tampons, tamponsBis);
            if (courante > meilleurLongueur) {
                meilleurLongueur = courante;
                meilleurMurs = [...murs];
            }
        } else {
            position.cases[cible] = LIBRE;
            position.cases[ancienne] = MUR;
        }
    }

    return { murs: meilleurMurs, longueur: meilleurLongueur };
}

// --- L'etalon : l'optimum exact, sur les petites grilles seulement ---------

// Enumeration complete. Elle ne sert qu'aux tests : sur 5x5 a 2 murs il y a 253
// placements, sur 6x6 a 3 murs environ 6 000. C'est ce qui permet de verifier
// que l'heuristique retrouve bien l'optimum la ou l'optimum est connaissable —
// autrement, « le meilleur connu » serait un chiffre que personne n'a verifie.
export function optimumExhaustif(plateau, budget) {
    const tampons = creerTampons(plateau.cases.length);
    const libres = [];
    for (let i = 0; i < plateau.cases.length; i++) {
        if (posable(plateau, i)) libres.push(i);
    }

    const cases = Uint8Array.from(plateau.cases);
    const position = avecCases(plateau, cases);
    let meilleur = { longueur: longueur(position, tampons), murs: [] };
    const choix = [];

    const explorer = (depart, restants) => {
        if (restants === 0) {
            const mesure = longueur(position, tampons);
            if (mesure > meilleur.longueur) meilleur = { longueur: mesure, murs: [...choix] };
            return;
        }
        for (let k = depart; k <= libres.length - restants; k++) {
            const i = libres[k];
            cases[i] = MUR;
            if (longueur(position, tampons) >= 0) {
                choix.push(i);
                explorer(k + 1, restants - 1);
                choix.pop();
            }
            cases[i] = LIBRE;
        }
    };

    explorer(0, budget);
    return meilleur;
}
