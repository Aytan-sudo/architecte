// Les compteurs, les dialogues, les poignees sur le document.
//
// Ce module connait la page ; il ne connait pas les regles. Il recoit un etat
// deja calcule et le pose sur l'ecran — et il rend a app.js des fonctions a
// brancher sur les boutons.

import { THEMES, themeDe } from './themes.js';
import { FORMATS, dateHumaine } from './defi.js';
import { VARIANTES, disponible, libelleVariantes } from './variantes.js';

export const VERSION = '1.3.1';

const $ = id => document.getElementById(id);

export const elements = {
    titreMode: () => $('titre-mode'),
    detour: () => $('valeur-detour'),
    murs: () => $('valeur-murs'),
    meilleur: () => $('valeur-meilleur'),
    compteurMeilleur: () => $('compteur-meilleur'),
    compteurMurs: () => $('compteur-murs'),
    mention: () => $('mention'),
    grille: () => $('grille'),
    trace: () => $('trace'),
    plateau: () => $('plateau'),
    annonce: () => $('annonce')
};

// Un chiffre qui change se signale de lui-meme : il remonte d'un cheveu. Sans
// cela, le regard reste sur le plateau et rate le score.
function poser(noeud, valeur) {
    const texte = String(valeur);
    if (noeud.textContent === texte) return;
    noeud.textContent = texte;
    noeud.classList.remove('change');
    void noeud.offsetWidth;
    noeud.classList.add('change');
}

export function majCompteurs(etat, { cherche = false, vue = 'joueur' } = {}) {
    document.querySelector('.compteurs').dataset.vue = vue;
    poser($('valeur-detour'), etat.longueur < 0 ? '—' : etat.longueur);
    poser($('valeur-murs'), etat.mursRestants);
    poser($('valeur-meilleur'), etat.meilleurConnu ?? (cherche ? '…' : '—'));
    $('compteur-murs').classList.toggle('vide', etat.mursRestants === 0);
    $('compteur-meilleur').classList.toggle('vide', etat.meilleurConnu === null);
}

// La ligne sous les compteurs. Elle sert d'abord a une chose : dire qu'il
// existe d'autres plus courts chemins. Sans elle, le trace qui saute d'un cote
// a l'autre apres une pose sans rapport passe pour un bug.
export function majMention(etat, { depart, impasse = false }) {
    const mention = $('mention');
    mention.classList.toggle('exploit', Boolean(etat.exploit));

    if (impasse) {
        mention.textContent = 'Plus aucune pose ne laisserait un passage.';
        return;
    }
    if (etat.exploit === 'battu') {
        mention.innerHTML = '🏆 <b>Vous avez battu la machine.</b>';
        return;
    }
    if (etat.exploit === 'egalite') {
        mention.innerHTML = '🟰 <b>À égalité avec la machine.</b>';
        return;
    }

    const morceaux = [];
    if (etat.nombreTraces > 1) {
        morceaux.push(etat.nombreTraces > 999
            ? '≡ des centaines de tracés de même longueur'
            : `≡ ${etat.nombreTraces} tracés de même longueur`);
    }
    const gain = etat.longueur - depart;
    if (gain > 0) morceaux.push(`+${gain} pas sur le chemin d’origine`);
    mention.textContent = morceaux.join(' · ');
}

export function majActions({ peutAnnuler, peutRefaire, murs, solutionOfferte }) {
    $('action-annuler').disabled = !peutAnnuler;
    $('action-refaire').disabled = !peutRefaire;
    $('action-recommencer').disabled = murs === 0;
    // La solution n'apparait qu'une fois le budget depense : avant, ce bouton
    // ne serait pas une aide, ce serait la fin du jeu.
    $('action-solution').hidden = !solutionOfferte;
}

export function majTitre({ mode, format, date, serie }) {
    const titre = $('titre-mode');
    if (mode === 'jour') {
        titre.textContent = `Défi du ${dateHumaine(date).slice(0, 5)} · ${format.libelle}${serie > 1 ? ` · série ${serie}` : ''}`;
    } else {
        const variantes = format.variantes?.length ? ` · ${libelleVariantes(format.variantes)}` : '';
        titre.textContent = `Libre · ${format.lignes}×${format.colonnes} · ${format.murs} murs${variantes}`;
    }
    $('nav-jour').setAttribute('aria-current', mode === 'jour' ? 'true' : 'false');
    $('nav-libre').setAttribute('aria-current', mode === 'libre' ? 'true' : 'false');
}

export function annoncer(texte) {
    $('annonce').textContent = texte;
}

// --- La solution de la machine --------------------------------------------

export function majBandeau({ actif, longueur, murs }) {
    const bandeau = $('bandeau-solution');
    bandeau.hidden = !actif;
    $('mention').hidden = actif;
    if (!actif) return;
    $('bandeau-detour').textContent = longueur;
    $('bandeau-murs').textContent = murs;
}

