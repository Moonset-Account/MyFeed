import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const python = process.env.PYTHON ? process.env.PYTHON : 'python3';
const venvPython = join(root, '.venv', 'bin', 'python');
const env = { ...process.env, PIP_CACHE_DIR: join(root, '.pip-cache') };

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', cwd: root, env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!existsSync(venvPython)) {
  run(python, ['-m', 'venv', '.venv']);
}
run(venvPython, ['-m', 'pip', 'install', '-r', 'requirements.txt']);
