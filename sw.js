// Service worker : le jeu doit s'ouvrir dans le metro.
//
// Reseau d'abord, cache en secours. Le cache garde une copie complete du jeu,
// mais il ne passe devant que lorsque le reseau ne repond pas : une version
// publiee arrive ainsi chez le joueur sans qu'il ait rien a faire, et le jeu
// s'ouvre quand meme dans un tunnel.
//
// L'ordre inverse — le cache d'abord — coutait deux ennuis. Le joueur restait
// sur l'ancienne version tant qu'il ne vidait pas son navigateur ; et en
// developpement local, tous les jeux servant sur la meme machine, le service
// worker de l'un finissait par servir ses propres fichiers aux autres.
//
// La coquille liste tout, solveur et catalogue compris : hors ligne, une partie
// libre a besoin du solveur pour afficher son troisieme chiffre, et le defi du
// jour a besoin du catalogue pour afficher le sien.

const VERSION = 'architecte-1.2.0';

const COQUILLE = [
    './',
    'index.html',
    'manifest.webmanifest',
    'css/themes.css',
    'css/plateau.css',
    'css/interface.css',
    'js/app.js',
    'js/chemin.js',
    'js/defi.js',
    'js/entree.js',
    'js/generateur.js',
    'js/hasard.js',
    'js/partie.js',
    'js/plateau.js',
    'js/recherche.js',
    'js/rendu.js',
    'js/solveur.js',
    'js/solveur-worker.js',
    'js/son.js',
    'js/stockage.js',
    'js/themes.js',
    'js/ui.js',
    'js/variantes.js',
    'data/defis.json',
    'assets/icon.svg',
    'assets/icon-180.png',
    'assets/icon-192.png',
    'assets/icon-512.png'
];

self.addEventListener('install', evenement => {
    evenement.waitUntil(
        caches.open(VERSION)
            .then(cache => cache.addAll(COQUILLE))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', evenement => {
    evenement.waitUntil(
        caches.keys()
            .then(noms => Promise.all(noms.filter(nom => nom.startsWith('architecte-') && nom !== VERSION).map(nom => caches.delete(nom))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', evenement => {
    if (evenement.request.method !== 'GET') return;

    evenement.respondWith(
        fetch(evenement.request)
            .then(reponse => {
                // On ne garde que ce qui vient de chez nous et qui a abouti :
                // une erreur mise en cache serait servie indefiniment.
                if (reponse.ok && new URL(evenement.request.url).origin === location.origin) {
                    const copie = reponse.clone();
                    caches.open(VERSION).then(cache => cache.put(evenement.request, copie));
                }
                return reponse;
            })
            // Hors ligne : la copie connue, et a defaut la page d'accueil — une
            // adresse profonde vaut mieux servie que refusee.
            .catch(() => caches.match(evenement.request).then(connu => connu || caches.match('./')))
    );
});