// Le bouton dit ce qu'il fait pendant qu'il le fait : la machine refait sa
// recherche pour de vrai, et cela peut demander deux ou trois secondes sur un
// telephone. Un bouton muet passerait pour un bouton casse.
export function majBoutonSolution({ occupe, affichee }) {
    for (const id of ['action-solution', 'fin-solution']) {
        const bouton = $(id);
        bouton.setAttribute('aria-busy', occupe ? 'true' : 'false');
        bouton.disabled = occupe;
        const libelle = occupe ? 'Cherche…' : affichee ? 'Retour' : 'Solution';
        if (id === 'action-solution') bouton.innerHTML = `<span aria-hidden="true">◆</span>${libelle}`;
        else bouton.textContent = occupe ? 'La machine cherche…' : affichee ? 'Revenir à ma grille' : 'Voir la solution';
    }
}

// --- Dialogues ------------------------------------------------------------

export function brancherDialogues() {
    for (const dialogue of document.querySelectorAll('dialog')) {
        for (const bouton of dialogue.querySelectorAll('[data-fermer]')) {
            bouton.addEventListener('click', () => dialogue.close());
        }
        // Taper le fond ferme aussi : sur telephone, le pouce n'atteint pas
        // toujours la croix.
        dialogue.addEventListener('click', evenement => {
            if (evenement.target === dialogue) dialogue.close();
        });
    }
}

export const ouvrir = id => {
    const dialogue = $(id);
    if (!dialogue.open) dialogue.showModal();
};

// --- Options --------------------------------------------------------------

export function remplirOptions({ preferences, tailles, budgets, surTheme, surTaille, surMurs, surOption, surVariante }) {
    // Les variantes ne sont proposees que la ou elles ont un sens : la double
    // ligne demande 16 cases de cote, et la case a cocher le dit au lieu de
    // disparaitre — une option qui s'evapore laisse croire a une panne.
    const choixVariantes = $('choix-variantes');
    choixVariantes.textContent = '';
    for (const variante of VARIANTES) {
        const offerte = disponible(variante, preferences.taille);
        const etiquette = document.createElement('label');
        etiquette.className = 'option';
        etiquette.innerHTML = `<input type="checkbox" id="variante-${variante.id}"${offerte ? '' : ' disabled'}>`
            + `<span><strong>${variante.libelle}</strong><small>${variante.resume}</small>`
            + `<small>${variante.detail}</small></span>`;
        const case_ = etiquette.querySelector('input');
        case_.checked = offerte && preferences.variantes.includes(variante.id);
        case_.addEventListener('change', () => surVariante(variante.id, case_.checked));
        choixVariantes.append(etiquette);
    }

    const choixTheme = $('choix-theme');
    choixTheme.textContent = '';
    for (const theme of THEMES) {
        const bouton = document.createElement('button');
        bouton.type = 'button';
        bouton.innerHTML = `<i class="pastille-theme" style="--apercu:${theme.ligne}"></i>${theme.libelle}`;
        bouton.setAttribute('aria-pressed', theme.id === preferences.theme ? 'true' : 'false');
        bouton.addEventListener('click', () => surTheme(theme.id));
        choixTheme.append(bouton);
    }

    const remplirListe = (noeud, valeurs, choisie, formatter) => {
        noeud.textContent = '';
        for (const valeur of valeurs) {
            const option = document.createElement('option');
            option.value = String(valeur);
            option.textContent = formatter(valeur);
            if (valeur === choisie) option.selected = true;
            noeud.append(option);
        }
    };

    remplirListe($('choix-taille'), tailles, preferences.taille, valeur => `${valeur} × ${valeur}`);
    remplirListe($('choix-murs'), budgets, preferences.murs, valeur => `${valeur} murs`);

    $('choix-taille').onchange = evenement => surTaille(Number(evenement.target.value));
    $('choix-murs').onchange = evenement => surMurs(Number(evenement.target.value));

    for (const [cle, id] of [['sons', 'option-sons'], ['vibration', 'option-vibration'], ['tracesFantomes', 'option-fantomes']]) {
        const case_ = $(id);
        case_.checked = Boolean(preferences[cle]);
        case_.onchange = () => surOption(cle, case_.checked);
    }

    $('version').textContent = `L’Architecte ${VERSION}`;
}

export function majTheme(id) {
    for (const bouton of $('choix-theme').children) {
        bouton.setAttribute('aria-pressed', bouton.textContent.trim() === themeDe(id).libelle ? 'true' : 'false');
    }
}

export function majSon(actif) {
    const bouton = $('son-basculer');
    bouton.setAttribute('aria-pressed', actif ? 'true' : 'false');
    bouton.textContent = actif ? '♪' : '♪̸';
}

