// Synthese WebAudio : aucun fichier audio, quelques oscillateurs et c'est tout.
//
// Le timbre central est celui de la pose : la hauteur monte avec le detour. Un
// mur qui ne change rien sonne bas, un mur qui rallonge le chemin de six pas
// sonne haut, et on entend le chantier progresser sans regarder les chiffres.
// Les hauteurs suivent une pentatonique mineure : deux poses successives
// tombent toujours juste ensemble.
//
// Deux pieges, tous deux invisibles depuis un ordinateur, tous deux corriges
// ici et tenus par tests/test-son.mjs :
//
//   le plancher de 300 Hz — un haut-parleur de telephone ne restitue a peu pres
//   rien en dessous, et l'oreille y est moins sensible a faible volume ;
//   le deblocage au geste — iOS ne laisse demarrer un contexte audio que depuis
//   un evenement d'activation, d'ou preparerSon().

let contexte;

function audio() {
    if (contexte) return contexte;
    const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (AudioContext) contexte = new AudioContext();
    return contexte;
}

function note(frequence, { duree = 0.09, volume = 0.03, delai = 0, forme = 'triangle', vers = null } = {}) {
    const moteur = audio();
    if (!moteur) return;
    if (moteur.state === 'suspended') moteur.resume?.();

    const debut = moteur.currentTime + delai;
    const oscillateur = moteur.createOscillator();
    const gain = moteur.createGain();

    oscillateur.type = forme;
    oscillateur.frequency.setValueAtTime(frequence, debut);
    if (vers) oscillateur.frequency.exponentialRampToValueAtTime(vers, debut + duree);

    gain.gain.setValueAtTime(0.0001, debut);
    gain.gain.exponentialRampToValueAtTime(volume, debut + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, debut + duree);

    oscillateur.connect(gain).connect(moteur.destination);
    oscillateur.start(debut);
    oscillateur.stop(debut + duree + 0.02);
}

const PENTATONIQUE = [0, 3, 5, 7, 10];

// La fondamentale : mi 4. Toute l'echelle du jeu vit au-dessus, plancher de
// 300 Hz compris. Une note ecrite plus bas n'existerait pas sur la cible du
// projet — un telephone tenu a la main.
export const FONDAMENTALE = 330;
export const PLANCHER = 300;

// Le degre monte avec l'avancee du detour : la part du chemin gagnee par
// rapport au depart, rapportee au meilleur connu quand il existe.
export function hauteurDe(degre) {
    const rang = Math.max(0, Math.min(14, Math.round(degre)));
    const demiTons = 12 * Math.floor(rang / PENTATONIQUE.length) + PENTATONIQUE[rang % PENTATONIQUE.length];
    return FONDAMENTALE * 2 ** (demiTons / 12);
}

export function degreDe({ longueur, depart, meilleurConnu }) {
    const gagne = Math.max(0, longueur - depart);
    const marge = meilleurConnu && meilleurConnu > depart ? meilleurConnu - depart : Math.max(1, depart * 2);
    return Math.min(12, (gagne / marge) * 12);
}

export const sonPose = degre => note(hauteurDe(degre), { duree: 0.11, volume: 0.04 });

// Retirer : la meme note, un ton plus bas et qui redescend. L'inverse d'une
// pose, sans changer de langue.
export const sonRetrait = degre => note(hauteurDe(degre) * 0.89, { duree: 0.13, volume: 0.03, vers: FONDAMENTALE, forme: 'sine' });

// Le refus : un toc court qui descend, trop bref pour deranger. Il ne descend
// pas plus bas que le plancher.
export const sonRefus = () => note(440, { duree: 0.06, volume: 0.024, vers: PLANCHER + 20, forme: 'sine' });

// Le budget epuise : deux notes, sans insister.
export function sonFin() {
    note(523, { duree: 0.18, volume: 0.032, forme: 'sine' });
    note(392, { duree: 0.3, volume: 0.032, delai: 0.16, forme: 'sine' });
}

// La machine battue : la seule fanfare du jeu. Elle ne se declenche qu'une fois
// par partie, et c'est la meilleure chose qui puisse arriver au joueur.
export function sonExploit() {
    [523, 659, 784, 1047, 1319].forEach((frequence, rang) =>
        note(frequence, { duree: 0.22, volume: 0.042, delai: rang * 0.085, forme: 'sine' }));
}

// L'egalite avec la machine : trois notes, plus sobres que la fanfare.
export function sonEgalite() {
    [523, 784, 1047].forEach((frequence, rang) =>
        note(frequence, { duree: 0.2, volume: 0.036, delai: rang * 0.1, forme: 'sine' }));
}

const ACTIVATIONS = ['pointerdown', 'touchstart', 'pointerup', 'touchend', 'keydown', 'click'];

// Le contexte se prepare au premier geste, avant meme que le jeu ait une note a
// demander : sur iOS, un contexte cree ailleurs qu'au cours d'une activation
// nait suspendu et ne repart jamais.
export function preparerSon(cible, autorise = () => true) {
    const reveiller = () => {
        if (!autorise()) return;
        const moteur = audio();
        if (moteur && moteur.state !== 'running') moteur.resume?.();
    };
    for (const activation of ACTIVATIONS) {
        cible.addEventListener(activation, reveiller, { capture: true, passive: true });
    }
}

export function surveillerVisibilite(document) {
    document.addEventListener('visibilitychange', () => {
        if (!contexte) return;
        if (document.hidden) contexte.suspend?.();
        else contexte.resume?.();
    });
}
