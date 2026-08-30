// Le defi du jour, et le partage.
//
// La grille du jour n'arrive d'aucun serveur : la date donne une graine, la
// graine donne le plateau, et le generateur le refabrique a l'identique chez
// chaque joueur. Le catalogue (data/defis.json) ne transporte qu'un nombre, le
// meilleur connu — celui-la ne peut pas se recalculer sur un telephone en un
// temps raisonnable.
//
// Limite assumee : l'horloge de la machine fait foi. Se tricher soi-meme est
// possible, et sans interet.

import { graineDepuisTexte } from './hasard.js';
import { signature } from './plateau.js';
import { genererPlateau } from './generateur.js';

// La configuration change avec le jour de la semaine : une esquisse en semaine,
// un chantier le vendredi, un grand oeuvre le week-end, quand on a le temps de
// s'y perdre. Les scores ne se comparent donc qu'entre jours de meme nom — les
// records sont tenus par configuration, jamais melanges.
export const FORMATS = {
    esquisse: { id: 'esquisse', libelle: 'Esquisse', lignes: 10, colonnes: 10, murs: 8 },
    chantier: { id: 'chantier', libelle: 'Chantier', lignes: 12, colonnes: 12, murs: 12 },
    oeuvre: { id: 'oeuvre', libelle: 'Grand œuvre', lignes: 16, colonnes: 16, murs: 18 }
};

const SEMAINE = ['oeuvre', 'esquisse', 'esquisse', 'esquisse', 'esquisse', 'chantier', 'oeuvre'];

export const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

// Une date en texte, dans le fuseau du joueur — pas en UTC, sinon le defi
// change a une heure du matin pour la moitie de l'Europe.
export function dateLocale(date = new Date()) {
    const deux = valeur => String(valeur).padStart(2, '0');
    return `${date.getFullYear()}-${deux(date.getMonth() + 1)}-${deux(date.getDate())}`;
}

export const estUneDate = texte => /^\d{4}-\d{2}-\d{2}$/.test(texte ?? '');

// Le jour de la semaine se calcule a midi : a minuit, un decalage d'une heure
// suffirait a changer de jour.
export const jourDeLaSemaine = dateTexte => {
    const [annee, mois, jour] = dateTexte.split('-').map(Number);
    return new Date(annee, mois - 1, jour, 12).getDay();
};

export const formatDuJour = dateTexte => FORMATS[SEMAINE[jourDeLaSemaine(dateTexte)]];

export const graineDuJour = dateTexte => graineDepuisTexte(`architecte:${dateTexte}`);

export function plateauDuJour(dateTexte) {
    const format = formatDuJour(dateTexte);
    const { plateau, budget } = genererPlateau({
        lignes: format.lignes,
        colonnes: format.colonnes,
        murs: format.murs,
        graine: graineDuJour(dateTexte)
    });
    return { plateau, budget, format, date: dateTexte };
}

// Le meilleur connu du catalogue, mais seulement s'il parle bien de cette
// grille-la. L'empreinte est comparee : si la generation change un jour, le
// chiffre est ecarte plutot que de mentir, et la recherche embarquee prend le
// relais.
export function meilleurConnuDuCatalogue(catalogue, dateTexte, plateau) {
    const entree = catalogue?.jours?.[dateTexte];
    if (!entree) return null;
    if (entree.signature && entree.signature !== signature(plateau)) return null;
    return entree.meilleur ?? null;
}

export const dateHumaine = dateTexte => {
    const [annee, mois, jour] = dateTexte.split('-');
    return `${jour}/${mois}/${annee}`;
};

// Le partage : ce qu'on a obtenu, ce que la machine connait, et le lien vers la
// grille — jamais la solution, jamais un placement.
export function texteDePartage({ date, format, longueur, meilleurConnu, murs, exploit, lien }) {
    const jauge = (() => {
        if (!meilleurConnu) return '';
        const part = Math.max(0, Math.min(1, longueur / meilleurConnu));
        const pleins = Math.round(part * 10);
        return `${'▰'.repeat(pleins)}${'▱'.repeat(10 - pleins)}`;
    })();

    const verdict = exploit === 'battu' ? '🏆 la machine est battue'
        : exploit === 'egalite' ? '🟰 à égalité avec la machine'
        : meilleurConnu ? `${jauge} ${Math.round((longueur / meilleurConnu) * 100)} %`
        : `${murs} murs posés`;

    const lignes = [
        `L'Architecte ${dateHumaine(date)} · ${format.libelle}`,
        `Détour ${longueur}${meilleurConnu ? ` · meilleur connu ${meilleurConnu}` : ''} · ${murs} murs`,
        verdict
    ];
    if (lien) lignes.push(lien);
    return lignes.join('\n');
}
