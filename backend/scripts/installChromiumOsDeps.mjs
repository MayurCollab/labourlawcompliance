/**
 * Install OS libraries Chromium needs for Form 5 HTML → PDF.
 *
 * These are apt packages (not npm). npm cannot ship libatk / libnss / etc.
 * This script runs from package.json so production deploys can install them
 * automatically on Linux hosts (no Docker).
 *
 * Runs only when:
 *   - platform is Linux, and
 *   - NODE_ENV=production, or INSTALL_CHROMIUM_OS_DEPS=1
 *
 * Usage:
 *   npm run setup:chromium-deps
 *   NODE_ENV=production npm install   # via postinstall
 *   INSTALL_CHROMIUM_OS_DEPS=1 npm install
 */

import { spawnSync } from 'node:child_process';
import process from 'node:process';

const PACKAGES = [
  'ca-certificates',
  'fonts-liberation',
  'libasound2',
  'libatk-bridge2.0-0',
  'libatk1.0-0',
  'libc6',
  'libcairo2',
  'libcups2',
  'libdbus-1-3',
  'libexpat1',
  'libfontconfig1',
  'libgbm1',
  'libgcc1',
  'libglib2.0-0',
  'libgtk-3-0',
  'libnspr4',
  'libnss3',
  'libpango-1.0-0',
  'libpangocairo-1.0-0',
  'libstdc++6',
  'libx11-6',
  'libx11-xcb1',
  'libxcb1',
  'libxcomposite1',
  'libxcursor1',
  'libxdamage1',
  'libxext6',
  'libxfixes3',
  'libxi6',
  'libxrandr2',
  'libxrender1',
  'libxss1',
  'libxtst6',
  'wget',
  'xdg-utils',
];

const shouldRun =
  process.platform === 'linux' &&
  (process.env.INSTALL_CHROMIUM_OS_DEPS === '1' ||
    process.env.NODE_ENV === 'production' ||
    process.argv.includes('--force'));

if (!shouldRun) {
  if (process.argv.includes('--verbose')) {
    console.log(
      '[chromium-deps] Skip (set NODE_ENV=production or INSTALL_CHROMIUM_OS_DEPS=1 on Linux).',
    );
  }
  process.exit(0);
}

const hasBin = (bin) => {
  const result = spawnSync('sh', ['-c', `command -v ${bin}`], {
    encoding: 'utf8',
  });
  return result.status === 0 && Boolean(result.stdout?.trim());
};

if (!hasBin('apt-get')) {
  console.warn(
    '[chromium-deps] apt-get not found. Install Chromium OS libraries manually for your distro.',
  );
  console.warn(`[chromium-deps] Needed packages: ${PACKAGES.join(' ')}`);
  process.exit(0);
}

const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;
const sudoOk =
  !isRoot &&
  hasBin('sudo') &&
  spawnSync('sudo', ['-n', 'true'], { stdio: 'ignore' }).status === 0;

const run = (command, args) => {
  console.log(`[chromium-deps] ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env: { ...process.env, DEBIAN_FRONTEND: 'noninteractive' },
  });
  return result.status ?? 1;
};

const prefix = isRoot ? [] : sudoOk ? ['sudo', '-n'] : null;

if (!prefix) {
  console.warn(
    '[chromium-deps] Need root or passwordless sudo to install packages.',
  );
  console.warn(
    `[chromium-deps] Run as root:\n  apt-get update && apt-get install -y ${PACKAGES.join(' ')}`,
  );
  process.exit(0);
}

const aptGet = [...prefix, 'apt-get'];
const updateStatus = run(aptGet[0], [...aptGet.slice(1), 'update']);
if (updateStatus !== 0) {
  console.warn('[chromium-deps] apt-get update failed; continuing with install attempt.');
}

const installStatus = run(aptGet[0], [
  ...aptGet.slice(1),
  'install',
  '-y',
  '--no-install-recommends',
  ...PACKAGES,
]);

if (installStatus !== 0) {
  console.error(
    '[chromium-deps] apt install failed. On Ubuntu 24.04+, some package names end in t64 — install Chromium deps manually if needed.',
  );
  // Do not fail npm install hard — operator can fix packages separately.
  process.exit(0);
}

console.log('[chromium-deps] Chromium OS libraries installed.');
