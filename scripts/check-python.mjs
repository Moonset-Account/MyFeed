import { spawnSync } from 'node:child_process';

const python = '.venv/bin/python';
const checks = [
  [python, ['-m', 'compileall', 'backend', 'tests']],
  [python, ['-c', 'from backend.app import app; print(type(app).__name__)']]
];

for (const [command, args] of checks) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
