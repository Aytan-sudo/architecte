// Ce qui survit a la fermeture de l'onglet.
//
// localStorage uniquement, sous des cles prefixees « architecte. », chaque
// valeur portant sa version de schema. Stockage absent, plein ou corrompu : le
// jeu retombe sur ses defauts et une memoire de session prend le relais. Ne
// jamais empecher de jouer parce qu'on n'a pas su ecrire une preference.

const PREFIXE = 'architecte.';
const SCHEMA = 1;

const secours = new Map();

// Ouvert depuis le hub avec un passeport, le jeu range tout dans l'espace du
// joueur ; en mode invite, dans localStorage, comme avant.
const passeport = globalThis.Passeport?.stockageJeu('architecte') ?? null;

function magasin() {
    if (passeport) return passeport;
    try {
        const test = `${PREFIXE}test`;
        globalThis.localStorage.setItem(test, '1');
        globalThis.localStorage.removeItem(test);
        return globalThis.localStorage;
    } catch {
        return null;
    }
}

function lire(nom, defaut) {
    const cle = PREFIXE + nom;
    try {
        const brut = magasin()?.getItem(cle) ?? secours.get(cle);
        if (!brut) return { ...defaut };
        const valeur = JSON.parse(brut);
        return migrer(nom, valeur, defaut);
    } catch {
        return { ...defaut };
    }
}

function ecrire(nom, valeur) {
    const cle = PREFIXE + nom;
    const brut = JSON.stringify({ ...valeur, schema: SCHEMA });
    secours.set(cle, brut);
    try {
        magasin()?.setItem(cle, brut);
    } catch { /* plein ou refuse : la memoire de session suffit a la partie */ }
}

// Les migrations s'appliquent par palier, selon le format d'origine. Il n'y a
// qu'un schema aujourd'hui ; l'aiguillage existe pour que le premier
// changement n'ait pas a inventer sa propre mecanique.
function migrer(nom, valeur, defaut) {
    if (typeof valeur !== 'object' || valeur === null) return { ...defaut };
    let etat = valeur;
    if ((etat.schema ?? 0) < 1) etat = { ...defaut, ...etat, schema: 1 };
    return { ...defaut, ...etat };
}

// --- Preferences ----------------------------------------------------------

const PREFERENCES = {
    theme: 'carmin',
    sons: true,
    vibration: true,
    tracesFantomes: true,
    taille: 12,
    murs: 12,
    variantes: []
};

export const lirePreferences = () => lire('preferences', PREFERENCES);
export const ecrirePreferences = preferences => ecrire('preferences', preferences);

// --- Partie en cours ------------------------------------------------------

export const lirePartie = () => lire('partie', { partie: null });
export const ecrirePartie = etat => ecrire('partie', etat);
export const oublierPartie = () => ecrire('partie', { partie: null });

// --- Records, par configuration -------------------------------------------
//
// Chaque combinaison mode x taille x budget a son palmares : un detour de 71 en
// grand oeuvre n'a rien a voir avec un detour de 26 en esquisse, et les
// melanger ne dirait rien.

// Le canonique ne porte aucune trace de variante : les palmares deja inscrits
// restent les leurs, et une variante ne concourt jamais contre le jeu nu.
export const cleConfiguration = ({ mode, lignes, colonnes, murs, variantes = [] }) =>
    `${mode}:${lignes}x${colonnes}:${murs}${variantes.length ? `:${[...variantes].sort().join('+')}` : ''}`;

export const lireRecords = () => lire('records', { records: {} });

export function inscrireRecord(configuration, resultat) {
    const etat = lireRecords();
    const cle = cleConfiguration(configuration);
    const ancien = etat.records[cle];
    if (ancien && ancien.longueur >= resultat.longueur) return { cle, record: ancien, nouveau: false };
    etat.records[cle] = resultat;
    ecrire('records', etat);
    return { cle, record: resultat, nouveau: true };
}

export const recordDe = configuration => lireRecords().records[cleConfiguration(configuration)] ?? null;

// --- Series et historique du defi -----------------------------------------

const STATS = { serie: 0, meilleureSerie: 0, dernierJour: null, historique: [], parties: 0 };

export const lireStats = () => lire('stats', STATS);

const veille = dateTexte => {
    const [annee, mois, jour] = dateTexte.split('-').map(Number);
    const date = new Date(annee, mois - 1, jour, 12);
    date.setDate(date.getDate() - 1);
    const deux = valeur => String(valeur).padStart(2, '0');
    return `${date.getFullYear()}-${deux(date.getMonth() + 1)}-${deux(date.getDate())}`;
};

// Seul le defi acheve le jour meme compte pour la serie : un lien du jour
// rouvert plus tard redonne la grille, hors serie.
export function inscrireDefi({ date, aujourdhui, format, longueur, meilleurConnu, murs, exploit }) {
    const etat = lireStats();
    const dejaFait = etat.historique.some(entree => entree.date === date);

    etat.historique = [
        { date, format: format.id, longueur, meilleurConnu, murs, exploit },
        ...etat.historique.filter(entree => entree.date !== date)
    ].slice(0, 30);

    if (date === aujourdhui && !dejaFait) {
        etat.serie = etat.dernierJour === veille(date) ? etat.serie + 1 : 1;
        etat.dernierJour = date;
        etat.meilleureSerie = Math.max(etat.meilleureSerie, etat.serie);
    }
    etat.parties += 1;
    ecrire('stats', etat);
    return etat;
}

// --- Passeport -------------------------------------------------------------
//
// Le tampon Logique du hub recompense une grille terminee, ou l'effort : trente
// murs poses dans la journee, retraits et reprises compris. Renvoie le compte du
// jour, ou null en mode invite, ou rien ne compte.
export function compterMurPasseport(jour, coffre = passeport) {
    if (!coffre) return null;
    let compte = null;
    try { compte = JSON.parse(coffre.getItem(`${PREFIXE}passeport`)); } catch { /* compteur illisible : on repart */ }
    const murs = compte?.jour === jour && Number.isInteger(compte.murs) ? compte.murs + 1 : 1;
    try { coffre.setItem(`${PREFIXE}passeport`, JSON.stringify({ jour, murs })); } catch { /* le passeport signale l'echec */ }
    return murs;
}

export function effacerStats() {
    ecrire('stats', STATS);
    ecrire('records', { records: {} });
    return lireStats();
}

// La serie affichee tombe d'elle-meme si le joueur a saute un jour : elle n'est
// juste que relue au bon moment.
export const serieVivante = (stats, aujourdhui) =>
    stats.dernierJour === aujourdhui || stats.dernierJour === veille(aujourdhui) ? stats.serie : 0;
