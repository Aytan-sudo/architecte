// Les compteurs, les dialogues, les poignees sur le document.
//
// Ce module connait la page ; il ne connait pas les regles. Il recoit un etat
// deja calcule et le pose sur l'ecran — et il rend a app.js des fonctions a
// brancher sur les boutons.

import { THEMES, themeDe } from './themes.js';
import { FORMATS, dateHumaine } from './defi.js';

export const VERSION = '1.0.0';

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

export function majCompteurs(etat, { cherche = false } = {}) {
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

export function majActions({ peutAnnuler, peutRefaire, murs }) {
    $('action-annuler').disabled = !peutAnnuler;
    $('action-refaire').disabled = !peutRefaire;
    $('action-recommencer').disabled = murs === 0;
}

export function majTitre({ mode, format, date, serie }) {
    const titre = $('titre-mode');
    if (mode === 'jour') {
        titre.textContent = `Défi du ${dateHumaine(date).slice(0, 5)} · ${format.libelle}${serie > 1 ? ` · série ${serie}` : ''}`;
    } else {
        titre.textContent = `Partie libre · ${format.lignes}×${format.colonnes} · ${format.murs} murs`;
    }
    $('nav-jour').setAttribute('aria-current', mode === 'jour' ? 'true' : 'false');
    $('nav-libre').setAttribute('aria-current', mode === 'libre' ? 'true' : 'false');
}

export function annoncer(texte) {
    $('annonce').textContent = texte;
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

export function remplirOptions({ preferences, tailles, budgets, surTheme, surTaille, surMurs, surOption }) {
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

export function ouvrirFin({ etat, format, record, mode }) {
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
    $('fin-rejouer').textContent = mode === 'jour' ? 'Partie libre' : 'Nouvelle grille';
    ouvrir('dialogue-fin');
}

// --- Resultats ------------------------------------------------------------

const libelleConfiguration = cle => {
    const [mode, taille, murs] = cle.split(':');
    const format = Object.values(FORMATS).find(f => `${f.lignes}x${f.colonnes}` === taille && f.murs === Number(murs));
    const nom = mode === 'jour' ? `Défi · ${format?.libelle ?? taille}` : `Libre · ${taille.replace('x', '×')}`;
    return `${nom} · ${murs} murs`;
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
