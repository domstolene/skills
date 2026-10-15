import { lstat, mkdir, realpath, symlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { discoverSkills } from './skills.mjs';

export function selectSkills(input, skills) {
  const choices = input.trim().split(/[,\s]+/);
  if (choices.length === 1 && choices[0] === 'alle') return skills;
  if (!input.trim()) throw new Error('Ingen skills valgt.');
  const selected = new Set();
  for (const choice of choices) {
    const skill = /^\d+$/.test(choice)
      ? skills[Number(choice) - 1]
      : skills.find(({ name }) => name === choice);
    if (!skill) throw new Error(`Ugyldig valg: ${choice}. Ingen skills ble valgt.`);
    selected.add(skill);
  }
  return [...selected];
}

export async function installSkill(skill, destinationDirectory) {
  await mkdir(destinationDirectory, { recursive: true });
  const destination = path.join(destinationDirectory, skill.name);
  let existing;
  try {
    existing = await lstat(destination);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (existing) {
    if (existing.isSymbolicLink()) {
      let target;
      try {
        target = await realpath(destination);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      if (target === await realpath(skill.source)) return `Allerede installert: ${skill.name}`;
    }
    throw new Error(`${destination} finnes fra før og er ikke en identisk installasjon av denne skillen. Flytt eller fjern konflikten manuelt.`);
  }
  await symlink(skill.source, destination, 'dir');
  return `Installert: ${skill.name} -> ${skill.source}`;
}

export async function installSelectedSkills(skills, { home = homedir() } = {}) {
  const destinations = ['.agent', '.copilot'].map((directory) => path.join(home, directory, 'skills'));
  const results = [];
  for (const skill of new Set(skills)) {
    for (const destination of destinations) {
      results.push(await installSkill(skill, destination));
    }
  }
  return results;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--help') {
    console.log('Bruk: node scripts/install-skills.mjs [--all | --list | skill-navn ...]\nUten argumenter: velg skills i en nummerert meny.');
    return;
  }
  if (args.some((arg) => arg.startsWith('-')) &&
      !(args.length === 1 && ['--all', '--list'].includes(args[0]))) {
    throw new Error('Ugyldige argumenter. Bruk --help for hjelp.');
  }
  const skills = await discoverSkills();
  if (skills.length === 0) throw new Error('Fant ingen skills i repoet.');
  if (args.length === 0 || args[0] === '--list') {
    skills.forEach((skill, index) => console.log(`${index + 1}. ${skill.name} — ${skill.description}`));
  }
  if (args[0] === '--list') return;
  let selected;
  if (args.length === 0) {
    const readline = createInterface({ input: process.stdin, output: process.stdout });
    try {
      const answer = await readline.question('\nVelg nummer/navn (flere med komma), «alle», eller Enter for å avbryte: ');
      if (!answer.trim()) {
        console.log('Avbrutt. Ingen skills ble installert.');
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
      if (!skill) throw new Error(`Ukjent skill: ${name}. Ingen skills ble installert.`);
      return skill;
    });
  }
  for (const result of await installSelectedSkills(selected)) console.log(result);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Installasjon feilet: ${error.message}`);
    process.exitCode = 1;
  });
}
