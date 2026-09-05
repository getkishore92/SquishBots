# Contributing

Install dependencies, fetch Satoshi with `npm run setup:fonts`, and follow the local setup in the README.

Before opening a pull request, run `npm test`, `npm run typecheck`, and `npm run build`. For renderer or API changes, install Blender and run `npm run test:api` as well. Check visible changes at desktop and mobile sizes, in both themes.

Keep avatar geometry consistent between the browser and Blender. Add reproducible configs when changing shapes or materials. Preserve the upstream copyright and license notices, and describe local changes to vendored code in CREDITS.md.

Do not commit generated renders, Blender files, node_modules, font binaries, or local environment files. Satoshi must be obtained from Fontshare using the setup command.
