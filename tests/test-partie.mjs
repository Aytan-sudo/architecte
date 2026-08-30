// La partie : la regle dure, le budget, l'annulation illimitee, la reprise.

import { counter, plateauDessine } from './harness.mjs';
import { MUR, creerPlateau } from '../js/plateau.js';
import { creerPartie, REFUS_BUDGET, REFUS_COUPE, REFUS_CASE } from '../js/partie.js';
import { genererPlateau } from '../js/generateur.js';
import { creerHasard } from '../js/hasard.js';

const { check, report } = counter();
console.log('\nPartie\n');

const petit = creerPlateau({ lignes: 5, colonnes: 5, entree: 10, sortie: 14 });
const partie = creerPartie({ plateau: petit, budget: 3, meilleurConnu: 10 });

check('la partie commence au plus court', partie.etat().longueur === 4, String(partie.etat().longueur));
check('le budget est entier au depart', partie.etat().mursRestants === 3);

const pose = partie.basculer(11);
check('poser un mur est accepte', pose.fait && pose.action === 'pose');
check('poser allonge le chemin', partie.etat().longueur > 4, String(partie.etat().longueur));
check('le budget diminue', partie.etat().mursRestants === 2);

check('retaper la meme case retire le mur', partie.basculer(11).action === 'retrait');
check('le chemin revient a sa longueur initiale', partie.etat().longueur === 4);
check('le budget est rendu', partie.etat().mursRestants === 3);

check('poser sur l entree est refuse', partie.basculer(10).raison === REFUS_CASE);
check('poser sur la sortie est refuse', partie.basculer(14).raison === REFUS_CASE);

// La regle dure : un mur qui coupe la sortie est refuse, et le refus se nomme.
const couloir = plateauDessine(`
    # # # # #
    E . . . S
    # # # # #
`);
const enfermee = creerPartie({ plateau: couloir, budget: 3 });
const refus = enfermee.basculer(6);
check('un mur qui couperait la sortie est refuse', !refus.fait && refus.raison === REFUS_COUPE);
check('le refus ne consomme pas de budget', enfermee.etat().mursRestants === 3);
check('la case coupante est signalee avant la tentative', enfermee.interdites()[6] === 1);
check('le chemin reste toujours praticable', enfermee.etat().longueur === 4);

// Budget epuise : le refus n'est pas le meme, et l'interface doit pouvoir les
// distinguer.
const serre = creerPartie({ plateau: creerPlateau({ lignes: 6, colonnes: 6, entree: 12, sortie: 17 }), budget: 1 });
serre.basculer(13);
const trop = serre.basculer(19);
check('sans budget, la pose est refusee pour cette raison', trop.raison === REFUS_BUDGET);

// Annulation et retour, sans limite.
const longue = creerPartie({ plateau: creerPlateau({ lignes: 8, colonnes: 8, entree: 24, sortie: 31 }), budget: 6 });
const posees = [25, 33, 41, 18, 10, 2];
for (const i of posees) longue.basculer(i);
const apres = longue.etat().longueur;
check('six murs poses', longue.etat().mursPoses === 6);
for (let k = 0; k < 6; k++) longue.annuler();
check('tout annuler ramene au plateau nu', longue.etat().mursPoses === 0);
check('plus rien a annuler', longue.peutAnnuler() === false);
for (let k = 0; k < 6; k++) longue.refaire();
check('tout refaire ramene au meme score', longue.etat().longueur === apres, String(longue.etat().longueur));
check('une pose apres annulation efface le futur',
    (longue.annuler(), longue.basculer(3), longue.peutRefaire() === false));

// Le drapeau d'exploit, la sensation que le jeu cherche a produire.
const petitJeu = creerPartie({ plateau: petit, budget: 2, meilleurConnu: 100 });
petitJeu.basculer(11);
check('sans budget depense, aucun exploit n est annonce', petitJeu.etat().exploit === null);
petitJeu.basculer(13);
check('le meilleur connu inatteignable ne donne pas d exploit', petitJeu.etat().exploit === null);
check('le budget est bien epuise', petitJeu.etat().termine === true);

const facile = creerPartie({ plateau: petit, budget: 2, meilleurConnu: 4 });
facile.basculer(11);
facile.basculer(13);
check('faire mieux que la machine est signale', facile.etat().exploit === 'battu', String(facile.etat().longueur));

const egal = creerPartie({ plateau: petit, budget: 1, meilleurConnu: null });
egal.basculer(11);
const referenceEgalite = creerPartie({ plateau: petit, budget: 1, meilleurConnu: egal.etat().longueur });
referenceEgalite.basculer(11);
check('l egalite avec la machine est signalee', referenceEgalite.etat().exploit === 'egalite');

// La reprise par rejeu.
const { plateau: genere } = genererPlateau({ lignes: 10, colonnes: 10, murs: 8, graine: 555 });
const avant = creerPartie({ plateau: genere, budget: 8 });
const hasard = creerHasard(9);
for (let k = 0; k < 5; k++) {
    const libres = [];
    for (let i = 0; i < genere.cases.length; i++) {
        if (avant.plateau.cases[i] === 0 && !avant.interdites()[i] && i !== genere.entree && i !== genere.sortie) libres.push(i);
    }
    avant.basculer(hasard.choisir(libres));
}
avant.annuler();
const sauvegarde = avant.serialiser();
const reprise = creerPartie({ plateau: genere, budget: 8 });
check('la reprise accepte la sauvegarde', reprise.rejouer(sauvegarde) === true);
check('la reprise retrouve le score', reprise.etat().longueur === avant.etat().longueur,
    `${reprise.etat().longueur} contre ${avant.etat().longueur}`);
check('la reprise retrouve les murs', reprise.etat().murs.join(',') === avant.etat().murs.join(','));
check('la reprise garde le futur annulable', reprise.peutRefaire() === true);

// Le meilleur connu arrive parfois apres la partie : le catalogue repond tout
// de suite, la recherche embarquee met une fraction de seconde. Le poser ne
// doit pas reconstruire la partie — les murs deja poses disparaitraient.
const tardive = creerPartie({ plateau: petit, budget: 1, meilleurConnu: null });
tardive.basculer(11);
check('sans meilleur connu, aucun exploit', tardive.etat().exploit === null);
tardive.fixerMeilleurConnu(tardive.etat().longueur - 1);
check('le meilleur connu pose apres coup est pris en compte', tardive.etat().exploit === 'battu',
    String(tardive.etat().meilleurConnu));
check('les murs deja poses sont restes', tardive.etat().mursPoses === 1);

// Le plateau d'origine n'est jamais salopé : recommencer une partie doit
// pouvoir repartir de la meme grille.
check('la generation d origine reste intacte', !genere.cases.includes(MUR));

report();
