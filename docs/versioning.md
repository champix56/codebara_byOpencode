# Versions et notes de version

## Règle constante

**Toute modification d'un fichier du projet qui n'est pas un `.md` incrémente la version.** Une modification uniquement Markdown (documentation, notes, index) ne déclenche **pas** de bump.

La version est un numéro `0.0.x` partagé entre le client et le serveur ; on incrémente le dernier chiffre (`0.0.16` → `0.0.17`), sans sauter de numéro.

## Client (ce dépôt)

1. Ajouter **en haut** de [`NOTES-VERSION.md`](../NOTES-VERSION.md) une section `## v0.0.x+1` avec une à quelques lignes en français décrivant le changement pour l'utilisateur.
2. Régénérer la source TypeScript : `npm run maj:notes` (script `scripts/maj-notes-version.mjs`). **Ne pas éditer `src/data/notes-version.ts` à la main** : il est généré depuis le `.md`.
3. `VERSION_APPLI` (première section du `.md`) est affiché dans la principale (sous le bandeau) et dans la connexion ; la fenêtre notes de version liste les sections.
4. Mettre à jour les références de version dans les docs écrans concernées (`docs/screens/*.md` et leur index) si le changement est visible à l'écran.
5. La release GitHub se crée ensuite avec `npm run release` : le tag porte la version courante et les artefacts sont nommés `codebara.<version>.apk` / `codebara.<version>.web.zip` (procédure dans [`development.md`](./development.md)).

## Serveur (`pyCodebara2`)

- Une modification de code serveur qui change le schéma MySQL donne lieu à une migration nommée `migration_bdd.<version>.py` avec la même version que le client.
- Le contrat client/serveur est journalisé dans `docs/integration-client.md` (copie conforme dans les deux dépôts).
- Aucune migration sans accord préalable sur une base vivante (`cdb`) : voir `AGENTS.md` du dépôt serveur.

## À ne pas faire

- Ne pas incrémenter seulement « à la fin » : le bump fait partie de la modification, même pour un correctif d'une ligne.
- Ne pas modifier `NOTES-VERSION.md` sans relancer `npm run maj:notes`.
- Ne pas lancer de build pour « vérifier » le bump : l'utilisateur build quand il le souhaite (voir [`development.md`](./development.md)).
