# Credits and licenses

SquishBots translates Blobatar's avatar system into configurable 3D objects, with Blender rendering and an interactive web editor.

- **[Blobatar](https://github.com/Alain00/blobatar) by Alain** supplies seeded generation, original silhouettes, traits, palettes, expressions and motion mathematics. The resolver includes source from version 2.7.0, commit `ebb7ea4808b1263629fc8fa65e2398b9cbdb6f6b`; the browser motion helper is derived from it. The vendored shape modules include local Ghost/Monster additions and updated selection bands; the commit identifies the upstream baseline. Copyright © 2026 Alain. The original [MIT license](docs/UPSTREAM-LICENSE) is retained, including alongside vendored code.
- **[Bloub](https://github.com/jeremy-prt/bloub) by Jérémy Perret** inspired the open-stage editor and interaction direction. Reviewed at commit `b4bb3c1b5f93c7b87a2e8d620f667c4093d97749`. SquishBots adds its own 3D dragging behavior. Copyright © 2026 Jérémy Perret. The [upstream MIT notice](docs/BLOUB-LICENSE) is retained.
- **[Three.js](https://threejs.org/)** renders the browser preview. Its MIT notice ships with the dependency.
- **[Blender](https://www.blender.org/)** constructs and renders final scenes. Blender is installed separately and retains its own license.
- **[React](https://react.dev/), [shadcn/ui](https://ui.shadcn.com/), [Radix UI](https://www.radix-ui.com/) and [Tailwind CSS](https://tailwindcss.com/)** provide the configurator framework, shared controls and styling. Their dependency notices remain in their respective packages.
- **[Phosphor Icons](https://phosphoricons.com/)** provides interface icons through `@phosphor-icons/react`.
- **[Satoshi by Indian Type Foundry](https://www.fontshare.com/fonts/satoshi)** provides interface typography under the [ITF Free Font License](frontend/src/assets/fonts/FFL.txt). Run `npm run setup:fonts` to obtain unmodified font files directly from Fontshare for your local build. Font binaries are excluded from this source repository. They retain their separate license and are not covered by the project MIT license. SquishBots uses Satoshi for its interface; it does not offer the font as an avatar customization option.
- **[FFmpeg](https://ffmpeg.org/)** converts preview recordings to GIF and MP4. It is installed separately; its license depends on the selected build.

Original SquishBots code is copyright © 2026 Kishore Sundarajan under the [MIT license](LICENSE). Third-party source and assets retain their original ownership and licenses. The upstream authors do not endorse this project.
