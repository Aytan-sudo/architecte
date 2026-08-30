// Le meilleur connu, cote navigateur.
//
// Deux sources, dans cet ordre :
//
//   le catalogue (data/defis.json), pour le defi du jour. Il porte le resultat
//   d'une recherche profonde faite hors ligne, quelques centaines de
//   millisecondes par grille — impensable au chargement d'une page ;
//   la recherche embarquee, pour la partie libre et pour les dates hors
//   catalogue. Plus courte, donc plus facile a battre, et le jeu le dit.
//
// Le module ne fait qu'un import dynamique du solveur : rien de tout cela
// n'entre dans le graphe de chargement de la page tant que le joueur n'a pas
// demande une partie libre.

let travailleur = null;
let jeton = 0;
const attentes = new Map();

function ouvrir() {
    if (travailleur !== null) return travailleur;
    try {
        travailleur = new Worker(new URL('./solveur-worker.js', import.meta.url), { type: 'module' });
        travailleur.addEventListener('message', evenement => {
            const attente = attentes.get(evenement.data.jeton);
            if (!attente) return;
            attentes.delete(evenement.data.jeton);
            attente(evenement.data.erreur ? null : evenement.data.meilleur);
        });
        travailleur.addEventListener('error', () => { travailleur = false; });
    } catch {
        travailleur = false;                 // pas de fil disponible : on fera sans
    }
    return travailleur;
}

// Le repli : la meme recherche, sur le fil principal. Elle bloque le temps
// qu'elle dure, ce qui vaut mieux qu'un troisieme chiffre absent.
async function surPlace({ lignes, colonnes, murs, graine }) {
    const [{ genererPlateau }, { chercherMeilleur, REGLAGES_RAPIDES }] = await Promise.all([
        import('./generateur.js'),
        import('./solveur.js')
    ]);
    const { plateau, budget } = genererPlateau({ lignes, colonnes, murs, graine });
    return chercherMeilleur(plateau, budget, { ...REGLAGES_RAPIDES, graine }).longueur;
}

export function chercherMeilleurConnu(configuration) {
    const fil = ouvrir();
    if (!fil) return surPlace(configuration).catch(() => null);

    return new Promise(resoudre => {
        const identifiant = ++jeton;
        attentes.set(identifiant, resoudre);
        fil.postMessage({ jeton: identifiant, ...configuration });
        // Un fil qui ne repond pas ne doit pas laisser le troisieme chiffre en
        // pointilles pour toujours.
        setTimeout(() => {
            if (!attentes.has(identifiant)) return;
            attentes.delete(identifiant);
            surPlace(configuration).then(resoudre).catch(() => resoudre(null));
        }, 8000);
    });
}

export async function lireCatalogue() {
    try {
        const reponse = await fetch('data/defis.json', { cache: 'no-cache' });
        if (!reponse.ok) return null;
        return await reponse.json();
    } catch {
        return null;                          // hors ligne sans cache : on cherchera sur place
    }
}
