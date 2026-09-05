Vendored from https://github.com/Alain00/blobatar, commit ebb7ea4808b1263629fc8fa65e2398b9cbdb6f6b, package blobatar 2.7.0.

The 12 TypeScript files in blobatar/ are the dependency closure of src/blobatar.ts and src/expression.ts. Source behavior is unchanged. Relative imports have explicit .ts extensions added for Node's native TypeScript stripping. The original MIT license is included at blobatar/LICENSE. Keep this attribution in distributions.

The renderer uses internal _marks/_layout interfaces, so upgrades require reviewing changes and re-running geometry/visual comparisons. Do not replace these with an independently seeded approximation.
