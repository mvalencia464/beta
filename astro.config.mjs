import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  output: 'server',
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