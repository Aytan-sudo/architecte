// Les variantes, en un seul endroit.
//
// Le moteur ne les connait pas : il ne sait que resoudre des liaisons — une
// entree, une sortie, des stations a desservir dans l'ordre. Une variante n'est
// donc rien de plus qu'une facon de peupler ce modele a la generation, et c'est
// pour cela qu'elles se combinent sans se gener.
//
//   canonique      1 liaison, 0 station
//   Stations       1 liaison, 3 stations
//   Double ligne   2 liaisons qui se croisent, 0 station
//   les deux       2 liaisons, 2 stations sur la premiere
//
// Le defi du jour reste canonique, volontairement : le catalogue serait
// multiplie par le nombre de variantes, et surtout les scores du jour
// cesseraient d'etre comparables — c'est tout ce qui fait leur valeur. Les
// variantes vivent en partie libre, ou la recherche embarquee fournit le
// meilleur connu a la volee.

export const VARIANTES = [
    {
        id: 'stations',
        libelle: 'Stations',
        resume: 'Le chemin doit desservir trois cases avant la sortie.',
        detail: 'Un mur qui allonge un segment peut en raccourcir un autre.',
        stations: 3,
        tailleMinimale: 10
    },
    {
        id: 'double',
        libelle: 'Double ligne',
        resume: 'Deux liaisons se croisent sur le plateau ; le score est leur somme.',
        // Sous 16x16, deux liaisons n'ont ni la place de se croiser franchement
        // ni le budget pour se payer chacune un detour : on obtient deux petits
        // chemins au lieu d'un beau, et l'ecran se charge pour rien.
        detail: 'À partir de 16 × 16 : en dessous, les deux lignes n’ont pas la place.',
        doubleLigne: true,
        tailleMinimale: 16
    }
];

export const varianteDe = id => VARIANTES.find(variante => variante.id === id) ?? null;

export const disponible = (variante, taille) => taille >= variante.tailleMinimale;

// Ce que la generation doit savoir : le reste du moteur n'en entend jamais
// parler.
export function configurationDeGeneration({ taille, murs, variantes = [] }) {
    const actives = variantes.map(varianteDe).filter(Boolean);
    const double = actives.some(variante => variante.doubleLigne);
    const stations = actives.find(variante => variante.stations)?.stations ?? 0;
    return {
        lignes: taille,
        colonnes: taille,
        murs,
        // Deux liaisons, c'est deux fois plus de segments a desservir : trois
        // stations sur chacune noieraient le plateau.
        stations: double ? Math.min(2, stations) : stations,
        doubleLigne: double
    };
}

// Un mur sert rarement deux lignes a la fois : la double ligne demande une
// bourse plus large, sans quoi chaque ligne n'obtient qu'un detour de rien.
export function budgetsPour(taille, variantes = []) {
    const double = variantes.map(varianteDe).some(variante => variante?.doubleLigne);
    const base = double ? [1, 1.5, 2] : [0.5, 1, 1.5];
    return base.map(facteur => Math.round(taille * facteur));
}

// Les variantes actives, nettoyees : on ne garde que celles que la taille
// autorise. Un joueur qui passe de 16x16 a 10x10 perd la double ligne sans
// avoir a s'en occuper.
export const retenues = (variantes = [], taille) =>
    VARIANTES.filter(variante => variantes.includes(variante.id) && disponible(variante, taille))
        .map(variante => variante.id);

// La cle des records : le canonique n'en porte aucune trace, pour que les
// palmares deja inscrits restent les leurs.
export const cleVariantes = (variantes = []) =>
    (variantes.length ? `:${[...variantes].sort().join('+')}` : '');

// Les variantes dans une adresse. Le separateur est la virgule, et non le
// plus : dans une chaine de requete, un `+` se decode en espace — un lien
// `?v=double+stations` arrivait donc comme une seule variante nommee
// « double stations », et la partie repartait en canonique sans rien dire. La
// lecture accepte les deux, pour que les liens deja partages continuent de
// marcher.
export const versTexte = (variantes = []) => variantes.join(',');

export const depuisTexte = texte =>
    (texte ?? '').split(/[+,\s]+/).filter(id => VARIANTES.some(variante => variante.id === id));

export const libelleVariantes = (variantes = []) => {
    const noms = VARIANTES.filter(variante => variantes.includes(variante.id)).map(variante => variante.libelle);
    return noms.length ? noms.join(' + ') : 'Canonique';
};
