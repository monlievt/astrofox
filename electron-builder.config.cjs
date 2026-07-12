/**
 * electron-builder configuration for Astrofox
 * Target: macOS (Apple Silicon + Intel) and Windows
 */

const config = {
  appId: 'io.astrofox.app',
  productName: 'Astrofox',
  copyright: 'Copyright © 2024 Mike Cao',

  directories: {
    output: 'dist-electron',
    buildResources: 'build',
  },

  // The Next.js static export lives in `out/`
  files: [
    'out/**/*',
    'electron/dist/**/*',
    'package.json',
  ],

  asar: true,

  // ─── Auto-Updater ────────────────────────────────────────────────────────
  publish: [
    {
      provider: 'github',
      owner: 'YOUR_GITHUB_USERNAME',   // ← Ganti dengan username GitHub Anda
      repo: 'astrofox',                // ← Ganti dengan nama repo GitHub Anda
      releaseType: 'release',
    },
  ],

  // ─── macOS ───────────────────────────────────────────────────────────────
  mac: {
    category: 'public.app-category.music',
    target: [
      { target: 'dmg', arch: ['arm64', 'x64'] },   // Universal (Apple Silicon + Intel)
      { target: 'zip', arch: ['arm64', 'x64'] },   // Needed for auto-updater
    ],
    icon: 'build/icon.icns',                        // 1024x1024 macOS icon
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: 'build/entitlements.mac.plist',
    entitlementsInherit: 'build/entitlements.mac.plist',
  },

  dmg: {
    title: '${productName} ${version}',
    artifactName: '${productName}-${version}-${arch}.dmg',
    window: { width: 540, height: 380 },
    contents: [
      { x: 130, y: 220 },
      { x: 410, y: 220, type: 'link', path: '/Applications' },
    ],
  },

  // ─── Windows ─────────────────────────────────────────────────────────────
  win: {
    target: [
      { target: 'nsis', arch: ['x64', 'arm64'] },
    ],
    icon: 'build/icon.ico',                         // 256x256 Windows icon
  },

  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    artifactName: '${productName}-Setup-${version}-${arch}.exe',
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'Astrofox',
  },
};

module.exports = config;
