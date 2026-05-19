#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

const HOME = os.homedir();

const AGENTS = {
  opencode: path.join(HOME, '.opencode', 'skills'),
  'claude-code': path.join(HOME, '.claude', 'skills'),
  codex: path.join(HOME, '.codex', 'skills'),
};

const skillsDir = path.join(__dirname, 'skills');
const skillNames = fs.readdirSync(skillsDir).filter(name => {
  const stat = fs.statSync(path.join(skillsDir, name));
  return stat.isDirectory() && fs.existsSync(path.join(skillsDir, name, 'SKILL.md'));
});

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const args = process.argv.slice(2);
const targets = [];

for (const [name, dir] of Object.entries(AGENTS)) {
  if (args.length === 0 || args.includes(`--${name}`)) {
    if (fs.existsSync(path.dirname(dir))) {
      targets.push({ name, dir });
    }
  }
}

if (args.includes('--all')) {
  for (const [name, dir] of Object.entries(AGENTS)) {
    targets.push({ name, dir });
  }
}

if (targets.length === 0) {
  console.log('No supported agent tools detected.');
  console.log('\nSupported agents:');
  for (const [name, dir] of Object.entries(AGENTS)) {
    console.log(`  ${name.padEnd(12)}  ${dir}`);
  }
  console.log('\nUse --all to force install to all paths anyway.');
  process.exit(0);
}

for (const { name, dir } of targets) {
  const targetDir = path.join(dir);
  console.log(`Installing skills to ${name} (${targetDir})...`);
  for (const skill of skillNames) {
    const src = path.join(skillsDir, skill);
    const dest = path.join(targetDir, skill);
    if (fs.existsSync(dest)) {
      console.log(`  [skip] ${skill} (already exists)`);
    } else {
      copyDir(src, dest);
      console.log(`  [done] ${skill}`);
    }
  }
}

console.log('\nDone! Skills installed.');
