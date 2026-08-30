// Les palettes.
//
// Une variable oubliee dans un theme ne leve aucune erreur : elle laisse une
// couleur claire au milieu d'un theme sombre, et on ne s'en apercoit qu'en
// jouant de nuit. Chaque palette est donc comparee, variable par variable, a
// celle de reference.

import { readFileSync } from 'node:fs';
import { counter } from './harness.mjs';
import { THEMES } from '../js/themes.js';

const { check, report } = counter();
console.log('\nThemes\n');

const lire = chemin => readFileSync(new URL(`../${chemin}`, import.meta.url), 'utf8');
const themesCss = lire('css/themes.css');

// Les blocs de la feuille : selecteur -> variables definies.
const blocs = new Map();
for (const [, entete, corps] of themesCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const variables = new Set([...corps.matchAll(/(--[\w-]+)\s*:/g)].map(([, nom]) => nom));
    for (const [, id] of entete.matchAll(/\[data-theme="(\w+)"\]/g)) {
        blocs.set(id, new Set([...(blocs.get(id) ?? []), ...variables]));
    }
}

const reference = blocs.get('carmin');
check('la palette de reference existe', Boolean(reference) && reference.size > 15, String(reference?.size));

for (const theme of THEMES) {
    const palette = blocs.get(theme.id);
    if (!palette) {
        check(`le theme ${theme.id} a un bloc de couleurs`, false);
        continue;
    }
    const manquantes = [...reference].filter(nom => !palette.has(nom));
    const surplus = [...palette].filter(nom => !reference.has(nom));
    check(`le theme ${theme.id} definit les ${reference.size} variables de la reference`,
        manquantes.length === 0, manquantes.join(' '));
    check(`le theme ${theme.id} n en invente aucune`, surplus.length === 0, surplus.join(' '));
}

check('la feuille ne definit pas de theme inconnu de themes.js',
    [...blocs.keys()].every(id => THEMES.some(theme => theme.id === id)), [...blocs.keys()].join(' '));
check('il y a de quatre a six palettes', THEMES.length >= 4 && THEMES.length <= 6, String(THEMES.length));
check('les palettes melangent le clair et le sombre',
    THEMES.some(theme => theme.couleur > '#800000') && THEMES.some(theme => theme.couleur < '#800000'));

// Les couleurs vivent dans themes.css, et nulle part ailleurs. Une couleur
// ecrite en dur dans plateau.css echapperait aux themes sans rien casser.
for (const feuille of ['css/plateau.css', 'css/interface.css']) {
    const source = lire(feuille);
    const durs = [...source.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map(([valeur]) => valeur);
    const rgba = [...source.matchAll(/rgba?\([^)]*\)/g)].map(([valeur]) => valeur);
    check(`${feuille} n ecrit aucune couleur en dur`, durs.length === 0 && rgba.length === 0,
        [...durs, ...rgba].join(' '));
}

// Le script d'entete double la liste des themes pour poser la couleur avant le
// premier pixel. C'est la seule copie autorisee, et elle doit suivre.
const page = lire('index.html');
const entete = page.slice(0, page.indexOf('</head>'));
const dansLaPage = Object.fromEntries(
    [...entete.matchAll(/(\w+): '(#[0-9a-f]{6})'/g)].map(([, id, couleur]) => [id, couleur]));
const dansLeModule = Object.fromEntries(THEMES.map(theme => [theme.id, theme.couleur]));
check('les themes de l entete et ceux de themes.js s accordent',
    Object.keys(dansLaPage).length === THEMES.length
    && JSON.stringify(dansLaPage) === JSON.stringify(dansLeModule),
    `${JSON.stringify(dansLaPage)} vs ${JSON.stringify(dansLeModule)}`);

check('le theme se pose avant le premier rendu',
    entete.includes('<script>') && entete.includes('architecte.preferences')
    && entete.includes('documentElement.dataset.theme'));
check('la barre d adresse suit la palette',
    page.includes('id="couleur-barre"') && lire('js/themes.js').includes("getElementById('couleur-barre')"));

// La couleur de barre annoncee par l'entete doit etre celle du fond du theme,
// sinon le bandeau du telephone jure avec la page.
const fonds = Object.fromEntries([...themesCss.matchAll(/\[data-theme="(\w+)"\][^{]*\{([^{}]*)\}/g)]
    .map(([, id, corps]) => [id, corps.match(/--fond:\s*(#[0-9a-f]{6})/)?.[1]]));
const accordes = THEMES.filter(theme => fonds[theme.id] === theme.couleur);
check('chaque theme annonce la couleur de son fond', accordes.length === THEMES.length,
    THEMES.map(theme => `${theme.id}:${theme.couleur}/${fonds[theme.id]}`).join(' '));

report();
