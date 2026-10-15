import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { discoverSkills, repoRoot } from './skills.mjs';

const startMarker = '<!-- skills:start -->';
const endMarker = '<!-- skills:end -->';

function escapeCell(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\|/g, '&#124;').replace(/\[/g, '&#91;').replace(/\]/g, '&#93;')
    .replace(/`/g, '&#96;').replace(/\*/g, '&#42;').replace(/_/g, '&#95;')
    .replace(/\\/g, '&#92;');
}

export function renderOverview(skills) {
  return [
    '| Skill | Beskrivelse |',
    '| --- | --- |',
    ...skills.map(({ name, description }) =>
      `| [${name}](./skills/${name}/SKILL.md) | ${escapeCell(description)} |`),
  ].join('\n');
}

export function replaceOverview(readme, overview) {
  const start = readme.indexOf(startMarker);
  const end = readme.indexOf(endMarker);
  if (
    start === -1 || end < start ||
    readme.indexOf(startMarker, start + startMarker.length) !== -1 ||
    readme.indexOf(endMarker, end + endMarker.length) !== -1
  ) {
    throw new Error('README.md må ha nøyaktig ett korrekt ordnet par skills:start/skills:end-markører.');
  }
  return `${readme.slice(0, start + startMarker.length)}\n\n${overview}\n\n${readme.slice(end)}`;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.some((arg) => !['--list', '--check'].includes(arg))) {
    throw new Error('Bruk: node scripts/update-readme.mjs [--list|--check]');
  }
  const overview = renderOverview(await discoverSkills());
  if (args[0] === '--list') {
    console.log(overview);
    return;
  }
  const file = path.join(repoRoot, 'README.md');
  const current = await readFile(file, 'utf8');
  const updated = replaceOverview(current, overview);
  if (args[0] === '--check') {
    if (current !== updated) throw new Error('Skill-oversikten er utdatert. Kjør npm run readme:update.');
    console.log('Skill-oversikten er oppdatert.');
    return;
  }
  if (current !== updated) await writeFile(file, updated);
  console.log(overview);
  console.log('\nREADME.md er oppdatert.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.join(repoRoot, 'scripts/update-readme.mjs')) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
