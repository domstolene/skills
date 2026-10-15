import { lstat, realpath, unlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { discoverSkills } from './skills.mjs';
import { selectSkills } from './install-skills.mjs';

const skillDirectories = ['.agent', '.copilot'];

async function pointsToSkill(link, skill) {
  let entry;
  try {
    entry = await lstat(link);
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
  if (!entry.isSymbolicLink()) return false;

  try {
    return await realpath(link) === await realpath(skill.source);
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

export async function discoverInstalledSkills(skills, { home = homedir() } = {}) {
  const destinations = skillDirectories.map((directory) =>
    path.join(home, directory, 'skills'),
  );
  const installed = [];

  for (const skill of skills) {
    for (const destination of destinations) {
      if (await pointsToSkill(path.join(destination, skill.name), skill)) {
        installed.push(skill);
        break;
      }
    }
  }

  return installed;
}

export async function removeSelectedSkills(skills, { home = homedir() } = {}) {
  const destinations = skillDirectories.map((directory) =>
    path.join(home, directory, 'skills'),
  );
  const results = [];

  for (const skill of new Set(skills)) {
    for (const destination of destinations) {
      const link = path.join(destination, skill.name);
      if (!(await pointsToSkill(link, skill))) continue;
      await unlink(link);
      results.push(`Fjernet: ${skill.name} fra ${destination}`);
    }
  }

  return results;
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === '--') args.shift();
  if (args.length === 1 && args[0] === '--help') {
    console.log('Bruk: pnpm skills:remove [--all | --list | skill-navn ...]\nUten argumenter: velg installerte skills i en nummerert meny.');
    return;
  }
  if (args.some((arg) => arg.startsWith('-')) &&
      !(args.length === 1 && ['--all', '--list'].includes(args[0]))) {
    throw new Error('Ugyldige argumenter. Bruk --help for hjelp.');
  }

  const skills = await discoverInstalledSkills(await discoverSkills());
  if (skills.length === 0) {
    if (args.length > 0 && !['--all', '--list'].includes(args[0])) {
      throw new Error(`Ukjent installert skill: ${args[0]}. Ingen skills ble fjernet.`);
    }
    console.log('Fant ingen installerte skills i .agent/skills eller .copilot/skills.');
    return;
  }
  if (args.length === 0 || args[0] === '--list') {
    skills.forEach((skill, index) =>
      console.log(`${index + 1}. ${skill.name} — ${skill.description}`),
    );
  }
  if (args[0] === '--list') return;

  let selected;
  if (args.length === 0) {
    const readline = createInterface({ input: process.stdin, output: process.stdout });
    try {
      const answer = await readline.question('\nVelg nummer/navn (flere med komma), «alle», eller Enter for å avbryte: ');
      if (!answer.trim()) {
        console.log('Avbrutt. Ingen skills ble fjernet.');
        return;
      }
      selected = selectSkills(answer, skills);
    } finally {
      readline.close();
    }
  } else if (args[0] === '--all') {
    selected = skills;
  } else {
    selected = args.map((name) => {
      const skill = skills.find((candidate) => candidate.name === name);
      if (!skill) throw new Error(`Ukjent installert skill: ${name}. Ingen skills ble fjernet.`);
      return skill;
    });
  }

  const results = await removeSelectedSkills(selected);
  for (const result of results) console.log(result);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Fjerning feilet: ${error.message}`);
    process.exitCode = 1;
  });
}
