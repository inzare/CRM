import { spawnSync } from 'node:child_process';
import path from 'node:path';

const databaseUrl = process.env.DATABASE_URL ?? '';
const databaseName = (() => {
  try {
    return new URL(databaseUrl).pathname.replace(/^\//, '');
  } catch {
    return '';
  }
})();

if (process.env.NODE_ENV !== 'test' || !databaseName.toLowerCase().includes('test')) {
  console.error(
    'Integration tests refuse to reset a database unless NODE_ENV=test and its database name contains "test".',
  );
  process.exit(2);
}

/**
 * @param {string} command
 * @param {readonly string[]} args
 */
function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const prismaCli = path.resolve('node_modules', 'prisma', 'build', 'index.js');
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('npm_execpath is required to run integration tests.');

run(process.execPath, [prismaCli, 'migrate', 'reset', '--force']);
run(process.execPath, [prismaCli, 'db', 'seed']);
run(process.execPath, [npmCli, 'run', 'test:integration', '--workspace', '@consultflow/api']);
