// L'assemblage, et rien d'autre.
//
// Le noyau (chemin, generateur, partie) ne connait pas cette page ; la page ne
// connait pas les regles. Ce fichier est le seul endroit ou les deux se
// rencontrent.

import { creerPartie, REFUS_BUDGET, REFUS_COUPE } from './partie.js';
import { genererPlateau } from './generateur.js';
import { longueur, analyser, avecMurs } from './chemin.js';
import { graineDepuisTexte } from './hasard.js';
import {
    FORMATS, dateLocale, estUneDate, formatDuJour, graineDuJour,
    plateauDuJour, meilleurConnuDuCatalogue, texteDePartage
} from './defi.js';
import { creerRendu } from './rendu.js';
import { brancherPlateau, brancherClavier, brancherFlechesGrille, interdireDoubleTap, vibrer } from './entree.js';
import { appliquer, themeSuivant } from './themes.js';
import { chercher, chercherMeilleurConnu, lireCatalogue } from './recherche.js';
import * as son from './son.js';
import * as stockage from './stockage.js';
import * as ui from './ui.js';

const TAILLES = [8, 10, 12, 16, 20];
const budgetsPour = taille => [Math.round(taille / 2), taille, Math.round(taille * 1.5)];

const rendu = creerRendu({ grille: ui.elements.grille(), svg: ui.elements.trace() });

let preferences = stockage.lirePreferences();
let catalogue = null;

// L'etat de la session, en un seul endroit.
const session = {
    mode: 'jour',
    date: dateLocale(),
    graine: 0,
    format: FORMATS.chantier,
    partie: null,
    plateauNu: null,
    depart: 0,
    finMontree: -1,
    jeton: 0,
    cherche: false,
    // La solution de la machine : refaite a la demande, gardee le temps de la
    // grille, et jamais montree avant que le budget soit depense.
    reglages: 'rapides',
    solution: null,
    solutionVue: false,
    vue: 'joueur'
};

appliquer(preferences.theme);

// --- Mise a l'ecran -------------------------------------------------------

function rafraichir({ anime = true } = {}) {
    session.vue = 'joueur';
    const etat = session.partie.etat();
    rendu.dessiner(etat, { anime, fantomes: preferences.tracesFantomes });
    ui.majCompteurs(etat, { cherche: session.cherche });
    ui.majBandeau({ actif: false });
    ui.majMention(etat, { depart: session.depart, impasse: session.partie.impasse() });
    ui.majActions({
        peutAnnuler: session.partie.peutAnnuler(),
        peutRefaire: session.partie.peutRefaire(),
        murs: etat.mursPoses,
        solutionOfferte: etat.termine && etat.meilleurConnu !== null
    });
    ui.majBoutonSolution({ occupe: false, affichee: false });
    ui.majTitre({
        mode: session.mode,
        format: session.format,
        date: session.date,
        serie: stockage.serieVivante(stockage.lireStats(), dateLocale())
    });
    sauvegarder();
    return etat;
}

function sauvegarder() {
    stockage.ecrirePartie({
        partie: {
            mode: session.mode,
            date: session.date,
            graine: session.graine,
            lignes: session.format.lignes,
            colonnes: session.format.colonnes,
            murs: session.format.murs,
            actions: session.partie.serialiser()
        }
    });
}

const configurationCourante = () => ({
    mode: session.mode,
    lignes: session.format.lignes,
    colonnes: session.format.colonnes,
    murs: session.format.murs
});

// --- Le coup, et ce qu'il declenche ---------------------------------------

function jouer(i) {
    // Sur la grille de la machine, taper ne construit pas : cela ramene a la
    // sienne. C'est le geste que tout le monde essaie en premier.
    if (session.vue === 'machine') { rafraichir(); return; }

    const avant = session.partie.etat();
    const resultat = session.partie.basculer(i);

    if (!resultat.fait) {
        rendu.refuser(i);
        if (preferences.sons) son.sonRefus();
        vibrer([12, 40, 12], preferences.vibration);
        ui.annoncer(resultat.raison === REFUS_BUDGET
            ? 'Plus de murs disponibles.'
            : resultat.raison === REFUS_COUPE
                ? 'Refusé : ce mur fermerait le passage.'
                : 'Case indisponible.');
        return;
    }

    const etat = rafraichir();

    if (preferences.sons) {
        const degre = son.degreDe({
            longueur: etat.longueur,
            depart: session.depart,
            meilleurConnu: etat.meilleurConnu
        });
        if (resultat.action === 'pose') son.sonPose(degre);
        else son.sonRetrait(degre);
    }
    vibrer(8, preferences.vibration);

    ui.annoncer(`Détour ${etat.longueur}, ${etat.mursRestants} murs restants.`);
    if (etat.termine && avant.mursRestants > 0) terminer(etat);
}

