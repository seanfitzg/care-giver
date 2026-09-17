#!/usr/bin/env node
// Confirmation-gated wrapper around supabase/reset-all-data.sql.
// Usage: node scripts/reset-all-data.js --local | --linked

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const SQL_FILE = path.join('supabase', 'reset-all-data.sql');
const PROJECT_REF_FILE = path.join('supabase', '.temp', 'project-ref');

const args = process.argv.slice(2);
const isLocal = args.includes('--local');
const isLinked = args.includes('--linked');

if (isLocal === isLinked) {
  console.error('Usage: node scripts/reset-all-data.js --local | --linked');
  process.exit(1);
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    }),
  );
}

function runReset(target) {
  const result = spawnSync('npx', ['supabase', 'db', 'query', target, '--file', SQL_FILE], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  process.exit(result.status ?? 1);
}

async function main() {
  if (isLocal) {
    console.log('This will PERMANENTLY delete ALL care recipients, their data, and ALL');
    console.log('user accounts from your LOCAL Supabase stack. This cannot be undone.\n');
    const answer = await ask('Type "reset" to confirm, anything else to abort: ');
    if (answer !== 'reset') {
      console.log('Aborted.');
      process.exit(1);
    }
    runReset('--local');
    return;
  }

  // --linked: extra guard, requires the actual linked project ref.
  let linkedRef;
  try {
    linkedRef = fs.readFileSync(PROJECT_REF_FILE, 'utf8').trim();
  } catch {
    console.error(
      `Could not read ${PROJECT_REF_FILE} — is this project linked? Run "npx supabase link" first.`,
    );
    process.exit(1);
  }

  console.log('!!! DANGER: this targets the LINKED CLOUD PROJECT !!!');
  console.log(`Project ref: ${linkedRef}`);
  console.log('This will PERMANENTLY delete ALL care recipients, their data, and ALL');
  console.log('user accounts from this remote project. This cannot be undone.\n');
  const answer = await ask(
    `Type the project ref (${linkedRef}) to confirm, anything else to abort: `,
  );
  if (answer !== linkedRef) {
    console.log('Aborted.');
    process.exit(1);
  }
  runReset('--linked');
}

main();
