import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { lstat, mkdir, mkdtemp, readFile, readlink, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { discoverSkills, repoRoot } from '../scripts/skills.mjs';
import { installSelectedSkills, installSkill, selectSkills } from '../scripts/install-skills.mjs';
import { discoverInstalledSkills, removeSelectedSkills } from '../scripts/remove-skills.mjs';
import { renderOverview, replaceOverview } from '../scripts/update-readme.mjs';

const SKILL = 'korriger-tilbakemeldinger-i-pr'

async function temporaryDirectory(t) {
  const directory = await mkdtemp(path.join(tmpdir(), 'domstolene-skills-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

async function fixtureSkill(root, name, metadata = `name: ${name}\ndescription: En test-skill`) {
  const source = path.join(root, 'skills', name);
  await mkdir(source, { recursive: true });
  await writeFile(path.join(source, 'SKILL.md'), `---\n${metadata}\n---\n\nInstruksjoner.\n`);
  return { name, source };
}

test('discovery sorts skills and reads YAML folded and quoted descriptions', async (t) => {
  const root = await temporaryDirectory(t);
  await fixtureSkill(root, 'z-test', 'name: z-test\ndescription: >-\n  Første linje\n  andre linje');
  await fixtureSkill(root, 'a-test', 'name: a-test\ndescription: "Beskrivelse: med kolon"');
  const skills = await discoverSkills(root);
  assert.deepEqual(skills.map(({ name }) => name), ['a-test', 'z-test']);
  assert.equal(skills[0].description, 'Beskrivelse: med kolon');
  assert.equal(skills[1].description, 'Første linje andre linje');
});

test('discovery rejects malformed, missing and invalid metadata', async (t) => {
  const root = await temporaryDirectory(t);
  const skill = await fixtureSkill(root, 'test-skill');
  for (const content of [
    'Ingen frontmatter',
    '---\nname: annet-navn\ndescription: Tekst\n---\n',
    '---\nname: test-skill\ndescription: ""\n---\n',
    '---\nname: test-skill\ndescription: 42\n---\n',
    `---\nname: test-skill\ndescription: "${'x'.repeat(1025)}"\n---\n`,
    '---\nname: [\n---\n',
  ]) {
    await writeFile(path.join(skill.source, 'SKILL.md'), content);
    await assert.rejects(discoverSkills(root));
  }
  await rm(path.join(skill.source, 'SKILL.md'));
  await assert.rejects(discoverSkills(root), { code: 'ENOENT' });
});

test('menu accepts multiple numbers, names, all and deduplicates; rejects invalid input', () => {
  const skills = [{ name: 'a' }, { name: 'b' }];
  assert.deepEqual(selectSkills('1, b, 1', skills), skills);
  assert.deepEqual(selectSkills('alle', skills), skills);
  assert.deepEqual(selectSkills('1', skills), [{ name: 'a' }]);
  assert.deepEqual(selectSkills('b', skills), [{ name: 'b' }]);
  for (const input of ['', '0', '3', '../a', '1, ukjent']) {
    assert.throws(() => selectSkills(input, skills));
  }
});

test('installation creates a real symlink, is idempotent and exposes source updates', async (t) => {
  const root = await temporaryDirectory(t);
  const skill = await fixtureSkill(root, 'test-skill');
  const destination = path.join(root, 'home', '.copilot', 'skills');
  assert.match(await installSkill(skill, destination), /Installert:/);
  const link = path.join(destination, skill.name);
  assert.ok((await lstat(link)).isSymbolicLink());
  assert.equal(await readlink(link), skill.source);
  assert.match(await installSkill(skill, destination), /Allerede installert:/);
  await writeFile(path.join(skill.source, 'SKILL.md'), 'Oppdatert etter pull');
  assert.equal(await readFile(path.join(link, 'SKILL.md'), 'utf8'), 'Oppdatert etter pull');
});

test('installation links skills in both home directories and exposes source updates', async (t) => {
  const root = await temporaryDirectory(t);
  const home = await temporaryDirectory(t);
  const skill = await fixtureSkill(root, 'test-skill');
  const reference = path.join(skill.source, 'references', 'guide.md');
  await mkdir(path.dirname(reference), { recursive: true });
  await writeFile(reference, 'Referanseinnhold');

  const results = await installSelectedSkills([skill, skill], { home });
  assert.equal(results.length, 2);
  const links = ['.agent', '.copilot'].map((directory) => path.join(home, directory, 'skills', skill.name));
  for (const [index, link] of links.entries()) {
    assert.match(results[index], /Installert:/);
    assert.ok((await lstat(link)).isSymbolicLink());
    assert.equal(await readlink(link), skill.source);
    assert.equal(await readFile(path.join(link, 'references', 'guide.md'), 'utf8'), 'Referanseinnhold');
  }
  await assert.rejects(lstat(path.join(root, '.agent')), { code: 'ENOENT' });

  const repeatedResults = await installSelectedSkills([skill], { home });
  assert.equal(repeatedResults.length, 2);
  for (const result of repeatedResults) assert.match(result, /Allerede installert:/);

  await writeFile(reference, 'Oppdatert referanse');
  for (const link of links) {
    assert.equal(await readFile(path.join(link, 'references', 'guide.md'), 'utf8'), 'Oppdatert referanse');
  }
});

test('installation preserves directories, files, foreign links and broken links', async (t) => {
  const root = await temporaryDirectory(t);
  const skill = await fixtureSkill(root, 'test-skill');
  const other = path.join(root, 'other');
  await mkdir(other);
  for (const kind of ['directory', 'file', 'link', 'broken']) {
    const destination = path.join(root, kind);
    await mkdir(destination);
    const conflict = path.join(destination, skill.name);
    if (kind === 'directory') await mkdir(conflict);
    if (kind === 'file') await writeFile(conflict, 'behold');
    if (kind === 'link') await symlink(other, conflict, 'dir');
    if (kind === 'broken') await symlink(path.join(root, 'missing'), conflict, 'dir');
    const before = await lstat(conflict);
    await assert.rejects(installSkill(skill, destination), /finnes fra før/);
    assert.equal((await lstat(conflict)).ino, before.ino);
    if (kind === 'file') assert.equal(await readFile(conflict, 'utf8'), 'behold');
    if (kind === 'link' || kind === 'broken') {
      assert.equal(await readlink(conflict), kind === 'link' ? other : path.join(root, 'missing'));
    }
  }
});

test('removal discovers installed repo skills and removes only selected links', async (t) => {
  const root = await temporaryDirectory(t);
  const home = await temporaryDirectory(t);
  const firstSkill = await fixtureSkill(root, 'first-skill');
  const secondSkill = await fixtureSkill(root, 'second-skill');
  const agentSkills = path.join(home, '.agent', 'skills');
  const copilotSkills = path.join(home, '.copilot', 'skills');
  await mkdir(agentSkills, { recursive: true });
  await mkdir(copilotSkills, { recursive: true });
  await symlink(firstSkill.source, path.join(agentSkills, firstSkill.name), 'dir');
  await symlink(firstSkill.source, path.join(copilotSkills, firstSkill.name), 'dir');
  await symlink(secondSkill.source, path.join(copilotSkills, secondSkill.name), 'dir');
  const foreignSkill = await fixtureSkill(root, 'foreign-skill');
  await symlink(foreignSkill.source, path.join(agentSkills, foreignSkill.name), 'dir');

  const installed = await discoverInstalledSkills([firstSkill, secondSkill], { home });
  assert.deepEqual(installed.map(({ name }) => name), ['first-skill', 'second-skill']);

  const results = await removeSelectedSkills([firstSkill], { home });
  assert.equal(results.length, 2);
  assert.match(results[0], /Fjernet:/);
  await assert.rejects(lstat(path.join(agentSkills, firstSkill.name)), { code: 'ENOENT' });
  await assert.rejects(lstat(path.join(copilotSkills, firstSkill.name)), { code: 'ENOENT' });
  assert.ok((await lstat(path.join(copilotSkills, secondSkill.name))).isSymbolicLink());
  assert.ok((await lstat(path.join(agentSkills, foreignSkill.name))).isSymbolicLink());
  assert.ok((await lstat(firstSkill.source)).isDirectory());
});

test('removal ignores directories, files, foreign links and broken links with repo skill names', async (t) => {
  const root = await temporaryDirectory(t);
  const skill = await fixtureSkill(root, 'test-skill');
  const other = path.join(root, 'other');
  await mkdir(other);
  for (const kind of ['directory', 'file', 'link', 'broken']) {
    const home = await temporaryDirectory(t);
    const destination = path.join(home, '.agent', 'skills', skill.name);
    await mkdir(path.dirname(destination), { recursive: true });
    if (kind === 'directory') await mkdir(destination);
    if (kind === 'file') await writeFile(destination, 'behold');
    if (kind === 'link') await symlink(other, destination, 'dir');
    if (kind === 'broken') await symlink(path.join(root, 'missing'), destination, 'dir');
    const before = await lstat(destination);
    assert.deepEqual(await discoverInstalledSkills([skill], { home }), []);
    assert.deepEqual(await removeSelectedSkills([skill], { home }), []);
    assert.equal((await lstat(destination)).ino, before.ino);
  }
});

test('removal recognizes relative links and preserves a conflicting installation', async (t) => {
  const root = await temporaryDirectory(t);
  const home = await temporaryDirectory(t);
  const skill = await fixtureSkill(root, 'test-skill');
  const agentLink = path.join(home, '.agent', 'skills', skill.name);
  const copilotDirectory = path.join(home, '.copilot', 'skills', skill.name);
  await mkdir(path.dirname(agentLink), { recursive: true });
  await mkdir(copilotDirectory, { recursive: true });
  await symlink(path.relative(path.dirname(agentLink), skill.source), agentLink, 'dir');

  assert.deepEqual(await discoverInstalledSkills([skill], { home }), [skill]);
  assert.equal((await removeSelectedSkills([skill, skill], { home })).length, 1);
  await assert.rejects(lstat(agentLink), { code: 'ENOENT' });
  assert.ok((await lstat(copilotDirectory)).isDirectory());
  assert.ok((await lstat(skill.source)).isDirectory());
});

test('README generation preserves other content and is idempotent', () => {
  const input = '# Behold\n<!-- skills:start -->\ngammelt\n<!-- skills:end -->\nSlutt\n';
  const overview = renderOverview([{ name: 'test', description: 'A | B <tag> [lenke] *tekst*' }]);
  const updated = replaceOverview(input, overview);
  assert.ok(updated.startsWith('# Behold\n<!-- skills:start -->'));
  assert.ok(updated.endsWith('<!-- skills:end -->\nSlutt\n'));
  assert.ok(updated.includes('[test](./skills/test/SKILL.md)'));
  assert.ok(updated.includes('A &#124; B &lt;tag&gt; &#91;lenke&#93; &#42;tekst&#42;'));
  assert.equal(replaceOverview(updated, overview), updated);
  for (const invalid of [
    '# Ingen markører',
    '<!-- skills:end --><!-- skills:start -->',
    `${input}<!-- skills:start -->`,
    `${input}<!-- skills:end -->`,
  ]) {
    assert.throws(() => replaceOverview(invalid, overview), /markører/);
  }
});

function runInstaller(home, args = [], input) {
  return spawnSync(process.execPath, [path.join(repoRoot, 'scripts/install-skills.mjs'), ...args], {
    cwd: tmpdir(),
    env: { ...process.env, HOME: home, USERPROFILE: home },
    input,
    encoding: 'utf8',
    timeout: 10_000,
  });
}

function runRemover(home, args = [], input) {
  return spawnSync(process.execPath, [path.join(repoRoot, 'scripts/remove-skills.mjs'), ...args], {
    cwd: tmpdir(),
    env: { ...process.env, HOME: home, USERPROFILE: home },
    input,
    encoding: 'utf8',
    timeout: 10_000,
  });
}

test('CLI installs from a different working directory using the no-argument menu', async (t) => {
  const home = await temporaryDirectory(t);
  const result = runInstaller(home, [], '1\n');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Velg nummer\/navn/);
  for (const directory of ['.agent', '.copilot']) {
    const link = path.join(home, directory, 'skills', SKILL);
    assert.ok((await lstat(link)).isSymbolicLink());
    assert.equal(await readlink(link), path.join(repoRoot, `skills/${SKILL}`));
  }
  const again = runInstaller(home, [SKILL]);
  assert.equal(again.status, 0, again.stderr);
  assert.match(again.stdout, /Allerede installert:/);
});

test('CLI removes an installed skill selected from the same interactive menu', async (t) => {
  const home = await temporaryDirectory(t);
  const link = path.join(home, '.agent', 'skills', SKILL);
  await mkdir(path.dirname(link), { recursive: true });
  await symlink(path.join(repoRoot, `skills/${SKILL}`), link, 'dir');

  const result = runRemover(home, [], '1\n');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Velg nummer\/navn/);
  assert.match(result.stdout, /Fjernet:/);
  await assert.rejects(lstat(link), { code: 'ENOENT' });
});

test('removal CLI supports listing, cancellation, invalid choices and all selection forms', async (t) => {
  const home = await temporaryDirectory(t);
  const [skill] = await discoverSkills();
  await installSelectedSkills([skill], { home });
  for (const [args, input, status] of [
    [['--list'], undefined, 0],
    [['--help'], undefined, 0],
    [[], '\n', 0],
    [[], '999\n', 1],
    [['ukjent'], undefined, 1],
    [[skill.name, 'ukjent'], undefined, 1],
    [['--unknown'], undefined, 1],
  ]) {
    assert.deepEqual(
      (await discoverInstalledSkills(await discoverSkills(), { home })).map(({ name }) => name),
      [skill.name],
    );
    const result = runRemover(home, args, input);
    assert.equal(result.status, status, `${args} (${JSON.stringify(input)}): ${result.stderr}\n${result.stdout}`);
    if (status !== 0) assert.match(result.stderr, /Fjerning feilet:/);
    for (const directory of ['.agent', '.copilot']) {
      assert.ok((await lstat(path.join(home, directory, 'skills', skill.name))).isSymbolicLink());
    }
  }
  for (const [args, input] of [
    [[], 'alle\n'],
    [[], `${skill.name}\n`],
    [[skill.name], undefined],
    [['--', '--all'], undefined],
  ]) {
    await installSelectedSkills([skill], { home });
    const result = runRemover(home, args, input);
    assert.equal(result.status, 0, result.stderr);
    for (const directory of ['.agent', '.copilot']) {
      await assert.rejects(lstat(path.join(home, directory, 'skills', skill.name)), { code: 'ENOENT' });
    }
  }
});

test('removal CLI reports no installations without writes and rejects unknown names', async (t) => {
  const home = await temporaryDirectory(t);
  const result = runRemover(home);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Fant ingen installerte skills/);
  assert.doesNotMatch(result.stdout, /Velg nummer\/navn/);
  const unknown = runRemover(home, ['ukjent']);
  assert.equal(unknown.status, 1, unknown.stderr);
  assert.match(unknown.stderr, /Ukjent installert skill/);
  for (const directory of ['.agent', '.copilot']) {
    await assert.rejects(lstat(path.join(home, directory)), { code: 'ENOENT' });
  }
});

test('CLI supports list, all, cancellation, errors and unknown names without unwanted writes', async (t) => {
  const home = await temporaryDirectory(t);
  for (const [args, input, status] of [
    [['--list'], undefined, 0],
    [['--help'], undefined, 0],
    [[], '\n', 0],
    [[], '999\n', 1],
    [['ukjent'], undefined, 1],
    [[SKILL, 'ukjent'], undefined, 1],
    [['--unknown'], undefined, 1],
  ]) {
    const result = runInstaller(home, args, input);
    assert.equal(result.status, status, `${args}: ${result.stderr}`);
    if (status !== 0) assert.match(result.stderr, /Installasjon feilet:/);
    for (const directory of ['.agent', '.copilot']) {
      await assert.rejects(lstat(path.join(home, directory)), { code: 'ENOENT' });
    }
  }
  const result = runInstaller(home, ['--all']);
  assert.equal(result.status, 0, result.stderr);
  for (const directory of ['.agent', '.copilot']) {
    const link = path.join(home, directory, 'skills', SKILL);
    assert.ok((await lstat(link)).isSymbolicLink());
    assert.equal(await readlink(link), path.join(repoRoot, `skills/${SKILL}`));
  }
});

test('CLI conflicts return nonzero and preserve the existing installation', async (t) => {
  for (const directory of ['.agent', '.copilot']) {
    const home = await temporaryDirectory(t);
    const conflict = path.join(home, directory, 'skills', SKILL);
    await mkdir(conflict, { recursive: true });
    const result = runInstaller(home, ['--all']);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /finnes fra før/);
    assert.ok((await lstat(conflict)).isDirectory());
  }
});