function terminer(etat) {
    // Une partie jouee apres avoir vu la solution n'entre pas au palmares —
    // meme regle que l'indice dans les autres jeux de la collection. Ce qui
    // avait ete inscrit avant reste acquis.
    const record = session.solutionVue ? null : stockage.inscrireRecord(configurationCourante(), {
        longueur: etat.longueur,
        date: dateLocale()
    });

    if (session.mode === 'jour' && !session.solutionVue) {
        stockage.inscrireDefi({
            date: session.date,
            aujourdhui: dateLocale(),
            format: session.format,
            longueur: etat.longueur,
            meilleurConnu: etat.meilleurConnu,
            murs: etat.budget,
            exploit: etat.exploit
        });
    }

    if (preferences.sons) {
        if (etat.exploit === 'battu') son.sonExploit();
        else if (etat.exploit === 'egalite') son.sonEgalite();
        else son.sonFin();
    }
    vibrer(etat.exploit === 'battu' ? [18, 60, 18, 60, 30] : 18, preferences.vibration);

    // Le dialogue ne revient pas a chaque retouche : seulement au premier
    // budget epuise, puis quand le joueur fait mieux qu'a sa derniere lecture.
    if (etat.longueur > session.finMontree) {
        session.finMontree = etat.longueur;
        ui.ouvrirFin({ etat, format: session.format, record, mode: session.mode, solutionVue: session.solutionVue });
    }
}

// --- Demarrage d'une partie -----------------------------------------------

async function demarrer(demande, { reprise = null } = {}) {
    // Un jeton par partie : une recherche encore en vol quand le joueur change
    // de grille ne doit pas venir poser son chiffre sur la nouvelle.
    const jeton = ++session.jeton;
    session.mode = demande.mode;
    session.date = demande.date ?? dateLocale();
    session.cherche = false;

    let plateau;
    let budget;

    if (demande.mode === 'jour') {
        const jour = plateauDuJour(session.date);
        plateau = jour.plateau;
        budget = jour.budget;
        session.format = jour.format;
        session.graine = graineDuJour(session.date);
    } else {
        session.graine = demande.graine ?? graineDepuisTexte(`libre:${Date.now()}`);
        session.format = {
            id: 'libre',
            libelle: 'Partie libre',
            lignes: demande.taille,
            colonnes: demande.taille,
            murs: demande.murs
        };
        const genere = genererPlateau({
            lignes: demande.taille,
            colonnes: demande.taille,
            murs: demande.murs,
            graine: session.graine
        });
        plateau = genere.plateau;
        budget = genere.budget;
    }

    session.depart = longueur(plateau);
    session.finMontree = -1;
    session.plateauNu = plateau;
    session.solution = null;
    session.solutionVue = false;
    session.vue = 'joueur';
    // Le defi du jour affiche le chiffre du catalogue : pour retrouver le meme
    // placement, il faudra refaire la meme recherche profonde. La partie libre,
    // elle, affiche le resultat de la recherche courte deja faite ici.
    session.reglages = demande.mode === 'jour' ? 'profonds' : 'rapides';

    // Le meilleur connu : le catalogue d'abord — il porte une recherche
    // profonde impossible a refaire ici — la recherche embarquee ensuite.
    let meilleurConnu = null;
    if (demande.mode === 'jour') {
        meilleurConnu = meilleurConnuDuCatalogue(catalogue, session.date, plateau);
    }

    session.partie = creerPartie({ plateau, budget, meilleurConnu, configuration: configurationCourante() });
    rendu.construire(session.partie.plateau);
    brancherFlechesGrille({ grille: ui.elements.grille(), plateau: session.partie.plateau, rendu });

    // Fermer l'onglet ne coute rien : si la partie sauvegardee porte sur cette
    // grille-la, on la rejoue, historique d'annulation compris. Un lien partage
    // qui tombe sur une grille deja jouee la rend donc telle qu'on l'a laissee ;
    // une nouvelle grille, elle, a une autre graine et ne rappelle rien.
    if (reprise === null) {
        const sauvegarde = stockage.lirePartie().partie;
        const memeGrille = sauvegarde
            && sauvegarde.mode === session.mode
            && sauvegarde.graine === session.graine
            && sauvegarde.lignes === session.format.lignes
            && sauvegarde.murs === session.format.murs;
        if (memeGrille) reprise = sauvegarde.actions;
    }
    if (reprise) session.partie.rejouer(reprise);
    session.cherche = meilleurConnu === null;
    rafraichir({ anime: false });

    if (meilleurConnu === null) {
        const trouve = await chercherMeilleurConnu(configurationDeRecherche());
        if (jeton !== session.jeton) return;
        session.cherche = false;
        if (trouve !== null) session.partie.fixerMeilleurConnu(trouve);
        rafraichir({ anime: false });
    }
}

