// Le solveur, dans un fil a part.
//
// Il refabrique le plateau a partir de la graine — un message de quatre nombres
// plutot qu'une grille — puis cherche le meilleur connu. Le fil principal reste
// libre : la recherche dure une centaine de millisecondes, ce qui suffirait a
// faire sauter la premiere animation du trace si elle se faisait a cote.
//
// Ce fichier n'est jamais importe par app.js. C'est ce qui garde le solveur
// hors du chemin de chargement de la page ; tests/test-page.mjs y veille.

import { signature } from './plateau.js';
import { genererPlateau } from './generateur.js';
import { chercherMeilleur, REGLAGES_RAPIDES } from './solveur.js';

self.addEventListener('message', evenement => {
    const { jeton, lignes, colonnes, murs, graine, reglages } = evenement.data;
    try {
        const { plateau, budget } = genererPlateau({ lignes, colonnes, murs, graine });
        const trouve = chercherMeilleur(plateau, budget, { ...REGLAGES_RAPIDES, ...reglages, graine });
        self.postMessage({ jeton, meilleur: trouve.longueur, signature: signature(plateau) });
    } catch (erreur) {
        self.postMessage({ jeton, erreur: String(erreur) });
    }
});
