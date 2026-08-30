// Le solveur, dans un fil a part.
//
// Il refabrique le plateau a partir de la graine — un message de quatre nombres
// plutot qu'une grille — puis cherche. Le fil principal reste libre : une
// recherche profonde dure quelques secondes sur un telephone, ce qui figerait
// l'ecran si elle se faisait a cote.
//
// Il rend le placement en plus de la longueur. C'est ce qui permet au jeu de
// montrer la solution de la machine sans que le catalogue ait a la transporter :
// meme graine, meme budget d'iterations, meme placement — la solution n'est pas
// livree, elle est refaite.
//
// Ce fichier n'est jamais importe par app.js. C'est ce qui garde le solveur hors
// du chemin de chargement de la page ; tests/test-page.mjs y veille.

import { signature } from './plateau.js';
import { genererPlateau } from './generateur.js';
import { chercherMeilleur, REGLAGES_RAPIDES, REGLAGES_PROFONDS } from './solveur.js';

// Le fil principal ne nomme qu'un reglage, il n'en importe pas la valeur :
// solveur.js resterait dans son graphe de chargement.
const REGLAGES = { rapides: REGLAGES_RAPIDES, profonds: REGLAGES_PROFONDS };

self.addEventListener('message', evenement => {
    const { jeton, lignes, colonnes, murs, graine, reglages } = evenement.data;
    try {
        const { plateau, budget } = genererPlateau({ lignes, colonnes, murs, graine });
        const trouve = chercherMeilleur(plateau, budget, {
            ...(REGLAGES[reglages] ?? REGLAGES_RAPIDES),
            graine
        });
        self.postMessage({
            jeton,
            meilleur: trouve.longueur,
            murs: trouve.murs,
            signature: signature(plateau)
        });
    } catch (erreur) {
        self.postMessage({ jeton, erreur: String(erreur) });
    }
});
