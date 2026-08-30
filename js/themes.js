// La liste des themes et leur ordre, rien d'autre.
//
// Les couleurs vivent dans css/themes.css, seule source de verite : ce module
// ne connait que des identifiants, un libelle et la couleur de la barre
// d'adresse du telephone — la seule qu'un navigateur exige en JavaScript.
//
// Le parti pris graphique — le chemin traite comme une ligne de reseau, avec sa
// pastille a chaque virage — ne change pas d'un theme a l'autre. C'est la
// teinte de la ligne qui change, comme on change de ligne sur un plan.

export const THEMES = [
    { id: 'carmin', libelle: 'Carmin', couleur: '#f7f3ea', ligne: '#e2483d' },
    { id: 'menthe', libelle: 'Menthe', couleur: '#f1f5f1', ligne: '#0e8c6a' },
    { id: 'papier', libelle: 'Papier', couleur: '#fbf9f4', ligne: '#6a4cc7' },
    { id: 'encre', libelle: 'Encre', couleur: '#171a21', ligne: '#f2a93b' },
    { id: 'prune', libelle: 'Prune', couleur: '#221a24', ligne: '#f0708f' }
];

export const themeDe = id => THEMES.find(theme => theme.id === id) ?? THEMES[0];

export const themeSuivant = id => THEMES[(THEMES.findIndex(theme => theme.id === id) + 1) % THEMES.length];

export function appliquer(id) {
    const theme = themeDe(id);
    document.documentElement.dataset.theme = theme.id;
    const meta = document.getElementById('couleur-barre');
    if (meta) meta.content = theme.couleur;
    return theme;
}