const configurationDeRecherche = () => ({
    lignes: session.format.lignes,
    colonnes: session.format.colonnes,
    murs: session.format.murs,
    graine: session.graine,
    reglages: session.reglages
});

// --- La solution de la machine --------------------------------------------
//
// Le catalogue ne transporte aucun placement : il serait public, et ce serait
// un fichier de spoilers. La solution est donc refaite ici, avec la meme graine
// et le meme budget d'iterations que celle qui a produit le chiffre affiche —
// meme recherche, meme resultat. Le chiffre cesse d'etre affirme : il est
// reproduit sous les yeux du joueur.
async function montrerSolution() {
    if (session.vue === 'machine') { rafraichir(); return; }

    const etat = session.partie.etat();
    if (!etat.termine || etat.meilleurConnu === null) return;

    if (!session.solution) {
        ui.majBoutonSolution({ occupe: true, affichee: false });
        ui.annoncer('La machine refait sa recherche…');
        const jeton = session.jeton;
        const trouve = await chercher(configurationDeRecherche());
        if (jeton !== session.jeton) return;                  // le joueur est passe a une autre grille
        ui.majBoutonSolution({ occupe: false, affichee: false });
        if (!trouve || !trouve.murs.length) {
            ui.annoncer('La recherche n’a pas abouti.');
            return;
        }
        session.solution = trouve;
    }

    session.solutionVue = true;
    session.vue = 'machine';

    const grilleMachine = avecMurs(session.plateauNu, session.solution.murs);
    const analyse = analyser(grilleMachine);
    rendu.dessiner(analyse, { plateau: grilleMachine, vue: 'machine', anime: true, fantomes: false });
    ui.majCompteurs({
        longueur: analyse.longueur,
        mursRestants: 0,
        meilleurConnu: etat.meilleurConnu
    }, { vue: 'machine' });
    ui.majBandeau({ actif: true, longueur: analyse.longueur, murs: session.solution.murs.length });
    ui.majBoutonSolution({ occupe: false, affichee: true });
    // Le focus quitte le plateau : sur la grille de la machine, aucune case
    // n'est jouable, et le seul geste qui reste est le retour.
    document.getElementById('solution-fermer').focus();
    ui.annoncer(`Solution de la machine : détour ${analyse.longueur} avec ${session.solution.murs.length} murs.`);
}

const partieLibre = (options = {}) => demarrer({
    mode: 'libre',
    taille: options.taille ?? preferences.taille,
    murs: options.murs ?? preferences.murs,
    graine: options.graine
});

// --- Partage ---------------------------------------------------------------

function lienDe() {
    const base = location.origin + location.pathname;
    if (session.mode === 'jour') return `${base}?jour=${session.date}`;
    return `${base}?taille=${session.format.lignes}&murs=${session.format.murs}&seed=${session.graine}`;
}

async function partager() {
    const etat = session.partie.etat();
    const texte = texteDePartage({
        date: session.date,
        format: session.format,
        longueur: etat.longueur,
        meilleurConnu: etat.meilleurConnu,
        murs: etat.mursPoses,
        exploit: etat.exploit,
        lien: lienDe()
    });
    const copie = await ui.copier(texte);
    ui.annoncer(copie ? 'Résultat copié.' : 'La copie a échoué.');
    const bouton = document.getElementById('action-partager');
    bouton.textContent = copie ? 'Copié !' : 'Copie refusée';
    setTimeout(() => { bouton.innerHTML = '<span aria-hidden="true">↑</span>Partager'; }, 1600);
}

// --- Options ---------------------------------------------------------------

function ouvrirOptions() {
    ui.remplirOptions({
        preferences,
        tailles: TAILLES,
        budgets: budgetsPour(preferences.taille),
        surTheme: id => {
            preferences.theme = id;
            stockage.ecrirePreferences(preferences);
            appliquer(id);
            ui.majTheme(id);
        },
        surTaille: taille => {
            preferences.taille = taille;
            const budgets = budgetsPour(taille);
            if (!budgets.includes(preferences.murs)) preferences.murs = budgets[1];
            stockage.ecrirePreferences(preferences);
            ouvrirOptions();
        },
        surMurs: murs => {
            preferences.murs = murs;
            stockage.ecrirePreferences(preferences);
        },
        surOption: (cle, valeur) => {
            preferences[cle] = valeur;
            stockage.ecrirePreferences(preferences);
            if (cle === 'sons') ui.majSon(valeur);
            if (cle === 'tracesFantomes') rafraichir({ anime: false });
        }
    });
    ui.ouvrir('dialogue-options');
}

