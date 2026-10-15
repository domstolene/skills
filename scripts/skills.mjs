import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

export const repoRoot = fileURLToPath(new URL('../', import.meta.url));

export async function discoverSkills(root = repoRoot) {
  const directory = path.join(root, 'skills');
  const entries = await readdir(directory, { withFileTypes: true });
  const skills = [];

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const source = path.join(directory, entry.name);
    const file = path.join(source, 'SKILL.md');
    const text = await readFile(file, 'utf8');
    const frontmatter = /^(?:\uFEFF)?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
    if (!frontmatter) throw new Error(`${file}: mangler YAML-frontmatter.`);
    const metadata = parse(frontmatter[1]);
    if (
      typeof metadata?.name !== 'string' ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(metadata.name) ||
      metadata.name.length > 64 ||
      metadata.name !== entry.name
    ) {
      throw new Error(`${file}: name må være lik mappenavnet, med små bokstaver, tall og bindestreker (maks 64 tegn).`);
    }
    if (
      typeof metadata.description !== 'string' ||
      !metadata.description.trim() ||
      metadata.description.length > 1024
    ) {
      throw new Error(`${file}: description må være tekst med 1–1024 tegn.`);
    }
    skills.push({
      name: metadata.name,
      description: metadata.description.trim().replace(/\s+/g, ' '),
      source,
    });
  }

  return skills;
}
