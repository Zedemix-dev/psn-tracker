# PSN Tracker : instructions pour Claude

**Au début de chaque conversation, lis `docs/ETAT-DU-PROJET.md`.** Il dit ce qui est fait, ce qui reste à faire, et le processus à suivre.

## Comment travailler ici
- **Langues** : l'utilisateur échange en **français**. L'interface du site est en **anglais**, et le code comme les messages de commit aussi.
- **Toute nouvelle page ou fonctionnalité** suit le processus superpowers :
  1. brainstorming, avec des maquettes montrées dans le navigateur de l'app ;
  2. une spec dans `docs/superpowers/specs/` ;
  3. un plan dans `docs/superpowers/plans/` ;
  4. l'exécution « subagent-driven » sur une branche `feat/<sujet>` ;
  5. une vérification avec les vraies données en local ;
  6. une relecture finale de la branche ;
  7. une Pull Request vers `main`, que l'utilisateur crée et fusionne lui-même sur GitHub.
- **Rien n'est construit** avant que la maquette ou la description ait été validée par l'utilisateur.
- **Après chaque commit, push** : l'utilisateur change souvent de PC.
- **La spec est l'autorité** : `docs/superpowers/specs/2026-11-07-psn-tracker-design.md`. Toute nouvelle décision de l'utilisateur y est reportée.
- **En cas de doute sur la présentation** d'un élément, demande une capture d'écran de psnprofiles ou pocketpsn plutôt que de deviner.
- **Le vrai NPSSO** n'est jamais saisi par Claude : c'est l'utilisateur qui le colle dans Settings.

## Environnement
- Windows. Node peut ne pas être dans le PATH. Sur le PC d'origine :
  - Git Bash : `export PATH="/c/Program Files/nodejs:$PATH"` ;
  - PowerShell : recharger `$env:Path` depuis Machine + User.
- Le chemin du dépôt peut contenir `!` (`...\!Perso\tracker`) : le mettre entre apostrophes en bash.
- `gh` et Docker ne sont pas installés : la CI se vérifie sur github.com (le dépôt est public depuis le 13 novembre 2026).
- Next.js 16 : lire `AGENTS.md` (généré par `next dev`), et les guides dans `node_modules/next/dist/docs/` avant d'écrire du code Next.
- Tests : `npx vitest run` (PGlite en mémoire) et `npx tsc --noEmit`. Tests en local avec les vraies données : `npm run e2e:*` (voir `docs/ETAT-DU-PROJET.md`, section 5).
