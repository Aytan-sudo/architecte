// Le plateau : une grille et des liaisons a assurer.
//
// Une liaison va d'une entree a une sortie, en desservant au passage une liste
// ordonnee de stations. Le jeu canonique n'en a qu'une, sans station ; les
// variantes ne font que peupler ce meme modele — trois stations pour la
// variante Stations, deux liaisons pour la Double ligne, et les deux ensemble
// tombent toutes seules. Aucune des deux n'a demande de branche dans le moteur.
//
// Aucune notion de partie ici (le budget de murs, l'annulation, le score vivent
// dans partie.js), aucune notion d'affichage. Une case est un entier, la grille
// est un tableau plat : c'est ce qui permet au solveur d'en copier des milliers
// par seconde sans que le ramasse-miettes s'en mele.

export const LIBRE = 0;
export const OBSTACLE = 1;   // pose par la generation, indeboulonnable
export const MUR = 2;        // pose par le joueur, et retirable par lui

export const creerLiaison = (entree, sortie, stations = []) => ({ entree, sortie, stations });

// `entree`/`sortie` restent acceptes : c'est la forme du jeu canonique, une
// liaison sans station, et il n'y a aucune raison de l'ecrire en trois lignes.
export function creerPlateau({ lignes, colonnes, entree, sortie, liaisons = null, cases = null }) {
    return {
        lignes,
        colonnes,
        liaisons: liaisons ?? [creerLiaison(entree, sortie)],
        cases: cases ? Uint8Array.from(cases) : new Uint8Array(lignes * colonnes)
    };
}

// Les cases que la liaison occupe deja : ses deux bouts et ses stations. On n'y
// batit pas.
export function bouts(plateau) {
    const liste = [];
    for (const liaison of plateau.liaisons) {
        liste.push(liaison.entree, ...liaison.stations, liaison.sortie);
    }
    return liste;
}

// Les points d'une liaison, dans l'ordre ou il faut les rejoindre.
export const etapes = liaison => [liaison.entree, ...liaison.stations, liaison.sortie];

// Une copie du plateau avec une autre grille : le solveur s'en sert pour
// evaluer un coup sans defaire ce qu'il tenait.
export const avecCases = (plateau, cases) => ({ ...plateau, cases });

export const copier = plateau => avecCases(plateau, Uint8Array.from(plateau.cases));

export const indice = (plateau, ligne, colonne) => ligne * plateau.colonnes + colonne;
export const ligneDe = (plateau, i) => Math.floor(i / plateau.colonnes);
export const colonneDe = (plateau, i) => i % plateau.colonnes;
export const taille = plateau => plateau.lignes * plateau.colonnes;

export const franchissable = (plateau, i) => plateau.cases[i] === LIBRE;

// Une case ou le joueur a le droit de poser : libre, et ni un bout de liaison
// ni une station. Que la pose coupe ou non le passage se decide ailleurs
// (chemin.js) : c'est une question de connexite, pas de geometrie.
export const posable = (plateau, i) =>
    plateau.cases[i] === LIBRE && !bouts(plateau).includes(i);

export function surLeBord(plateau, i) {
    const l = ligneDe(plateau, i);
    const c = colonneDe(plateau, i);
    return l === 0 || c === 0 || l === plateau.lignes - 1 || c === plateau.colonnes - 1;
}

// Voisins dans l'ordre haut, droite, bas, gauche. Cet ordre est fixe une fois
// pour toutes : c'est lui qui decide quel plus court chemin est dessine quand
// il en existe plusieurs, et il vaut mieux que ce soit une decision ecrite
// qu'un effet de bord de l'implementation.
export function voisins(plateau, i) {
    const { lignes, colonnes } = plateau;
    const l = Math.floor(i / colonnes);
    const c = i % colonnes;
    const liste = [];
    if (l > 0) liste.push(i - colonnes);
    if (c < colonnes - 1) liste.push(i + 1);
    if (l < lignes - 1) liste.push(i + colonnes);
    if (c > 0) liste.push(i - 1);
    return liste;
}

// La distance a vol d'oiseau, toutes liaisons et toutes stations comprises : la
// longueur qu'aurait le trace sur une grille vide. Elle sert de reference — le
// score du joueur se lit comme un detour par rapport a elle.
export function distanceMinimale(plateau) {
    let total = 0;
    for (const liaison of plateau.liaisons) {
        const points = etapes(liaison);
        for (let k = 1; k < points.length; k++) {
            total += Math.abs(ligneDe(plateau, points[k - 1]) - ligneDe(plateau, points[k]))
                + Math.abs(colonneDe(plateau, points[k - 1]) - colonneDe(plateau, points[k]));
        }
    }
    return total;
}

// Une empreinte du plateau, obstacles compris. Le catalogue des defis s'en sert
// pour verifier que le « meilleur connu » qu'il transporte parle bien de la
// grille que le joueur a sous les yeux : si la generation change un jour, le
// chiffre est ecarte au lieu de mentir.
//
// L'ordre de brassage est fige : la premiere liaison d'abord, ses stations et
// les liaisons suivantes seulement apres les cases. Une grille canonique — une
// liaison, aucune station — donne donc exactement l'empreinte qu'elle donnait
// avant que les variantes existent, et les 450 defis deja publies restent
// valides. Un test le verifie.
export function signature(plateau) {
    let empreinte = 0x811c9dc5;
    const melanger = valeur => {
        empreinte ^= valeur & 0xff;
        empreinte = Math.imul(empreinte, 0x01000193) >>> 0;
    };
    melanger(plateau.lignes);
    melanger(plateau.colonnes);
    melanger(plateau.liaisons[0].entree);
    melanger(plateau.liaisons[0].entree >> 8);
    melanger(plateau.liaisons[0].sortie);
    melanger(plateau.liaisons[0].sortie >> 8);
    for (const valeur of plateau.cases) melanger(valeur === MUR ? LIBRE : valeur);
    for (const liaison of plateau.liaisons) {
        for (const station of liaison.stations) {
            melanger(station);
            melanger(station >> 8);
        }
    }
    for (const liaison of plateau.liaisons.slice(1)) {
        melanger(liaison.entree);
        melanger(liaison.entree >> 8);
        melanger(liaison.sortie);
        melanger(liaison.sortie >> 8);
    }
    return (empreinte >>> 0).toString(16).padStart(8, '0');
}
