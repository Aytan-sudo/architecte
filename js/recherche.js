// La recherche, cote navigateur.
//
// Deux sources pour le meilleur connu, dans cet ordre :
//
//   le catalogue (data/defis.json), pour le defi du jour. Il porte le resultat
//   d'une recherche profonde faite hors ligne, une seconde par grille —
//   impensable au chargement d'une page ;
//   la recherche embarquee, pour la partie libre et pour les dates hors
//   catalogue. Plus courte, donc plus facile a battre, et le jeu le dit.
//
// La meme recherche sert a montrer la solution une fois la partie finie : le
// catalogue ne transporte que des nombres, jamais un placement, et le fil
// separe refait la recherche a l'identique — meme graine, meme budget
// d'iterations, meme resultat. C'est la difference entre un chiffre affirme et
// un chiffre reproductible.
//
// Le module ne fait qu'un import dynamique du solveur : rien de tout cela
// n'entre dans le graphe de chargement de la page tant que le joueur n'a pas
// demande une partie libre ou une solution.

let travailleur = null;
let jeton = 0;
const attentes = new Map();

// Une recherche profonde peut demander plusieurs secondes sur un telephone. Le
// delai n'est pas la pour la presser, seulement pour qu'un fil muet ne laisse
// pas le joueur devant des pointilles eternels.
const DELAIS = { rapides: 8000, profonds: 60000 };

function ouvrir() {
    if (travailleur !== null) return travailleur;
    try {
        travailleur = new Worker(new URL('./solveur-worker.js', import.meta.url), { type: 'module' });
        travailleur.addEventListener('message', evenement => {
            const attente = attentes.get(evenement.data.jeton);
            if (!attente) return;
            attentes.delete(evenement.data.jeton);
            attente(evenement.data.erreur ? null : {
                longueur: evenement.data.meilleur,
                murs: evenement.data.murs ?? []
            });
        });
        travailleur.addEventListener('error', () => { travailleur = false; });
    } catch {
        travailleur = false;                 // pas de fil disponible : on fera sans
    }
    return travailleur;
}

// Le repli : la meme recherche, sur le fil principal. Elle bloque le temps
// qu'elle dure, ce qui vaut mieux qu'un troisieme chiffre absent.
async function surPlace({ lignes, colonnes, murs, graine, stations, doubleLigne, reglages }) {
    const [{ genererPlateau }, solveur] = await Promise.all([
        import('./generateur.js'),
        import('./solveur.js')
    ]);
    const choix = reglages === 'profonds' ? solveur.REGLAGES_PROFONDS : solveur.REGLAGES_RAPIDES;
    const { plateau, budget } = genererPlateau({ lignes, colonnes, murs, graine, stations, doubleLigne });
    const trouve = solveur.chercherMeilleur(plateau, budget, { ...choix, graine });
    return { longueur: trouve.longueur, murs: trouve.murs };
}

// Rend { longueur, murs } — ou null si meme le repli a echoue.
export function chercher(configuration) {
    const demande = { reglages: 'rapides', ...configuration };
    const fil = ouvrir();
    if (!fil) return surPlace(demande).catch(() => null);

    return new Promise(resoudre => {
        const identifiant = ++jeton;
        attentes.set(identifiant, resoudre);
        fil.postMessage({ jeton: identifiant, ...demande });
        setTimeout(() => {
            if (!attentes.has(identifiant)) return;
            attentes.delete(identifiant);
            surPlace(demande).then(resoudre).catch(() => resoudre(null));
        }, DELAIS[demande.reglages] ?? DELAIS.rapides);
    });
}

export const chercherMeilleurConnu = configuration =>
    chercher(configuration).then(trouve => trouve?.longueur ?? null);

export async function lireCatalogue() {
    try {
        const reponse = await fetch('data/defis.json', { cache: 'no-cache' });
        if (!reponse.ok) return null;
        return await reponse.json();
    } catch {
        return null;                          // hors ligne sans cache : on cherchera sur place
    }
}
