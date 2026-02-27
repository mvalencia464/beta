import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  output: 'server',
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
    imageService: 'compile',
    // Hard override to prevent the reserved 'ASSETS' name clash
    assets: {
      binding: 'PROJECT_ASSETS'
    },
    // Ensure the proxy doesn't try to auto-inject the default binding
    platformProxy: {
      enabled: true,
    }
  }),
  // Vite needs to know to ignore the 'ASSETS' keyword during the build
  vite: {
    define: {
      'process.env.ASSETS_BINDING_NAME': JSON.stringify('PROJECT_ASSETS')
    }
  }
});