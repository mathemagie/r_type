# R-TYPELIKE — Neon Drift

Un shoot-'em-up horizontal façon **R-Type**, écrit en **HTML5 Canvas + JavaScript pur,
sans aucune dépendance**. Aucun build, aucun npm, aucun asset binaire : sprites et sons
sont générés *procéduralement* en JavaScript.

> Le retour du Bydo. Une seule chance.

## Lancer le jeu

Le jeu doit être servi en HTTP (Chrome/Edge bloquent le chargement des scripts en
`file://`). Il faut **Python 3** installé.

```bash
make run            # ouvre le navigateur + démarre le serveur sur le port 8765
# ou
make serve          # démarre le serveur, puis ouvrir http://localhost:8765
```

Sans `make` :

```bash
./lancer.sh                     # macOS / Linux
python3 -m http.server 8765     # puis ouvrir http://localhost:8765
```

## Contrôles

| Touche | Action |
|---|---|
| Flèches / WASD | Déplacement du vaisseau |
| Z (ou Espace) | Tir — **maintenir** pour charger le BEAM |
| Shift | Force Pod (lancer / rappeler) |
| X | Smart Bomb (×2 au départ) |
| Entrée | Démarrer / Rejouer |
| R | Rejouer après la mort |
| P | Pause · M | Mute |

## Astuces

- Le **BEAM** chargé transperce tout et inflige des dégâts massifs au boss.
- Frôler une balle ennemie (< 12 px) déclenche un ralenti et **+1 combo**.
- Le Force Pod absorbe les balles ennemies quand il est près du vaisseau.
- Combo élevé = multiplicateur de score (×1 à ×8).
- Les bombes nettoient l'écran et infligent des dégâts à tout le monde.

Un run dure ~3 min 45 s avant le boss final (**BYDO PRIME**), puis un combat en 3 phases.

### Rangs

| Rang | Score |
|---|---|
| D | < 12 000 |
| C | 12 000 – 19 999 |
| B | 20 000 – 27 999 |
| A | 28 000 – 35 999 |
| S | 36 000 – 49 999 |
| SS | 50 000+ |

## Architecture

`index.html` charge chaque module `js/*.js` via des balises `<script>` dans l'ordre des
dépendances (`main.js` en dernier). Chaque fichier est une **IIFE** assignée à un global
(`Game`, `Player`, `Enemies`, `Boss`, `Bullets`, `Particles`, `Background`, `Level1`,
`FX`, `Input`, `Audio`) — il n'y a pas de système de modules. `main.js` contient la
boucle de jeu et la machine à états (`TITLE → PLAY → GAMEOVER | WIN | PAUSE`).

Résolution interne fixe : **800×450**. Voir [`CLAUDE.md`](CLAUDE.md) pour le détail des
modules et des conventions.

## Tâches (Makefile)

```
make serve     Démarre le serveur HTTP local (port 8765, surchargeable : PORT=9000)
make run       Ouvre le navigateur puis démarre le serveur
make open      Ouvre l'URL dans le navigateur (serveur déjà lancé)
make package   Reconstruit R-TYPELIKE.zip
make clean     Supprime les artefacts (zip, dossier extrait, .DS_Store)
```

## Licence

Code source 100 % maison. Sprites et sons générés procéduralement (aucun asset binaire).
