// Solmar Heat: the handoff.
//
// This file is the entrypoint. The grader runs it twice inside a fresh,
// network-less container where the repository is mounted read-only and
// /output is the only writable directory, and both runs must lay out
// exactly the same bytes: the game, its screenshots, and the dossier the
// kit library derives from them. Outside the grader, MAKEFUN_OUTPUT_DIR
// stands in for /output, so the same file can be run locally and its
// output inspected.

import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// Where this file lives is the repository root, whatever working directory
// the grader happens to invoke it from.
const repositoryRoot = dirname(fileURLToPath(import.meta.url));

// The one writable directory: the grader's /output, or the override used
// for a local run.
const outputRoot = process.env.MAKEFUN_OUTPUT_DIR || '/output';

// The gate's own limits, so this program refuses exactly where the scorer
// would: the dossier text cap, the screenshot count and size caps, and the
// game tree caps.
const dossierLimits = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

// Stage one directory of the repository into the output. Any previous copy
// is cleared first, so a re-run over a used directory cannot leave stale
// files behind: the output always mirrors the repository exactly.
function stageDirectory(name: string): void {
  const destination = join(outputRoot, name);
  rmSync(destination, { recursive: true, force: true });
  cpSync(join(repositoryRoot, name), destination, { recursive: true });
}

mkdirSync(outputRoot, { recursive: true });
stageDirectory('game');
stageDirectory('screenshots');

const dossier = buildDossier(outputRoot, dossierLimits);
writeFileSync(join(outputRoot, 'dossier.json'), dossier);
console.log(`Solmar Heat handed in: ${dossier.length} dossier bytes in ${outputRoot}`);
