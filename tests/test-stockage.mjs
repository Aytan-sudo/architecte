// Ce qui survit a la fermeture de l'onglet — et ce qui doit survivre a un
// stockage absent, plein ou corrompu : ne jamais empecher de jouer.

import { counter } from './harness.mjs';

// Un faux localStorage, avant d'importer le module : c'est lui qui le lira.
const memoire = new Map();
globalThis.localStorage = {
    getItem: cle => (memoire.has(cle) ? memoire.get(cle) : null),
    setItem: (cle, valeur) => memoire.set(cle, String(valeur)),
    removeItem: cle => memoire.delete(cle),
    clear: () => memoire.clear()
};

const stockage = await import('../js/stockage.js');
const { check, report } = counter();
console.log('\nStockage\n');

// Preferences.
const defauts = stockage.lirePreferences();
check('les preferences ont des defauts', defauts.theme === 'carmin' && defauts.sons === true);
stockage.ecrirePreferences({ ...defauts, theme: 'encre', sons: false });
check('les preferences se relisent', stockage.lirePreferences().theme === 'encre');
check('les preferences gardent les cles absentes', stockage.lirePreferences().taille === 12);
check('les cles sont prefixees par le jeu',
    [...memoire.keys()].every(cle => cle.startsWith('architecte.')), [...memoire.keys()].join(' '));
check('chaque valeur porte sa version de schema',
    [...memoire.values()].every(valeur => JSON.parse(valeur).schema === 1));

// Corruption : on retombe sur les defauts, sans exception.
memoire.set('architecte.preferences', '{ceci n est pas du json');
check('une valeur corrompue retombe sur les defauts', stockage.lirePreferences().theme === 'carmin');
memoire.set('architecte.preferences', '"une chaine"');
check('une valeur du mauvais type retombe sur les defauts', stockage.lirePreferences().sons === true);

// Records, par configuration : un detour de 71 en grand oeuvre ne concourt pas
// contre un detour de 26 en esquisse.
const grand = { mode: 'jour', lignes: 16, colonnes: 16, murs: 18 };
const petit = { mode: 'libre', lignes: 10, colonnes: 10, murs: 8 };
stockage.inscrireRecord(grand, { longueur: 71, date: '2026-08-30' });
stockage.inscrireRecord(petit, { longueur: 26, date: '2026-08-30' });
check('un record s inscrit', stockage.recordDe(grand).longueur === 71);
check('les configurations ne se melangent pas', stockage.recordDe(petit).longueur === 26);
check('un moins bon score ne remplace pas le record',
    stockage.inscrireRecord(grand, { longueur: 60, date: '2026-08-31' }).nouveau === false
    && stockage.recordDe(grand).longueur === 71);
check('un meilleur score remplace le record',
    stockage.inscrireRecord(grand, { longueur: 74, date: '2026-08-31' }).nouveau === true
    && stockage.recordDe(grand).longueur === 74);
check('une configuration jamais jouee n a pas de record',
    stockage.recordDe({ mode: 'libre', lignes: 20, colonnes: 20, murs: 30 }) === null);

// Series : seul le defi acheve le jour meme compte.
const format = { id: 'oeuvre' };
stockage.inscrireDefi({ date: '2026-08-28', aujourdhui: '2026-08-28', format, longueur: 60, meilleurConnu: 62, murs: 18, exploit: null });
check('la premiere serie vaut un', stockage.lireStats().serie === 1);
stockage.inscrireDefi({ date: '2026-08-29', aujourdhui: '2026-08-29', format, longueur: 61, meilleurConnu: 62, murs: 18, exploit: null });
check('un jour de plus allonge la serie', stockage.lireStats().serie === 2);
stockage.inscrireDefi({ date: '2026-08-29', aujourdhui: '2026-08-29', format, longueur: 63, meilleurConnu: 62, murs: 18, exploit: 'battu' });
check('rejouer le meme jour n allonge pas la serie', stockage.lireStats().serie === 2);
check('l historique garde le dernier resultat du jour', stockage.lireStats().historique[0].exploit === 'battu');
stockage.inscrireDefi({ date: '2026-08-20', aujourdhui: '2026-08-29', format, longueur: 55, meilleurConnu: 62, murs: 18, exploit: null });
check('un lien du jour rouvert plus tard ne compte pas pour la serie', stockage.lireStats().serie === 2);
stockage.inscrireDefi({ date: '2026-09-05', aujourdhui: '2026-09-05', format, longueur: 60, meilleurConnu: 62, murs: 18, exploit: null });
check('un jour saute repart de un', stockage.lireStats().serie === 1);
check('la meilleure serie est gardee', stockage.lireStats().meilleureSerie === 2);
check('la serie affichee tombe si le joueur a saute un jour',
    stockage.serieVivante(stockage.lireStats(), '2026-09-20') === 0);
check('la serie affichee tient encore le lendemain',
    stockage.serieVivante(stockage.lireStats(), '2026-09-06') === 1);

// Reprise de la partie en cours.
stockage.ecrirePartie({ partie: { mode: 'jour', date: '2026-08-30', actions: { historique: [[1, 5]] } } });
check('la partie en cours se relit', stockage.lirePartie().partie.actions.historique[0][1] === 5);
stockage.oublierPartie();
check('la partie s oublie', stockage.lirePartie().partie === null);

// Effacement.
stockage.effacerStats();
check('tout effacer vide les series', stockage.lireStats().serie === 0);
check('tout effacer vide les records', Object.keys(stockage.lireRecords().records).length === 0);

// Un stockage qui refuse d'ecrire ne doit pas empecher de jouer.
globalThis.localStorage = {
    getItem: () => { throw new Error('refuse'); },
    setItem: () => { throw new Error('plein'); },
    removeItem: () => { throw new Error('refuse'); }
};
let survecu = true;
try {
    stockage.ecrirePreferences({ theme: 'menthe' });
    stockage.lirePreferences();
    stockage.inscrireRecord(petit, { longueur: 30, date: '2026-08-30' });
} catch { survecu = false; }
check('un stockage en panne ne leve pas d exception', survecu);
check('la memoire de session prend le relais', stockage.lirePreferences().theme === 'menthe');

report();
