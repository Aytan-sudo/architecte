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
//   . case libre      # obstacle      E entree      S sortie
export function plateauDessine(texte) {
    const lignesTexte = texte.trim().split('\n').map(ligne => ligne.trim().split(/\s+/));
    const lignes = lignesTexte.length;
    const colonnes = lignesTexte[0].length;
    const cases = new Uint8Array(lignes * colonnes);
    let entree = -1;
    let sortie = -1;

    lignesTexte.forEach((ligne, l) => {
        ligne.forEach((signe, c) => {
            const i = l * colonnes + c;
            if (signe === '#') cases[i] = 1;
            if (signe === 'E') entree = i;
            if (signe === 'S') sortie = i;
        });
    });

    return { lignes, colonnes, entree, sortie, cases };
}
