// Harnais commun aux tests. Tout le noyau du jeu — chemin, generation,
// solveur, partie — se teste en Node, sans navigateur : c'est la contrainte
// d'architecture la plus importante du projet.

export function counter() {
    const etat = { pass: 0, fail: 0 };
    const check = (libelle, condition, detail = '') => {
        if (condition) { etat.pass++; console.log(`  OK    ${libelle}`); }
        else { etat.fail++; console.log(`  ECHEC ${libelle} ${detail}`); }
    };
    const report = () => {
        console.log(`\n${etat.pass} reussis, ${etat.fail} echecs\n`);
        process.exit(etat.fail === 0 ? 0 : 1);
    };
    return { check, report };
}

// Un plateau ecrit a la main. Une grille lue en entiers ne se relit pas, et un
// test qu'on ne relit pas ne se corrige pas.
//
//   .  case libre        #  obstacle
//   E  entree            S  sortie          de la premiere liaison
//   e  entree            s  sortie          de la seconde  (variante Double ligne)
//   1 2 3                stations a desservir dans cet ordre (variante Stations)
export function plateauDessine(texte) {
    const lignesTexte = texte.trim().split('\n').map(ligne => ligne.trim().split(/\s+/));
    const lignes = lignesTexte.length;
    const colonnes = lignesTexte[0].length;
    const cases = new Uint8Array(lignes * colonnes);
    const reperes = {};
    const stations = [];

    lignesTexte.forEach((ligne, l) => {
        ligne.forEach((signe, c) => {
            const i = l * colonnes + c;
            if (signe === '#') cases[i] = 1;
            else if (/^[1-9]$/.test(signe)) stations[Number(signe) - 1] = i;
            else if (signe !== '.') reperes[signe] = i;
        });
    });

    const liaisons = [{ entree: reperes.E, sortie: reperes.S, stations: stations.filter(i => i !== undefined) }];
    if (reperes.e !== undefined) liaisons.push({ entree: reperes.e, sortie: reperes.s, stations: [] });

    return { lignes, colonnes, liaisons, cases };
}
