// Le catalogue des defis du jour.
//
// Ce script ne tourne jamais dans le navigateur : il se lance a la main, avant
// une publication, et son resultat est un fichier de nombres. Pour chaque date,
// il refabrique le plateau du jour (le meme que celui que le joueur verra, la
// graine vient de la date) et lance la recherche profonde du meilleur connu —
// quelques centaines de millisecondes par grille, ce qu'aucun telephone ne peut
// se permettre au chargement.
//
// Le fichier ne contient pas les murs de la machine. Un catalogue public qui
// transporterait la solution serait un catalogue de spoilers.
//
//   node scripts/catalogue.mjs --jours 450 --sortie data/defis.json

import { writeFileSync } from 'node:fs';
import { signature } from '../js/plateau.js';
import { chercherMeilleur, REGLAGES_PROFONDS } from '../js/solveur.js';
import { plateauDuJour, dateLocale, formatDuJour, graineDuJour } from '../js/defi.js';

const arguments_ = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
    arguments_.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1]);
}

const jours = Number(arguments_.get('jours') ?? 450);
const sortie = arguments_.get('sortie') ?? 'data/defis.json';
const recul = Number(arguments_.get('recul') ?? 30);

const depart = new Date();
depart.setDate(depart.getDate() - recul);

const catalogue = {
    version: 1,
    genere: dateLocale(),
    // La recherche est notee dans le fichier : le jour ou l'on augmentera le
    // budget, on saura de quel effort le chiffre precedent venait.
    recherche: { ...REGLAGES_PROFONDS },
    jours: {}
};

const debut = Date.now();

for (let k = 0; k < jours; k++) {
    const date = new Date(depart);
    date.setDate(date.getDate() + k);
    const texte = dateLocale(date);

    const { plateau, budget, format } = plateauDuJour(texte);
    const trouve = chercherMeilleur(plateau, budget, { ...REGLAGES_PROFONDS, graine: graineDuJour(texte) });

    catalogue.jours[texte] = {
        format: format.id,
        lignes: format.lignes,
        colonnes: format.colonnes,
        murs: budget,
        meilleur: trouve.longueur,
        signature: signature(plateau)
    };

    if (k % 25 === 0 || k === jours - 1) {
        const ecoule = ((Date.now() - debut) / 1000).toFixed(0);
        process.stdout.write(`  ${texte}  ${format.libelle.padEnd(11)} meilleur connu ${String(trouve.longueur).padStart(3)}   (${k + 1}/${jours}, ${ecoule} s)\n`);
    }
}

writeFileSync(sortie, `${JSON.stringify(catalogue, null, 0)}\n`);
console.log(`\n${Object.keys(catalogue.jours).length} defis ecrits dans ${sortie} en ${((Date.now() - debut) / 1000).toFixed(0)} s`);
