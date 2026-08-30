// Le defi du jour : la meme grille pour tout le monde, sans serveur.

import { counter } from './harness.mjs';
import { signature } from '../js/plateau.js';
import {
    FORMATS, dateLocale, estUneDate, formatDuJour, graineDuJour, plateauDuJour,
    meilleurConnuDuCatalogue, texteDePartage, dateHumaine, jourDeLaSemaine
} from '../js/defi.js';

const { check, report } = counter();
console.log('\nDefi du jour\n');

check('une date se met en forme', dateLocale(new Date(2026, 7, 30, 12)) === '2026-08-30');
check('une date se reconnait', estUneDate('2026-08-30') && !estUneDate('30/08/2026') && !estUneDate(null));
check('une date s affiche a la francaise', dateHumaine('2026-08-30') === '30/08/2026');

// Le jour de la semaine se calcule a midi : a minuit, une heure de decalage
// suffirait a changer de jour, donc de format.
check('le 30 aout 2026 est un dimanche', jourDeLaSemaine('2026-08-30') === 0);

// La configuration change avec le jour de la semaine.
const attendus = {
    '2026-08-31': 'esquisse',   // lundi
    '2026-09-01': 'esquisse',   // mardi
    '2026-09-02': 'esquisse',   // mercredi
    '2026-09-03': 'esquisse',   // jeudi
    '2026-09-04': 'chantier',   // vendredi
    '2026-09-05': 'oeuvre',     // samedi
    '2026-09-06': 'oeuvre'      // dimanche
};
const bons = Object.entries(attendus).filter(([date, format]) => formatDuJour(date).id === format);
check('chaque jour de la semaine a son format', bons.length === 7,
    Object.entries(attendus).map(([date]) => `${date}:${formatDuJour(date).id}`).join(' '));
check('les trois formats sont distincts',
    new Set(Object.values(FORMATS).map(format => `${format.lignes}x${format.murs}`)).size === 3);

// Meme date, meme graine, meme plateau — chez tout le monde.
check('la graine ne depend que de la date', graineDuJour('2026-08-30') === graineDuJour('2026-08-30'));
check('deux dates voisines donnent des graines eloignees',
    Math.abs(graineDuJour('2026-08-30') - graineDuJour('2026-08-31')) > 1000);

const jour = plateauDuJour('2026-08-30');
const encore = plateauDuJour('2026-08-30');
check('le plateau du jour est reproductible', signature(jour.plateau) === signature(encore.plateau));
check('le plateau du jour suit son format',
    jour.plateau.lignes === jour.format.lignes && jour.budget === jour.format.murs);

// Le catalogue ne parle que de la grille qu'il a vue. Si la generation change,
// le chiffre est ecarte plutot que de mentir.
const catalogue = { jours: { '2026-08-30': { meilleur: 71, signature: signature(jour.plateau) } } };
check('le catalogue rend son meilleur connu', meilleurConnuDuCatalogue(catalogue, '2026-08-30', jour.plateau) === 71);
check('un jour absent ne rend rien', meilleurConnuDuCatalogue(catalogue, '2026-08-29', jour.plateau) === null);
const menteur = { jours: { '2026-08-30': { meilleur: 999, signature: 'deadbeef' } } };
check('une empreinte qui ne concorde pas est ecartee',
    meilleurConnuDuCatalogue(menteur, '2026-08-30', jour.plateau) === null);

// Le catalogue livre avec le jeu doit couvrir aujourd'hui et les mois qui
// viennent : au-dela, la recherche embarquee prend le relais, mais autant
// qu'elle serve le plus tard possible.
const livre = JSON.parse((await import('node:fs')).readFileSync(new URL('../data/defis.json', import.meta.url), 'utf8'));
const dates = Object.keys(livre.jours).sort();
const aujourdhui = dateLocale();
check(`le catalogue couvre ${dates.length} jours, de ${dates[0]} a ${dates.at(-1)}`, dates.length > 300);
check('le catalogue couvre aujourd hui', dates.includes(aujourdhui), aujourdhui);
check('le catalogue va au-dela d un an', dates.at(-1) > aujourdhui);
check('chaque entree porte son empreinte et son meilleur',
    Object.values(livre.jours).every(entree => entree.signature && entree.meilleur > 0));
check('le catalogue ne transporte aucune solution',
    !JSON.stringify(livre).includes('murs":['), 'un placement complet serait un spoiler');

// L'empreinte du catalogue correspond bien aux plateaux que le jeu fabrique.
const accords = dates.slice(0, 40).filter(date => {
    const { plateau } = plateauDuJour(date);
    return livre.jours[date].signature === signature(plateau);
});
check('les empreintes du catalogue correspondent aux plateaux generes', accords.length === 40, `${accords.length}/40`);

// La promesse sur laquelle repose le bouton « voir la solution » : le
// catalogue ne transporte aucun placement, mais la recherche est refaisable a
// l'identique. Meme graine, meme budget d'iterations, meme resultat — sur
// n'importe quelle machine. Sans cela, le jeu montrerait une solution qui ne
// correspondrait pas au chiffre affiche a cote.
const { chercherMeilleur, REGLAGES_PROFONDS } = await import('../js/solveur.js');
const { longueur, avecMurs } = await import('../js/chemin.js');
const refaits = [];
for (const date of ['2026-08-31', '2026-09-04', '2026-09-05', '2027-03-12']) {
    const { plateau, budget } = plateauDuJour(date);
    const trouve = chercherMeilleur(plateau, budget, { ...REGLAGES_PROFONDS, graine: graineDuJour(date) });
    const annonce = livre.jours[date].meilleur;
    refaits.push({
        date,
        annonce,
        trouve: trouve.longueur,
        murs: trouve.murs.length,
        budget,
        // La solution rendue doit vraiment valoir ce qu'elle annonce sur la
        // grille : c'est elle qui sera dessinee a l'ecran.
        verifiee: longueur(avecMurs(plateau, trouve.murs)) === trouve.longueur
    });
}
check('le chiffre du catalogue se refait a l identique depuis la graine',
    refaits.every(essai => essai.trouve === essai.annonce),
    refaits.map(essai => `${essai.date}:${essai.trouve}/${essai.annonce}`).join(' '));
check('la solution refaite depense tout le budget',
    refaits.every(essai => essai.murs === essai.budget));
check('la solution refaite vaut bien sa longueur sur la grille',
    refaits.every(essai => essai.verifiee));

// Le partage : le resultat, jamais la solution.
const partage = texteDePartage({
    date: '2026-08-30',
    format: FORMATS.oeuvre,
    longueur: 74,
    meilleurConnu: 71,
    murs: 18,
    exploit: 'battu',
    lien: 'https://aytan-sudo.github.io/architecte/?jour=2026-08-30'
});
check('le partage nomme le jeu et la date', partage.includes('L\'Architecte') && partage.includes('30/08/2026'));
check('le partage donne le score et le meilleur connu', partage.includes('74') && partage.includes('71'));
check('le partage celebre l exploit', partage.includes('🏆'));
check('le partage porte le lien du jour', partage.includes('?jour=2026-08-30'));
check('le partage tient en quatre lignes', partage.split('\n').length === 4, partage);

const modeste = texteDePartage({
    date: '2026-08-30', format: FORMATS.esquisse, longueur: 20, meilleurConnu: 40, murs: 8, exploit: null,
    lien: 'https://exemple'
});
check('sans exploit, le partage montre une jauge', modeste.includes('▰') && modeste.includes('50 %'), modeste);

report();
