import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  // 'server' is required for Workers to persist the build config
  output: 'server', 
  adapter: cloudflare({
    imageService: 'compile', // Optimizes your 80 deck photos for free
    assets: {
      binding: 'PROJECT_ASSETS' // Solves the "Reserved Name" error
    },
    platformProxy: {
      enabled: true, // Crucial for the Astro 6 dev server
    }
  }),
});