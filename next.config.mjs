import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { version: appVersion } = require('./package.json');

/** @type {import("next").NextConfig} */
const resolveFromRoot = target => path.resolve(process.cwd(), target);
const shaderLoader = resolveFromRoot('loaders/glsl-loader.cjs');

const isElectronBuild = process.env.ELECTRON_BUILD === 'true';

const nextConfig = {
  // Static export for Electron builds; server mode for web/dev
  ...(isElectronBuild ? {
    output: 'export',
    images: { unoptimized: true },
    trailingSlash: true,
  } : {}),

  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
    NEXT_PUBLIC_IS_ELECTRON: isElectronBuild ? 'true' : 'false',
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  devIndicators: false,
  turbopack: {
    resolveAlias: {
      '@': resolveFromRoot('src'),
    },
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
      '*.glsl': {
        loaders: [shaderLoader],
        as: '*.js',
      },
      '*.vs': {
        loaders: [shaderLoader],
        as: '*.js',
      },
      '*.fs': {
        loaders: [shaderLoader],
        as: '*.js',
      },
      '*.vert': {
        loaders: [shaderLoader],
        as: '*.js',
      },
      '*.frag': {
        loaders: [shaderLoader],
        as: '*.js',
      },
    },
  },
  ...(isElectronBuild ? {} : {
    rewrites: async () => [
      {
        source: '/u.js',
        destination: 'https://cloud.umami.is/script.js',
      },
    ],
  }),
};

export default nextConfig;

