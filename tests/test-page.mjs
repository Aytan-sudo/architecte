// Verifications structurelles de la page.
//
// Les fautes attrapees ici ne provoquent aucune exception : elles laissent un
// bouton muet, un fichier absent du cache hors ligne, ou — le pire pour ce
// projet — le solveur embarque dans le chemin de chargement de la page.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { counter } from './harness.mjs';

const { check, report } = counter();
console.log('\nPage\n');

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const lire = chemin => readFileSync(join(racine, chemin), 'utf8');

const page = lire('index.html');
const worker = lire('sw.js');
const cablage = lire('js/app.js');
const interface_ = lire('css/interface.css');
const manifeste = JSON.parse(lire('manifest.webmanifest'));

// Ce que la page charge vraiment : on suit les imports statiques depuis
// app.js, plutot que de se fier a une liste tenue a la main.
function modulesCharges(depart) {
    const vus = new Set();
    const aVoir = [depart];
    while (aVoir.length) {
        const nom = aVoir.pop();
        if (vus.has(nom)) continue;
        vus.add(nom);
        for (const [, cible] of lire(`js/${nom}`).matchAll(/from\s+'\.\/([\w-]+\.js)'/g)) aVoir.push(cible);
    }
    return vus;
}

const charges = modulesCharges('app.js');
const tous = readdirSync(join(racine, 'js')).filter(nom => nom.endsWith('.js'));

// L'invariant du projet : la recherche du meilleur connu ne doit jamais
// s'inviter dans le chemin de chargement. Le defi du jour lit un catalogue ; la
// partie libre passe par un fil separe, charge a la demande.
check('le solveur ne part pas dans le chargement de la page', !charges.has('solveur.js'), [...charges].join(' '));
check('le fil du solveur non plus', !charges.has('solveur-worker.js'));
check('le fil separe, lui, importe bien le solveur',
    lire('js/solveur-worker.js').includes("from './solveur.js'"));
check('la recherche ne charge le solveur qu a la demande',
    lire('js/recherche.js').includes("import('./solveur.js')"));
check('la page charge le moteur, le rendu et l entree',
    ['partie.js', 'chemin.js', 'generateur.js', 'rendu.js', 'entree.js', 'defi.js'].every(nom => charges.has(nom)));
check('aucun module n est orphelin',
    tous.every(nom => charges.has(nom) || ['solveur.js', 'solveur-worker.js'].includes(nom)),
    tous.filter(nom => !charges.has(nom)).join(' '));

// La coquille du service worker : on lit la liste, pas le fichier — un
// commentaire qui cite un chemin n'est pas une mise en cache.
const coquille = [...worker.matchAll(/^\s+'([^']+)',?$/gm)].map(([, chemin]) => chemin);
const attendus = [
    'index.html', 'manifest.webmanifest', 'data/defis.json',
    ...readdirSync(join(racine, 'js')).filter(nom => nom.endsWith('.js')).map(nom => `js/${nom}`),
    ...readdirSync(join(racine, 'css')).filter(nom => nom.endsWith('.css')).map(nom => `css/${nom}`),
    ...readdirSync(join(racine, 'assets')).map(nom => `assets/${nom}`)
];
const oublies = attendus.filter(chemin => !coquille.includes(chemin));
check(`le service worker liste les ${attendus.length} fichiers du jeu`, oublies.length === 0, oublies.join(' '));
check('le service worker met en cache la racine', coquille.includes('./'));
check('le service worker met en cache le catalogue des defis', coquille.includes('data/defis.json'));
check('le service worker met en cache le solveur : hors ligne, la partie libre en a besoin',
    coquille.includes('js/solveur.js') && coquille.includes('js/solveur-worker.js'));
const manquants = coquille.filter(chemin => chemin !== './' && !existsSync(join(racine, chemin)));
check('tous les fichiers de la coquille existent', manquants.length === 0, manquants.join(' '));

// Reseau d'abord : le cache d'abord laissait le joueur sur l'ancienne version,
// et faisait servir en local les fichiers d'un jeu a un autre.
const surFetch = worker.slice(worker.indexOf("addEventListener('fetch'"));
check('le service worker va au reseau avant le cache',
    surFetch.indexOf('fetch(evenement.request)') < surFetch.indexOf('caches.match'));
