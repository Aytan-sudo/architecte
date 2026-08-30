// La partie : le budget, la pose, l'annulation, le score.
//
// Aucun DOM, aucune horloge, aucun hasard : tout se rejoue en Node. L'etat
// tient dans une liste d'actions, ce qui donne l'annulation illimitee sans
// effort — et la reprise de la partie en cours par simple rejeu.
//
// La regle dure vit ici, dans basculer() : un mur qui rendrait la sortie
// inatteignable est refuse, et la fonction dit pourquoi. C'est a l'interface de
// traduire ce refus en secousse, pas en boite de dialogue.

import { LIBRE, MUR, copier, posable } from './plateau.js';
import { analyser, casesInterdites, longueur } from './chemin.js';

export const REFUS_BUDGET = 'budget';
export const REFUS_COUPE = 'coupe';
export const REFUS_CASE = 'case';

export function creerPartie({ plateau, budget, meilleurConnu = null, configuration = null }) {
    const travail = copier(plateau);
    const depart = Uint8Array.from(plateau.cases);

    let murs = [];
    let historique = [];
    let futur = [];
    let analyse = analyser(travail);
    let interdites = casesInterdites(travail);

    const rafraichir = () => {
        analyse = analyser(travail);
        interdites = casesInterdites(travail);
    };

    const appliquer = action => {
        if (action.type === 'pose') {
            travail.cases[action.case] = MUR;
            murs.push(action.case);
        } else {
            travail.cases[action.case] = LIBRE;
            murs = murs.filter(i => i !== action.case);
        }
    };

    const defaire = action => appliquer({
        type: action.type === 'pose' ? 'retrait' : 'pose',
        case: action.case
    });

    const partie = {
        plateau: travail,
        budget,
        configuration,

        // Le meilleur connu peut arriver apres la partie : le catalogue le
        // donne tout de suite, la recherche embarquee met une fraction de
        // seconde. Il se pose donc plus tard, sans reconstruire la partie —
        // sinon les murs deja poses disparaitraient sous le joueur.
        fixerMeilleurConnu(valeur) { meilleurConnu = valeur; },
        meilleurConnu: () => meilleurConnu,

        // Taper une case libre y pose un mur, la retaper le retire. Rien
        // d'autre : c'est le seul geste du jeu.
        basculer(i) {
            if (travail.cases[i] === MUR) {
                const action = { type: 'retrait', case: i };
                appliquer(action);
                historique.push(action);
                futur = [];
                rafraichir();
                return { fait: true, action: 'retrait', case: i };
            }

            if (!posable(travail, i)) return { fait: false, raison: REFUS_CASE, case: i };
            if (murs.length >= budget) return { fait: false, raison: REFUS_BUDGET, case: i };
            if (interdites[i]) return { fait: false, raison: REFUS_COUPE, case: i };

            const action = { type: 'pose', case: i };
            appliquer(action);
            historique.push(action);
            futur = [];
            rafraichir();
            return { fait: true, action: 'pose', case: i };
        },

        peutAnnuler: () => historique.length > 0,
        peutRefaire: () => futur.length > 0,

        annuler() {
            const action = historique.pop();
            if (!action) return null;
            defaire(action);
            futur.push(action);
            rafraichir();
            return action;
        },

        refaire() {
            const action = futur.pop();
            if (!action) return null;
            appliquer(action);
            historique.push(action);
            rafraichir();
            return action;
        },

        // Tout retirer, sans effacer l'histoire : le geste reste annulable.
        recommencer() {
            for (const i of [...murs]) partie.basculer(i);
        },

        // La seule case interdite qui compte pour l'interface : celle qui
        // couperait le passage. Le budget epuise est un autre refus, et il se
        // dit autrement.
        interdites: () => interdites,

        // L'impasse : des murs en main, plus aucune case ou les poser. La
        // generation la rend pratiquement impossible, mais l'interface doit
        // pouvoir la nommer plutot que de laisser le joueur taper dans le vide.
        impasse() {
            if (murs.length >= budget) return false;
            for (let i = 0; i < travail.cases.length; i++) {
                if (posable(travail, i) && !interdites[i]) return false;
            }
            return true;
        },

        etat() {
            const restants = budget - murs.length;
            const termine = restants === 0;
            let exploit = null;
            if (termine && meilleurConnu !== null) {
                if (analyse.longueur > meilleurConnu) exploit = 'battu';
                else if (analyse.longueur === meilleurConnu) exploit = 'egalite';
            }
            return {
                longueur: analyse.longueur,
                // Une analyse par liaison : le jeu canonique en a une, la
                // variante Double ligne en a deux, et le rendu ne fait que les
                // parcourir.
                liaisons: analyse.liaisons,
                nombreTraces: analyse.nombreTraces,
                murs: [...murs],
                mursPoses: murs.length,
                mursRestants: restants,
                budget,
                meilleurConnu,
                termine,
                exploit
            };
        },

        // La partie en cours tient dans sa liste d'actions : la reprise se fait
        // par rejeu, pas par recopie d'un etat. Une sauvegarde ecrite par une
        // version anterieure reste donc jouable tant que les regles ne bougent
        // pas.
        serialiser: () => ({
            historique: historique.map(action => [action.type === 'pose' ? 1 : 0, action.case]),
            futur: futur.map(action => [action.type === 'pose' ? 1 : 0, action.case])
        }),

        rejouer(sauvegarde) {
            if (!sauvegarde) return false;
            travail.cases.set(depart);
            murs = [];
            historique = [];
            futur = [];
            for (const [type, i] of sauvegarde.historique ?? []) {
                const action = { type: type === 1 ? 'pose' : 'retrait', case: i };
                // Une action devenue impossible arrete le rejeu : on garde ce
                // qui a pu etre rejoue plutot que de refuser la partie entiere.
                if (action.type === 'pose' && (!posable(travail, i) || murs.length >= budget)) break;
                if (action.type === 'retrait' && travail.cases[i] !== MUR) break;
                appliquer(action);
                historique.push(action);
            }
            futur = (sauvegarde.futur ?? []).map(([type, i]) => ({ type: type === 1 ? 'pose' : 'retrait', case: i }));
            rafraichir();
            return longueur(travail) >= 0;
        }
    };

    return partie;
}
