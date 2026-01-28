import fs from 'node:fs';

const tag = process.env.GITHUB_REF_NAME;
if (!tag) {
  console.error('Missing GITHUB_REF_NAME');
  process.exit(1);
}

if (!tag.startsWith('v')) {
  console.error(`Expected tag like v1.2.3, got: ${tag}`);
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const version = pkg?.version;
if (!version || typeof version !== 'string') {
  console.error('Missing package.json version');
  process.exit(1);
}

const expectedTag = `v${version}`;
if (tag !== expectedTag) {
  console.error(
    `Tag/package.json version mismatch. Tag is ${tag}, but package.json is ${version} (expected ${expectedTag}).`
  );
  process.exit(1);
}

console.log(`OK: ${tag} matches package.json version ${version}`);
