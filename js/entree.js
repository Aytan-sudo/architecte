// Le doigt, la souris, le clavier.
//
// Un seul geste dans tout le jeu : taper une case. C'est peu, et c'est voulu —
// tout le reste du plaisir vient de ce qui se redessine ensuite.

// Ce qui separe deux appuis pour que le navigateur y voie un double-tap. Le
// sien tourne autour de 300 ms ; on prend un peu large.
const DOUBLE_TAP = 350;

// Ce qui doit rester cliquable quoi qu'il arrive. Les cases du plateau sont des
// boutons elles aussi — pour le clavier et les lecteurs d'ecran — mais elles
// sont exclues nommement de cette protection : sur elles, le second appui d'une
// paire rapide doit etre coupe, sans quoi Safari zoome au milieu d'une partie.
// C'est pour cela qu'une case repond au pointeur, jamais au clic tactile.
const CLIQUABLES = 'button, a, input, select, textarea, label, summary';

export function interdireDoubleTap(cible) {
    let dernier = -Infinity;

    cible.addEventListener('touchend', evenement => {
        const maintenant = evenement.timeStamp;
        const rapproche = maintenant - dernier < DOUBLE_TAP;
        dernier = maintenant;

        if (!rapproche) return;
        if (evenement.touches?.length) return;                       // pincement en cours
        const cible2 = evenement.target;
        if (cible2?.closest?.('.case')) { evenement.preventDefault(); return; }
        if (cible2?.closest?.(CLIQUABLES)) return;
        evenement.preventDefault();
    }, { passive: false });
}

export function brancherPlateau({ grille, rendu, surCase }) {
    // Le pointeur, pas le clic : le clic tactile est justement celui que la
    // parade au double-tap supprime.
    grille.addEventListener('pointerup', evenement => {
        const i = rendu.caseDe(evenement.target);
        if (i >= 0) surCase(i);
    });

    // detail === 0 signe une activation au clavier (Entree ou Espace sur le
    // bouton qui a le focus) : elle ne passe par aucun pointeur.
    grille.addEventListener('click', evenement => {
        if (evenement.detail !== 0) return;
        const i = rendu.caseDe(evenement.target);
        if (i >= 0) surCase(i);
    });
}

// Le clavier sur une grille de deux cent cinquante boutons : un seul est
// atteignable par Tab, les fleches deplacent le focus. Sans cela, rejoindre les
// actions du bas demanderait deux cent cinquante tabulations.
export function brancherFlechesGrille({ grille, plateau, rendu }) {
    let courante = plateau.entree;

    const poser = i => {
        for (const bouton of grille.children) bouton.tabIndex = -1;
        const bouton = rendu.boutonDe(i);
        if (!bouton) return;
        bouton.tabIndex = 0;
        courante = i;
    };

    poser(plateau.entree);

    grille.addEventListener('focusin', evenement => {
        const i = rendu.caseDe(evenement.target);
        if (i >= 0) poser(i);
    });

    grille.addEventListener('keydown', evenement => {
        const pas = { ArrowUp: -plateau.colonnes, ArrowDown: plateau.colonnes, ArrowLeft: -1, ArrowRight: 1 }[evenement.key];
        if (pas === undefined) return;
        const colonne = courante % plateau.colonnes;
        if (pas === -1 && colonne === 0) return;
        if (pas === 1 && colonne === plateau.colonnes - 1) return;
        const cible = courante + pas;
        if (cible < 0 || cible >= plateau.cases.length) return;
        evenement.preventDefault();
        poser(cible);
        rendu.boutonDe(cible)?.focus();
    });
}

// Les raccourcis, unifies avec les autres jeux : N nouvelle, R relancer,
// T theme, U ou Ctrl+Z annuler, Y refaire, ? les regles.
export function brancherClavier(actions) {
    document.addEventListener('keydown', evenement => {
        if (evenement.target.matches?.('input, select, textarea')) return;
        if (document.querySelector('dialog[open]') && evenement.key !== 'Escape') return;

        const touche = evenement.key.toLowerCase();
        if ((evenement.ctrlKey || evenement.metaKey) && touche === 'z') {
            evenement.preventDefault();
            (evenement.shiftKey ? actions.refaire : actions.annuler)?.();
            return;
        }
        if (evenement.ctrlKey || evenement.metaKey || evenement.altKey) return;

        const table = {
            u: actions.annuler,
            y: actions.refaire,
            r: actions.relancer,
            n: actions.nouvelle,
            t: actions.theme,
            '?': actions.aide,
            s: actions.partager
        };
        const suite = table[touche];
        if (!suite) return;
        evenement.preventDefault();
        suite();
    });
}

// La vibration : breve, en option, et absente de la plupart des iPhone — d'ou
// l'appel garde plutot que teste.
export function vibrer(motif, autorise) {
    if (!autorise) return;
    try { navigator.vibrate?.(motif); } catch { /* sans importance */ }
}
