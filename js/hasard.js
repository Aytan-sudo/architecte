// Le hasard, en un seul endroit.
//
// Rien d'autre dans le projet n'appelle Math.random. Toute la generation d'un
// plateau, et toute la recherche du meilleur connu, passent par ce generateur a
// graine : meme graine, meme plateau, meme chiffre affiche. C'est ce qui rend
// possible le defi du jour sans serveur — chaque joueur refabrique la grille
// chez lui — et c'est aussi ce qui rend le « meilleur connu » comparable d'un
// telephone a l'autre.

// mulberry32 : court, rapide, de bonne qualite pour ce qu'on lui demande, et
// son etat tient dans un entier — donc il se serialise.
export function creerHasard(graine) {
    let etat = (graine >>> 0) || 1;

    const suivant = () => {
        etat = (etat + 0x6d2b79f5) >>> 0;
        let t = etat;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    return {
        suivant,
        // Un entier de 0 a borne-1.
        entier: borne => Math.floor(suivant() * borne),
        // Un entier de min a max inclus.
        entre: (min, max) => min + Math.floor(suivant() * (max - min + 1)),
        // Fisher-Yates, en place.
        melanger(tableau) {
            for (let i = tableau.length - 1; i > 0; i--) {
                const j = Math.floor(suivant() * (i + 1));
                [tableau[i], tableau[j]] = [tableau[j], tableau[i]];
            }
            return tableau;
        },
        choisir: tableau => tableau[Math.floor(suivant() * tableau.length)],
        etat: () => etat,
        reprendre: valeur => { etat = valeur >>> 0; }
    };
}

// FNV-1a : une chaine (« 2026-08-30 », une configuration) devient une graine.
// Deux dates voisines donnent des graines eloignees, donc des plateaux sans
// parente visible.
export function graineDepuisTexte(texte) {
    let empreinte = 0x811c9dc5;
    for (let i = 0; i < texte.length; i++) {
        empreinte ^= texte.charCodeAt(i);
        empreinte = Math.imul(empreinte, 0x01000193) >>> 0;
    }
    return empreinte >>> 0;
}
