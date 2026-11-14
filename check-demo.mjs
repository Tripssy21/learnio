import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('.', import.meta.url));
for (const filename of ['app.js', 'api-store.js', 'academy-ui.js']) {
    const result = spawnSync(process.execPath, ['--check', filename], { cwd, stdio: 'inherit' });
    if (result.status !== 0) process.exit(result.status || 1);
}
for (const filename of ['check-model.mjs', 'check-ux-learning.mjs', 'check-ux-personal-ui.mjs', 'check-ux-enrollment-ui.mjs', 'check-charts.mjs', 'check-journey-plan.mjs', 'check-api-store.mjs', 'check-academy.mjs', 'check-ux-academy.mjs', 'check-college.mjs', 'check-college-ui.mjs', 'check-ux-academy-ui.mjs', 'check-navigation.mjs', 'check-shell.mjs', 'check-server.mjs', 'check-persona-data.mjs']) {
    const result = spawnSync(process.execPath, [filename], { cwd, stdio: 'inherit' });
    if (result.status !== 0) process.exit(result.status || 1);
}
console.log('Learnio checks passed: domain, scope, persisted server workflows, and targeted test-data cleanup.');
