// Le dessin. Aucune regle du jeu ici : ce module recoit un etat et le montre.
//
// Tout le budget d'animation du projet est place au meme endroit — le trace qui
// se reallonge apres une pose. Il pousse depuis l'entree en un peu moins d'une
// demi-seconde, contourne ce qu'on vient de poser, et ses pastilles de virage
// apparaissent dans son sillage. C'est la seule chose que le jeu donne a voir,
// et c'est tout son plaisir. Le reste — murs, beton, refus — se contente de
// gestes courts.

const RAYON_VIRAGE = 0.38;
const SVG = 'http://www.w3.org/2000/svg';

const element = (nom, attributs) => {
    const noeud = document.createElementNS(SVG, nom);
    for (const [cle, valeur] of Object.entries(attributs)) noeud.setAttribute(cle, valeur);
    return noeud;
};

export function creerRendu({ grille, svg }) {
    let plateau = null;
    // Le plateau montre n'est pas toujours celui qu'on joue : pour afficher la
    // solution de la machine, on dessine une autre grille de meme geometrie
    // sans rien changer a la partie en cours.
    let affiche = null;
    let cases = [];
    let derniereLongueur = null;

    const centre = i => ({
        x: (i % affiche.colonnes) + 0.5,
        y: Math.floor(i / affiche.colonnes) + 0.5
    });

    // Les points de rupture seulement : deux pas dans la meme direction ne
    // valent qu'un segment.
    function sommets(chemin) {
        if (chemin.length < 2) return chemin.map(centre);
        const points = [centre(chemin[0])];
        for (let k = 1; k < chemin.length - 1; k++) {
            const avant = chemin[k] - chemin[k - 1];
            const apres = chemin[k + 1] - chemin[k];
            if (avant !== apres) points.push(centre(chemin[k]));
        }
        points.push(centre(chemin[chemin.length - 1]));
        return points;
    }

    // Le trace d'une ligne de reseau : des angles adoucis, jamais casses. Le
    // rayon se reduit tout seul quand deux virages se suivent d'une case.
    function tracer(points) {
        if (points.length === 0) return '';
        if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

        const morceaux = [`M ${points[0].x} ${points[0].y}`];
        for (let k = 1; k < points.length - 1; k++) {
            const avant = points[k - 1];
            const ici = points[k];
            const apres = points[k + 1];

            const longueurAvant = Math.hypot(ici.x - avant.x, ici.y - avant.y);
            const longueurApres = Math.hypot(apres.x - ici.x, apres.y - ici.y);
            const rayon = Math.min(RAYON_VIRAGE, longueurAvant / 2, longueurApres / 2);

            const entree = {
                x: ici.x - ((ici.x - avant.x) / longueurAvant) * rayon,
                y: ici.y - ((ici.y - avant.y) / longueurAvant) * rayon
            };
            const sortie = {
                x: ici.x + ((apres.x - ici.x) / longueurApres) * rayon,
                y: ici.y + ((apres.y - ici.y) / longueurApres) * rayon
            };

            morceaux.push(`L ${entree.x.toFixed(3)} ${entree.y.toFixed(3)}`);
            morceaux.push(`Q ${ici.x} ${ici.y} ${sortie.x.toFixed(3)} ${sortie.y.toFixed(3)}`);
        }
        const dernier = points[points.length - 1];
        morceaux.push(`L ${dernier.x} ${dernier.y}`);
        return morceaux.join(' ');
    }

    function construire(nouveauPlateau) {
        plateau = nouveauPlateau;
        affiche = nouveauPlateau;
        grille.style.setProperty('--colonnes', plateau.colonnes);
        svg.setAttribute('viewBox', `0 0 ${plateau.colonnes} ${plateau.lignes}`);
        grille.textContent = '';
        cases = [];

        for (let i = 0; i < plateau.cases.length; i++) {
            const bouton = document.createElement('button');
            bouton.type = 'button';
            bouton.className = 'case';
            bouton.dataset.i = String(i);
            const ligne = Math.floor(i / plateau.colonnes) + 1;
            const colonne = (i % plateau.colonnes) + 1;
            bouton.setAttribute('aria-label', `ligne ${ligne}, colonne ${colonne}`);
            plateau.liaisons.forEach((liaison, rang) => {
                if (i === liaison.entree) { bouton.dataset.role = 'entree'; bouton.dataset.liaison = rang; }
                if (i === liaison.sortie) { bouton.dataset.role = 'sortie'; bouton.dataset.liaison = rang; }
                if (liaison.stations.includes(i)) { bouton.dataset.role = 'station'; bouton.dataset.liaison = rang; }
            });
            grille.append(bouton);
            cases.push(bouton);
        }
        derniereLongueur = null;
    }

    function dessinerCases(etat) {
        for (let i = 0; i < affiche.cases.length; i++) {
            const valeur = affiche.cases[i];
            const nom = valeur === 1 ? 'obstacle' : valeur === 2 ? 'mur' : 'libre';
            const bouton = cases[i];
            if (bouton.dataset.etat !== nom) bouton.dataset.etat = nom;
            const role = bouton.dataset.role;
            const suffixe = affiche.liaisons.length > 1 ? ` de la ligne ${Number(bouton.dataset.liaison) + 1}` : '';
            const etiquette = role === 'entree' ? `entrée${suffixe}`
                : role === 'sortie' ? `sortie${suffixe}`
                : role === 'station' ? `station à desservir${suffixe}`
                : nom === 'mur' ? 'mur posé' : nom === 'obstacle' ? 'béton' : 'libre';
            bouton.setAttribute('aria-label',
                `ligne ${Math.floor(i / affiche.colonnes) + 1}, colonne ${(i % affiche.colonnes) + 1} : ${etiquette}`);
            bouton.setAttribute('aria-pressed', nom === 'mur' ? 'true' : 'false');
            // Le beton n'est pas desactive, il est seulement inconstructible :
            // un bouton disabled refuse le focus, et les fleches du clavier
            // s'arretaient dessus sans pouvoir aller plus loin. Il reste donc
            // atteignable — et le taper produit la meme secousse de refus que
            // n'importe quelle pose impossible.
            bouton.setAttribute('aria-disabled', nom === 'obstacle' ? 'true' : 'false');
        }
    }

    // Le dessin se fait en couches, et non liaison par liaison.
    //
    // La raison ne se voit qu'a l'ecran : au croisement de deux lignes, la
    // station de la premiere passait sous le ruban de la seconde et
    // disparaissait purement et simplement. Les fantomes d'abord, puis tous les
    // rubans, puis toutes les marques — ainsi rien de ce qui porte une
    // information ne se retrouve enterre.
    const couche = rang => {
        const groupe = element('g', { class: 'liaison', 'data-rang': rang });
        svg.append(groupe);
        return groupe;
    };

    // Les autres plus courts chemins : la ou le trace aurait pu passer.
    function dessinerFantomes(groupe, analyse) {
        for (const i of analyse.alternatives) {
            const { x, y } = centre(i);
            groupe.append(element('circle', { class: 'fantome', cx: x, cy: y, r: 0.08 }));
        }
    }

    function dessinerRuban(groupe, analyse, bouge) {
        const ruban = element('path', { class: 'ruban', d: tracer(sommets(analyse.chemin)) });
        groupe.append(ruban);
        if (!bouge) return;

        const total = ruban.getTotalLength();
        ruban.style.strokeDasharray = String(total);
        ruban.style.strokeDashoffset = String(total);
        // Une lecture forcee : sans elle, le navigateur regroupe les deux
        // ecritures et le trace apparait d'un coup.
        void ruban.getBoundingClientRect();
        ruban.style.strokeDashoffset = '0';
    }

    // Les pastilles de virage, les stations et les deux bouts.
    function dessinerMarques(groupe, analyse, bouge) {
        analyse.virages.forEach((i, position) => {
            const { x, y } = centre(i);
            const pastille = element('circle', { class: 'pastille', cx: x, cy: y, r: 0.15 });
            if (bouge) {
                pastille.style.animationDelay = `${(0.12 + (position / Math.max(1, analyse.virages.length)) * 0.3).toFixed(2)}s`;
            }
            groupe.append(pastille);
        });

        // Les stations : un losange, pour ne ressembler ni a un virage ni a un
        // terminus. Ce sont les seuls points que la ligne doit desservir.
        for (const i of analyse.stations) {
            const { x, y } = centre(i);
            groupe.append(element('rect', {
                class: 'station', x: x - 0.19, y: y - 0.19, width: 0.38, height: 0.38, rx: 0.06,
                transform: `rotate(45 ${x} ${y})`
            }));
        }

        const depart = centre(analyse.entree);
        const arrivee = centre(analyse.sortie);
        groupe.append(element('circle', { class: 'bout', cx: depart.x, cy: depart.y, r: 0.3 }));
        groupe.append(element('circle', { class: 'bout-creux', cx: depart.x, cy: depart.y, r: 0.13 }));
        groupe.append(element('circle', { class: 'bout', cx: arrivee.x, cy: arrivee.y, r: 0.3 }));
        groupe.append(element('circle', { class: 'bout-creux', cx: arrivee.x, cy: arrivee.y, r: 0.13 }));
        groupe.append(element('circle', { class: 'anneau', cx: arrivee.x, cy: arrivee.y, r: 0.42 }));
    }

    function dessinerTrace(etat, { anime = true, fantomes = true } = {}) {
        svg.textContent = '';
        if (etat.longueur < 0) return;

        const change = derniereLongueur !== null && derniereLongueur !== etat.longueur;
        const bouge = anime && change && !matchMedia('(prefers-reduced-motion: reduce)').matches;
        const praticables = etat.liaisons.filter(analyse => analyse.longueur >= 0);

        if (fantomes) praticables.forEach((analyse, rang) => dessinerFantomes(couche(rang), analyse));
        praticables.forEach((analyse, rang) => dessinerRuban(couche(rang), analyse, bouge));
        praticables.forEach((analyse, rang) => dessinerMarques(couche(rang), analyse, bouge));

        derniereLongueur = etat.longueur;
    }

    return {
        construire,

        // `plateau` permet de montrer une autre grille que celle qu'on joue ;
        // `vue` dit laquelle, pour que la feuille de style traite les murs de la
        // machine autrement que les siens.
        dessiner(etat, options = {}) {
            affiche = options.plateau ?? plateau;
            grille.parentElement.dataset.vue = options.vue ?? 'joueur';
            dessinerCases(etat);
            dessinerTrace(etat, options);
        },

        // Le refus : la case recule et clignote, rien de plus. Pas de boite de
        // dialogue pour dire ce que le joueur voit deja.
        refuser(i) {
            const bouton = cases[i];
            if (!bouton) return;
            delete bouton.dataset.refus;
            void bouton.offsetWidth;
            bouton.dataset.refus = 'oui';
            setTimeout(() => { delete bouton.dataset.refus; }, 500);
        },

        caseDe(cible) {
            const bouton = cible?.closest?.('.case');
            return bouton ? Number(bouton.dataset.i) : -1;
        },

        boutonDe: i => cases[i],
        nombreDeCases: () => cases.length
    };
}