check('le service worker garde le cache pour le hors-ligne', /catch\(\(\) =>[\s\S]*caches\.match/.test(surFetch));

// Le numero de version vit a trois endroits, et les trois doivent s'accorder.
// Celui du cache surtout : un cache qui garde son nom garde son contenu, donc
// une version publiee sans renommer le cache ne parvient jamais aux joueurs qui
// ont installe le jeu.
const version = JSON.parse(lire('package.json')).version;
check('le numero de version est un numero', /^\d+\.\d+\.\d+$/.test(version), version);
check('l interface affiche la version de package.json',
    lire('js/ui.js').includes(`export const VERSION = '${version}'`), version);
check('le cache du service worker porte la version',
    worker.includes(`const VERSION = 'architecte-${version}'`), version);

// Chaque identifiant cherche par le code doit exister dans la page : une faute
// de frappe ici ne fait rien planter, elle rend un bouton inerte.
const cherches = new Set();
for (const nom of ['ui.js', 'app.js']) {
    const source = lire(`js/${nom}`);
    for (const [, id] of source.matchAll(/getElementById\('([\w-]+)'\)/g)) cherches.add(id);
    for (const [, id] of source.matchAll(/\$\('([\w-]+)'\)/g)) cherches.add(id);
    for (const [, id] of source.matchAll(/ouvrir\('([\w-]+)'\)/g)) cherches.add(id);
}
const inconnus = [...cherches].filter(id => !page.includes(`id="${id}"`));
check(`les ${cherches.size} identifiants cherches existent dans la page`, inconnus.length === 0, inconnus.join(' '));

// La solution de la machine.
//
// Elle n'est jamais livree : le catalogue ne porte que des nombres, et le fil
// separe refait la recherche a la demande. Le bouton n'apparait qu'une fois le
// budget depense — avant, ce ne serait pas une aide, ce serait la fin du jeu.
check('le fil separe rend le placement, pas seulement la longueur',
    lire('js/solveur-worker.js').includes('murs: trouve.murs'));
check('le fil separe accepte le reglage profond, pour refaire la recherche du catalogue',
    lire('js/solveur-worker.js').includes('REGLAGES_PROFONDS') && cablage.includes("'profonds'"));
check('le bouton de solution part cache', page.includes('id="action-solution" hidden'));
check('le bouton de solution ne s offre qu une fois le budget depense',
    lire('js/ui.js').includes('$(\'action-solution\').hidden = !solutionOfferte')
    && cablage.includes('solutionOfferte: etat.termine'));
check('une partie jouee apres la solution n entre pas au palmares',
    cablage.includes('session.solutionVue ? null : stockage.inscrireRecord'));

// L'attribut hidden ne pese rien face a un display pose par une regle : le
// bandeau de la solution, en display:flex, restait a l'ecran une fois cache.
// Une panne muette, comme les aime ce projet.
check('la feuille de style fait respecter l attribut hidden',
    /\[hidden\] \{ display: none !important; \}/.test(interface_));
const cachesAuDepart = [...page.matchAll(/id="([\w-]+)"[^>]*\shidden/g)].map(([, id]) => id);
check(`les ${cachesAuDepart.length} elements caches au depart le restent`, cachesAuDepart.length >= 2,
    cachesAuDepart.join(' '));

// Mobile d'abord.
check('la page fixe la langue', page.includes('lang="fr"'));
check('la page tient compte des encoches', page.includes('viewport-fit=cover'));
check('la page refuse le zoom du navigateur', page.includes('user-scalable=no'));
check('la page coupe elle-meme le double-tap', lire('js/app.js').includes('interdireDoubleTap(document)'));
check('le plateau ne se selectionne pas au doigt', lire('css/plateau.css').includes('touch-action: manipulation'));

// Le plateau echappe a la regle des 44 px, et il le declare avec sa raison.
// Sans raison ecrite, l'exemption n'en est pas une.
const exemption = page.match(/data-cible-libre="([^"]+)"/);
check('le plateau declare son exemption de cible tactile avec sa raison',
    Boolean(exemption) && exemption[1].length > 30, exemption?.[1] ?? 'absente');

