// Les variantes : des drapeaux, et rien d'autre.
//
// Le moteur ne les connait pas — il ne sait que resoudre des liaisons. Ce
// module dit seulement comment peupler ce modele, quelles combinaisons ont un
// sens, et comment une variante voyage dans une adresse.

import { counter } from './harness.mjs';
import {
    VARIANTES, varianteDe, disponible, configurationDeGeneration,
    budgetsPour, retenues, cleVariantes, libelleVariantes, versTexte, depuisTexte
} from '../js/variantes.js';
import { cleConfiguration } from '../js/stockage.js';

const { check, report } = counter();
console.log('\nVariantes\n');

check('les deux variantes existent', VARIANTES.length === 2 && varianteDe('stations') && varianteDe('double'));
check('une variante inconnue ne rend rien', varianteDe('teleporteur') === null);

// La double ligne demande la place de se croiser : sous 16x16, deux liaisons
// donnent deux petits chemins au lieu d'un beau.
check('la double ligne s offre a partir de 16x16',
    !disponible(varianteDe('double'), 12) && disponible(varianteDe('double'), 16));
check('les stations s offrent des 10x10',
    !disponible(varianteDe('stations'), 8) && disponible(varianteDe('stations'), 10));
check('une variante que la taille n autorise plus se retire d elle-meme',
    retenues(['double', 'stations'], 12).join(',') === 'stations',
    retenues(['double', 'stations'], 12).join(','));

// Ce que la generation recoit : le canonique reste exactement ce qu'il etait.
const canonique = configurationDeGeneration({ taille: 12, murs: 12, variantes: [] });
check('le canonique ne demande ni station ni seconde ligne',
    canonique.stations === 0 && canonique.doubleLigne === false);
check('la variante Stations demande trois stations',
    configurationDeGeneration({ taille: 12, murs: 12, variantes: ['stations'] }).stations === 3);
check('la variante Double ligne demande deux liaisons',
    configurationDeGeneration({ taille: 16, murs: 24, variantes: ['double'] }).doubleLigne === true);
// Trois stations sur chacune de deux lignes noieraient le plateau.
const ensemble = configurationDeGeneration({ taille: 16, murs: 24, variantes: ['double', 'stations'] });
check('les deux ensemble reduisent le nombre de stations',
    ensemble.doubleLigne === true && ensemble.stations === 2, String(ensemble.stations));

// Un mur sert rarement deux lignes a la fois.
check('la double ligne ouvre une bourse plus large',
    budgetsPour(16, ['double']).join('/') === '16/24/32', budgetsPour(16, ['double']).join('/'));
check('le canonique garde sa bourse',
    budgetsPour(12, []).join('/') === '6/12/18', budgetsPour(12, []).join('/'));

// Les records : le canonique ne porte aucune trace de variante, pour que les
// palmares deja inscrits restent les leurs.
check('le canonique garde sa cle d origine',
    cleConfiguration({ mode: 'libre', lignes: 12, colonnes: 12, murs: 12 }) === 'libre:12x12:12');
check('une variante a son propre palmares',
    cleConfiguration({ mode: 'libre', lignes: 16, colonnes: 16, murs: 24, variantes: ['double'] })
    === 'libre:16x16:24:double');
check('l ordre des variantes ne change pas la cle',
    cleConfiguration({ mode: 'libre', lignes: 16, colonnes: 16, murs: 24, variantes: ['stations', 'double'] })
    === cleConfiguration({ mode: 'libre', lignes: 16, colonnes: 16, murs: 24, variantes: ['double', 'stations'] }));
check('cleVariantes suit la meme regle', cleVariantes([]) === '' && cleVariantes(['double']) === ':double');

// Le separateur d'adresse. Dans une chaine de requete, un `+` se decode en
// espace : `?v=double+stations` arrivait comme une seule variante nommee
// « double stations », et la partie repartait en canonique sans rien dire.
check('le lien partage separe par des virgules', versTexte(['double', 'stations']) === 'double,stations');
check('la virgule se relit', depuisTexte('double,stations').join(',') === 'double,stations');
check('un ancien lien en plus se relit encore', depuisTexte('double+stations').join(',') === 'double,stations');
check('un plus decode en espace se relit aussi', depuisTexte('double stations').join(',') === 'double,stations');
check('une adresse vide ne rend aucune variante',
    depuisTexte('').length === 0 && depuisTexte(null).length === 0);
check('une variante inventee dans l adresse est ignoree', depuisTexte('double,dragon').join(',') === 'double');

check('le libelle nomme les variantes',
    libelleVariantes([]) === 'Canonique' && libelleVariantes(['double', 'stations']) === 'Stations + Double ligne');

report();