function ouvrirStats() {
    ui.remplirStats({
        stats: stockage.lireStats(),
        records: stockage.lireRecords().records,
        serie: stockage.serieVivante(stockage.lireStats(), dateLocale())
    });
    ui.ouvrir('dialogue-stats');
}

// --- Cablage ---------------------------------------------------------------

const bouton = (id, action) => document.getElementById(id).addEventListener('click', action);

ui.brancherDialogues();
ui.majSon(preferences.sons);

brancherPlateau({ grille: ui.elements.grille(), rendu, surCase: jouer });
interdireDoubleTap(document);

bouton('aide-ouvrir', () => ui.ouvrir('dialogue-aide'));
bouton('options-ouvrir', ouvrirOptions);
bouton('stats-ouvrir', ouvrirStats);
bouton('theme-basculer', () => {
    preferences.theme = themeSuivant(preferences.theme).id;
    stockage.ecrirePreferences(preferences);
    appliquer(preferences.theme);
});
bouton('son-basculer', () => {
    preferences.sons = !preferences.sons;
    stockage.ecrirePreferences(preferences);
    ui.majSon(preferences.sons);
});

bouton('action-annuler', () => { session.partie.annuler(); rafraichir(); });
bouton('action-refaire', () => { session.partie.refaire(); rafraichir(); });
bouton('action-recommencer', () => { session.partie.recommencer(); session.finMontree = -1; rafraichir(); });
bouton('action-partager', partager);
bouton('action-solution', montrerSolution);
bouton('solution-fermer', () => rafraichir());
bouton('fin-solution', () => {
    document.getElementById('dialogue-fin').close();
    montrerSolution();
});

bouton('nav-jour', () => demarrer({ mode: 'jour', date: dateLocale() }));
bouton('nav-libre', () => partieLibre());
bouton('options-jouer', () => {
    document.getElementById('dialogue-options').close();
    partieLibre();
});
bouton('fin-partager', partager);
bouton('fin-rejouer', () => {
    document.getElementById('dialogue-fin').close();
    partieLibre();
});
bouton('effacer-stats', () => {
    stockage.effacerStats();
    ouvrirStats();
});

brancherClavier({
    annuler: () => { session.partie.annuler(); rafraichir(); },
    refaire: () => { session.partie.refaire(); rafraichir(); },
    relancer: () => { session.partie.recommencer(); session.finMontree = -1; rafraichir(); },
    nouvelle: () => partieLibre(),
    theme: () => {
        preferences.theme = themeSuivant(preferences.theme).id;
        stockage.ecrirePreferences(preferences);
        appliquer(preferences.theme);
    },
    aide: () => ui.ouvrir('dialogue-aide'),
    partager
});

son.preparerSon(document, () => preferences.sons);
son.surveillerVisibilite(document);

// --- Ouverture --------------------------------------------------------------

async function ouverture() {
    catalogue = await lireCatalogue();

    const parametres = new URLSearchParams(location.search);
    const jour = parametres.get('jour');
    const graine = parametres.get('seed');

    if (estUneDate(jour)) {
        await demarrer({ mode: 'jour', date: jour });
        return;
    }
    if (graine) {
        await partieLibre({
            taille: Number(parametres.get('taille')) || preferences.taille,
            murs: Number(parametres.get('murs')) || preferences.murs,
            graine: Number(graine)
        });
        return;
    }

    // Reprise : fermer l'onglet ne coute rien. La partie en cours revient telle
    // quelle, y compris son historique d'annulation.
    const sauvegarde = stockage.lirePartie().partie;
    if (sauvegarde?.mode === 'jour' && sauvegarde.date === dateLocale()) {
        await demarrer({ mode: 'jour', date: sauvegarde.date }, { reprise: sauvegarde.actions });
        return;
    }
    if (sauvegarde?.mode === 'libre') {
        await demarrer({
            mode: 'libre',
            taille: sauvegarde.lignes,
            murs: sauvegarde.murs,
            graine: sauvegarde.graine
        }, { reprise: sauvegarde.actions });
        return;
    }

    await demarrer({ mode: 'jour', date: dateLocale() });
    if (!stockage.lireStats().parties) ui.ouvrir('dialogue-aide');
}

ouverture();

// Le service worker : le jeu doit s'ouvrir dans le metro.
if ('serviceWorker' in navigator) {
    addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { /* sans lui, le jeu marche en ligne */ }));
}
