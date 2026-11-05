# AntSim

Simulation contemplative d'une colonie de *Lasius niger* (fourmi noire des jardins) dans le navigateur, en 2D : jardin vu de dessus en haut, coupe du nid en bas. Pensée pour tourner sur un écran annexe pendant qu'on travaille.

- Une reine fonde, se cloître, élève ses premières ouvrières naines ; la colonie creuse, fourrage, grandit, passe l'hiver, essaime.
- Interactions rares, en glisser-déposer : sucre, proie, eau, plante à pucerons, pierre, radiateur, reine noire ou rouge (*Myrmica rubra*).
- 1 jour de jeu = 1 heure réelle à ×1. Accélération ×10, ×60, et « sauter l'hiver ». Pause quand l'onglet est caché, sauvegarde locale automatique.
- Fourmis colorées par rôle (reine, nourrice, ouvrière du nid, fourrageuse, ailés), compteur discret en bas à droite.

Dossier biologique et choix de l'espèce : [docs/biologie.md](docs/biologie.md). Les constantes (durées, climat, nourriture) sont dans `src/config.ts` ; `BIO_SPEED` divise les durées réelles (5 par défaut).

```bash
npm install
npm run dev        # http://localhost:5173
npm run check      # auto-vérification de la simulation (Node 24, sans dépendance)
npm run typecheck
```

Vite + TypeScript + Canvas 2D, aucune dépendance à l'exécution.

Site : https://jeroux.github.io/antsim/ (branche `gh-pages`, construite avec `vite build --base=/antsim/`). Le déploiement automatique par Action est dans `.github/workflows/pages.yml`, à pousser dès que le jeton GitHub a la portée `workflow`.
