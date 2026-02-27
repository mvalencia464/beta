import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  // Use 'static' for best speed; 'server' for dynamic apps
  output: 'static',
  image: {
    // Use 'compile' for build-time optimization (AVIF + WebP)
    service: {
      entrypoint: '@astrojs/image/services/sharp',
      config: {
        limitInputPixels: false,
      },
    },
    domains: ['images.stokeleads.com'],
  },
  adapter: cloudflare({
    // 'compile' is perfect for home services: it optimizes your
    // project photos at build time so they load instantly.
    imageService: 'compile',
    // Rename assets binding to avoid 'ASSETS' reserved name conflict
    assets: {
      binding: 'PROJECT_ASSETS'
    },
    platformProxy: {
      enabled: true, // Enables the new Astro 6 workerd dev server
    }
  }),
});