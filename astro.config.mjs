import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  output: 'server',
  image: {
    formats: ['avif', 'webp'],
    domains: ['images.stokeleads.com'],
  },
  adapter: cloudflare({
    imageService: 'compile',
    assets: {
      binding: 'PROJECT_ASSETS'
    },
    platformProxy: {
      enabled: true,
    },
    wasmModuleImports: true,
  }),
});