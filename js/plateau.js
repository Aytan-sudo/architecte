// Le plateau : une grille, une entree, une sortie, et rien de plus.
//
// Aucune notion de partie ici (le budget de murs, l'annulation, le score vivent
// dans partie.js), aucune notion d'affichage. Une case est un entier, la grille
// est un tableau plat : c'est ce qui permet au solveur d'en copier des milliers
// par seconde sans que le ramasse-miettes s'en mele.

export const LIBRE = 0;
export const OBSTACLE = 1;   // pose par la generation, indeboulonnable
export const MUR = 2;        // pose par le joueur, et retirable par lui

export function creerPlateau({ lignes, colonnes, entree, sortie, cases = null }) {
    return {
        lignes,
        colonnes,
        entree,
        sortie,
        cases: cases ? Uint8Array.from(cases) : new Uint8Array(lignes * colonnes)
    };
}

// Une copie du plateau avec une autre grille : le solveur s'en sert pour
// evaluer un coup sans defaire ce qu'il tenait.
export const avecCases = (plateau, cases) => ({ ...plateau, cases });

export const copier = plateau => avecCases(plateau, Uint8Array.from(plateau.cases));

export const indice = (plateau, ligne, colonne) => ligne * plateau.colonnes + colonne;
export const ligneDe = (plateau, i) => Math.floor(i / plateau.colonnes);
export const colonneDe = (plateau, i) => i % plateau.colonnes;
export const taille = plateau => plateau.lignes * plateau.colonnes;

export const franchissable = (plateau, i) => plateau.cases[i] === LIBRE;

// Une case ou le joueur a le droit de poser : libre, et ni l'entree ni la
// sortie. Que la pose coupe ou non le passage se decide ailleurs (chemin.js) :
// c'est une question de connexite, pas de geometrie.
export const posable = (plateau, i) =>
    plateau.cases[i] === LIBRE && i !== plateau.entree && i !== plateau.sortie;

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

// La distance a vol d'oiseau entre entree et sortie : la longueur qu'aurait le
// chemin sur une grille vide. Elle sert de reference — le score du joueur se
// lit comme un detour par rapport a elle.
export const distanceMinimale = plateau =>
    Math.abs(ligneDe(plateau, plateau.entree) - ligneDe(plateau, plateau.sortie))
    + Math.abs(colonneDe(plateau, plateau.entree) - colonneDe(plateau, plateau.sortie));

// Une empreinte du plateau, obstacles compris. Le catalogue des defis s'en sert
// pour verifier que le « meilleur connu » qu'il transporte parle bien de la
// grille que le joueur a sous les yeux : si la generation change un jour, le
// chiffre est ecarte au lieu de mentir.
export function signature(plateau) {
    let empreinte = 0x811c9dc5;
    const melanger = valeur => {
        empreinte ^= valeur & 0xff;
        empreinte = Math.imul(empreinte, 0x01000193) >>> 0;
    };
    melanger(plateau.lignes);
    melanger(plateau.colonnes);
    melanger(plateau.entree);
    melanger(plateau.entree >> 8);
    melanger(plateau.sortie);
    melanger(plateau.sortie >> 8);
    for (const valeur of plateau.cases) melanger(valeur === MUR ? LIBRE : valeur);
    return (empreinte >>> 0).toString(16).padStart(8, '0');
}