// L'interface, elle, tient la regle : boutons, listes deroulantes, cases.
const cibles = ['.icone', '.action', '.fermer', '.option', '.reglage'];
const tenues = cibles.filter(nom => new RegExp(`\\${nom} \\{[^}]*min-height: 44px`, 's').test(interface_));
check('les cibles tactiles de l interface font 44 px', tenues.length === cibles.length,
    cibles.filter(nom => !tenues.includes(nom)).join(' '));
// Un select natif ignore min-height dans WebKit : il lui faut une hauteur ferme.
check('la liste deroulante a une hauteur ferme, comme WebKit l exige',
    /\.reglage select \{[^}]*height: 44px/s.test(interface_));

// Le defi s'ouvre par la date, la partie libre par sa graine.
check('le defi s ouvre par ?jour=', cablage.includes("parametres.get('jour')"));
check('la partie libre s ouvre par ?seed=', cablage.includes("parametres.get('seed')"));
check('le lien partage ne porte jamais la solution',
    !cablage.includes('murs=' + '${etat') && cablage.includes('?jour=${session.date}'));

// Accessibilite.
check('les animations se retirent sur demande',
    lire('css/plateau.css').includes('prefers-reduced-motion') && interface_.includes('prefers-reduced-motion'));
check('le rendu respecte lui aussi le mouvement reduit',
    lire('js/rendu.js').includes("matchMedia('(prefers-reduced-motion: reduce)')"));
check('la page annonce les coups aux lecteurs d ecran', page.includes('aria-live="polite"'));
check('les cases portent une etiquette', lire('js/rendu.js').includes("setAttribute('aria-label'"));
check('la grille se parcourt aux fleches', lire('js/entree.js').includes('brancherFlechesGrille'));
// Un bouton desactive refuse le focus : les fleches s'arretaient sur le
// premier bloc de beton sans pouvoir le depasser. Le beton reste donc
// atteignable, et seulement inconstructible.
check('le beton n est pas un bouton desactive',
    !lire('js/rendu.js').includes('bouton.disabled') && lire('js/rendu.js').includes("'aria-disabled'"));

// Dialogues et manifeste.
for (const id of ['dialogue-aide', 'dialogue-options', 'dialogue-stats', 'dialogue-fin']) {
    check(`le dialogue ${id} existe`, page.includes(`<dialog id="${id}"`));
}
check('le dialogue des options s appelle Options', page.includes('<h2>Options</h2>'));
check('l aide contient une section clavier', page.includes('Au clavier'));
check('la page declare le manifeste', page.includes('rel="manifest"'));
check('la page declare l icone iOS en PNG', page.includes('apple-touch-icon" href="assets/icon-180.png'));
check('la page charge les trois feuilles de style',
    ['themes', 'plateau', 'interface'].every(nom => page.includes(`css/${nom}.css`)));
check('la page charge app.js en module', page.includes('type="module"') && page.includes('js/app.js'));
check('toutes les icones du manifeste existent',
    manifeste.icons.every(icone => existsSync(join(racine, icone.src))),
    manifeste.icons.map(icone => icone.src).join(' '));
check('le manifeste demarre a la racine relative',
    manifeste.start_url === './' && manifeste.scope === './');
check('le manifeste est en francais et en portrait',
    manifeste.lang === 'fr' && manifeste.orientation === 'portrait');

// Le noyau reste hors du DOM : c'est la contrainte d'architecture la plus
// importante du projet, et elle se verifie en cherchant le mot.
const noyau = ['chemin.js', 'generateur.js', 'partie.js', 'plateau.js', 'solveur.js', 'hasard.js', 'stockage.js'];
const salis = noyau.filter(nom => /document\.|window\.|localStorage\.[gs]etItem/.test(
    lire(`js/${nom}`).replace(/globalThis\.localStorage/g, '')));
check('le noyau ne touche pas au document', salis.length === 0, salis.join(' '));

report();