// --- Fin de partie --------------------------------------------------------

export function ouvrirFin({ etat, format, record, mode, solutionVue = false }) {
    $('fin-detour').textContent = etat.longueur;
    $('fin-meilleur').textContent = etat.meilleurConnu ?? '—';
    $('fin-murs').textContent = etat.budget;

    const verdict = $('fin-verdict');
    verdict.classList.toggle('battu', etat.exploit === 'battu');

    if (etat.exploit === 'battu') {
        $('fin-legende').textContent = 'Exploit';
        $('fin-titre').textContent = 'Vous avez battu la machine';
        $('fin-verdict-titre').textContent = `${etat.longueur} contre ${etat.meilleurConnu}`;
        $('fin-verdict-detail').textContent = 'La recherche automatique n’avait pas trouvé mieux que ce qu’elle affichait. Vous, si.';
    } else if (etat.exploit === 'egalite') {
        $('fin-legende').textContent = 'Égalité';
        $('fin-titre').textContent = 'Vous rejoignez la machine';
        $('fin-verdict-titre').textContent = `${etat.longueur}, comme elle`;
        $('fin-verdict-detail').textContent = 'Personne ne sait s’il existe mieux sur cette grille.';
    } else {
        const part = etat.meilleurConnu ? Math.round((etat.longueur / etat.meilleurConnu) * 100) : null;
        $('fin-legende').textContent = 'Budget épuisé';
        $('fin-titre').textContent = 'Le chantier est fini';
        $('fin-verdict-titre').textContent = part ? `${part} % du meilleur connu` : `${etat.longueur} pas`;
        $('fin-verdict-detail').textContent = 'Les murs se retirent : annulez, déplacez, regardez le tracé changer d’avis.';
    }

    if (record?.nouveau) {
        $('fin-verdict-detail').textContent += ' — nouveau record pour cette configuration.';
    }
    $('fin-note-solution').hidden = !solutionVue;
    $('fin-solution').hidden = etat.meilleurConnu === null;
    $('fin-rejouer').textContent = mode === 'jour' ? 'Partie libre' : 'Nouvelle grille';
    ouvrir('dialogue-fin');
}

// --- Resultats ------------------------------------------------------------

const libelleConfiguration = cle => {
    const [mode, taille, murs, variantes] = cle.split(':');
    const format = Object.values(FORMATS).find(f => `${f.lignes}x${f.colonnes}` === taille && f.murs === Number(murs));
    const nom = mode === 'jour' ? `Défi · ${format?.libelle ?? taille}` : `Libre · ${taille.replace('x', '×')}`;
    const suffixe = variantes ? ` · ${libelleVariantes(variantes.split('+'))}` : '';
    return `${nom} · ${murs} murs${suffixe}`;
};

export function remplirStats({ stats, records, serie }) {
    $('stat-serie').textContent = serie;
    $('stat-record-serie').textContent = stats.meilleureSerie;

    const palmares = $('palmares');
    palmares.textContent = '';
    const entrees = Object.entries(records);
    $('palmares-vide').hidden = entrees.length > 0;
    for (const [cle, resultat] of entrees.sort((a, b) => a[0].localeCompare(b[0]))) {
        const ligne = document.createElement('li');
        ligne.innerHTML = `<span>${libelleConfiguration(cle)}</span><b>${resultat.longueur}</b>`;
        palmares.append(ligne);
    }

    const historique = $('historique');
    historique.textContent = '';
    $('historique-vide').hidden = stats.historique.length > 0;
    for (const entree of stats.historique.slice(0, 12)) {
        const ligne = document.createElement('li');
        const marque = entree.exploit === 'battu' ? ' <span class="marque">🏆</span>'
            : entree.exploit === 'egalite' ? ' <span class="marque">🟰</span>' : '';
        ligne.innerHTML = `<span>${dateHumaine(entree.date)}${marque}</span><b>${entree.longueur}${entree.meilleurConnu ? ` / ${entree.meilleurConnu}` : ''}</b>`;
        historique.append(ligne);
    }
}

// --- Partage --------------------------------------------------------------

export async function copier(texte) {
    try {
        await navigator.clipboard.writeText(texte);
        return true;
    } catch {
        // Le repli d'avant l'API : un champ hors ecran, une selection, une
        // commande. Safari le refuse hors d'un geste, d'ou l'appel direct
        // depuis le clic.
        try {
            const champ = document.createElement('textarea');
            champ.value = texte;
            champ.setAttribute('readonly', '');
            champ.style.position = 'absolute';
            champ.style.left = '-9999px';
            document.body.append(champ);
            champ.select();
            const fait = document.execCommand('copy');
            champ.remove();
            return fait;
        } catch {
            return false;
        }
    }
}
