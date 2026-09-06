# SquishBots release version

- `package.json` is the app version source. Vite injects it into the footer at build time.
- After the initial 0.1.0 release, before each authorized push containing app changes, bump the patch version once with `npm run version:patch`. This updates both package files without creating a commit or tag. Do not bump again when retrying the same push.
- Use a minor or major bump only when the user requests that release scope.
- Include the version update in the same commit as the changes. Run `npm test`, `npm run typecheck`, and `npm run build`; check the rendered footer before pushing.
- Push only when the user authorizes it. After pushing, fetch and verify local and remote main match.
