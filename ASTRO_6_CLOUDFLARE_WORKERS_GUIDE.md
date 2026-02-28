# The Definitive Astro 6 Beta + Cloudflare Workers Deployment Guide

This is a battle-tested blueprint for deploying **Astro 6 Beta** to **Cloudflare Workers** (not Pages). We've successfully navigated bleeding-edge bugs—reserved naming conflicts, deployment pathing errors, and adapter lifecycle issues—to create a high-performance, full-stack foundation.

---

## Table of Contents

1. [Clean Configuration Setup](#1-clean-configuration-setup)
2. [High-Performance Hybrid Rendering](#2-high-performance-hybrid-rendering)
3. [Local Development & Testing](#3-local-development--testing)
4. [Cloudflare Dashboard Deployment](#4-cloudflare-dashboard-deployment)
5. [Troubleshooting & Known Issues](#5-troubleshooting--known-issues)
6. [Content Collections & Data](#6-content-collections--data)
7. [GHL API Integration (Stage 2)](#7-ghl-api-integration-stage-2)

---

## 1. Clean Configuration Setup

### 1.1 astro.config.mjs

The `output: 'server'` setting is critical for Workers deployment. The renamed asset binding prevents the "reserved name" crash that occurs with the default `ASSETS` binding.

```javascript
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  // 'server' ensures the build directory persists for the Worker
  output: 'server', 
  
  adapter: cloudflare({
    // Build-time optimization for static images (80+ deck photos)
    imageService: 'compile', 
    
    // FIX: Prevents the "ASSETS is reserved in Pages projects" crash
    assets: {
      binding: 'PROJECT_ASSETS'
    },
    
    // Required for local dev server with platform features
    platformProxy: {
      enabled: true,
    },
    
    // Required for beta image processing pipeline
    wasmModuleImports: true,
  }),
});
```

**Why this works:**
- `output: 'server'` tells Astro to generate a Worker-compatible build, not a static site
- Custom `PROJECT_ASSETS` binding avoids collision with Cloudflare's internal "ASSETS" binding (Pages reserved)
- `platformProxy` enables local dev server access to `env` bindings (KV, Durable Objects, etc.)
- `wasmModuleImports` supports image optimization via WebAssembly

### 1.2 wrangler.jsonc

**Keep this minimal.** The v13 adapter handles the entry point (`_worker.js`) automatically. Manually specifying a `main` path causes "file not found" errors during deployment.

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "beta", // Must match your Cloudflare Workers service name exactly
  "compatibility_date": "2024-09-23", // Minimum for Node.js compatibility v2
  "compatibility_flags": ["nodejs_compat"]
}
```

**Critical:**
- `name` must match your Workers service name in the Cloudflare Dashboard
- Do NOT add `"main": "dist/server/entry.mjs"` — the adapter auto-generates this

### 1.3 package.json

Ensure the project name matches your service name for clean build logs.

```json
{
  "name": "beta",
  "type": "module",
  "version": "0.0.1",
  "engines": {
    "node": ">=22.12.0"
  },
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "astro": "astro"
  },
  "dependencies": {
    "astro": "^6.0.0-beta.14",
    "@astrojs/cloudflare": "^13.0.0-beta.11"
  }
}
```

---

## 2. High-Performance Hybrid Rendering

Astro 6 enables a "static-first" approach where 90% of your site is pre-rendered HTML served from the edge, while dynamic routes run on the Worker.

### 2.1 Prerender Static Pages

Add `export const prerender = true;` to any `.astro` page that doesn't need server-side logic. This generates static HTML instead of running the Worker on every request.

**src/pages/index.astro** (Portfolio/Gallery)
```astro
---
export const prerender = true;

import Layout from '../layouts/Layout.astro';
import GalleryCard from '../components/GalleryCard.astro';

const deckPhotos = [
  {
    slug: 'hillside-mountain-view',
    title: 'Hillside Mountain View',
    image: '/images/decks/hillside-mountain-view.jpg',
    description: 'Modern composite deck with mountain views'
  },
  // ... 80+ more decks
];
---

<Layout title="Deck Masters Portfolio">
  <div class="gallery">
    {deckPhotos.map((deck) => (
      <GalleryCard {...deck} />
    ))}
  </div>
</Layout>
```

### 2.2 Dynamic Server Routes (GHL Integration)

For routes that need server access (lead capture, API calls), omit `prerender`. These run on the Worker using Astro Actions.

**src/pages/api/leads.ts** (Dynamic)
```typescript
import { defineAction, h } from 'astro:actions';
import { z } from 'astro:content';

export const server = {
  submitLead: defineAction({
    accept: 'json',
    input: z.object({
      name: z.string(),
      email: z.string().email(),
      phone: z.string(),
      projectType: z.enum(['new-deck', 'remodel', 'repair']),
    }),
    handler: async (input, context) => {
      // Access Cloudflare bindings via context.locals.runtime.env
      const KV = context.locals.runtime.env.LEADS_KV;
      
      // POST to GoHighLevel API (Stage 2)
      const ghlResponse = await fetch(
        `https://api.gohighlevel.com/v1/contacts`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${context.locals.runtime.env.GHL_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            firstName: input.name,
            email: input.email,
            phone: input.phone,
            customFields: {
              projectType: input.projectType,
            }
          }),
        }
      );

      if (!ghlResponse.ok) {
        throw new Error(`GHL API error: ${ghlResponse.statusText}`);
      }

      return { success: true, message: 'Lead submitted' };
    },
  }),
};
```

### 2.3 Prerender with Dynamic Data

If you need to prerender 80+ deck pages with dynamic routes, use `getStaticPaths()`:

**src/pages/portfolio/[slug].astro**
```astro
---
export const prerender = true;

import { getCollection } from 'astro:content';

export async function getStaticPaths() {
  const deckPhotos = await getCollection('decks');
  return deckPhotos.map((deck) => ({
    params: { slug: deck.slug },
    props: { deck },
  }));
}

const { deck } = Astro.props;
---

<h1>{deck.data.title}</h1>
<img src={deck.data.image} alt={deck.data.title} />
<p>{deck.data.description}</p>
```

---

## 3. Local Development & Testing

### 3.1 Run the Dev Server

The `platformProxy` setting enables access to Cloudflare bindings locally:

```bash
npm run dev
```

The dev server runs at `http://localhost:3000` and can access:
- KV namespaces (via `locals.runtime.env.KV_NAMESPACE`)
- R2 buckets (via `locals.runtime.env.BUCKET`)
- Environment variables (via `locals.runtime.env.API_KEY`)

### 3.2 Test Prerendered Routes

Prerendered pages should load instantly (served as static HTML):

```bash
npm run build
npm run preview
```

Visit `http://localhost:3000/portfolio/[slug]` — should load in <50ms.

### 3.3 Test Dynamic Routes

Server routes should show logs in the preview terminal:

```bash
curl -X POST http://localhost:3000/api/leads.json \
  -H "Content-Type: application/json" \
  -d '{"name":"John","email":"john@example.com","phone":"555-1234","projectType":"new-deck"}'
```

---

## 4. Cloudflare Dashboard Deployment

### 4.1 Set Up the Workers Service

1. Go to **Cloudflare Dashboard** → **Workers & Pages** → **Create Application**
2. Choose **Write your own** (Workers)
3. Name it `beta` (must match `wrangler.jsonc`)
4. Deploy a dummy script (it will be replaced)

### 4.2 Configure Build Settings

Navigate to **Workers & Pages** → **Settings** → **Build & Deploy** → **Build Settings**:

| Setting | Value |
|---------|-------|
| Build command | `npm run build` |
| Build output directory | `dist/client` |
| Root directory (leave empty) | — |

**For the "Required Deploy Command"** (in custom deploy scripts):

```bash
rm -rf .wrangler dist && npm run build && npx wrangler deploy --assets dist/client
```

**Why this works:**
- `rm -rf .wrangler` clears stale adapter cache that can interfere with beta builds
- `rm -rf dist` ensures no leftover build artifacts
- `npm run build` generates fresh `dist/client` folder
- `npx wrangler deploy --assets dist/client` explicitly tells Wrangler where static assets live

### 4.3 Environment Variables

Set bindings in **Workers** → **Settings** → **Environment Variables**:

```
GHL_API_KEY = "your-gohighlevel-api-key"
SESSION = "kv-namespace-binding"  (auto-created by adapter)
PROJECT_ASSETS = "r2-bucket"      (auto-created by adapter)
```

### 4.4 Trigger a Deploy

Push to GitHub:

```bash
git add -A
git commit -m "Deploy: Ready for Cloudflare Workers"
git push
```

Cloudflare automatically runs your build command and deploys.

---

## 5. Troubleshooting & Known Issues

### Issue: "The name 'ASSETS' is reserved in Pages projects"

**Cause:** Using default `assets.binding: 'ASSETS'` in `astro.config.mjs`

**Fix:** Rename to `PROJECT_ASSETS`:
```javascript
assets: {
  binding: 'PROJECT_ASSETS'
}
```

### Issue: "ENOENT: no such file or directory, open 'dist/server/.prerender/wrangler.json'"

**Cause:** Adapter is deleting `dist/server` during build cleanup (beta behavior)

**Fix:** This is expected in Astro 6 beta for Workers. The server code is built internally but not exported as a separate folder. **The deployment still works**—don't panic if you don't see `dist/server`.

**Verification:**
```bash
npm run build
ls -la dist/
# You'll see: dist/client/ (static assets)
# You won't see: dist/server/ (built into the Worker internally)
```

### Issue: Build shows "regular-raspberry" but service is named "beta"

**Cause:** Mismatched names in `package.json` and `wrangler.jsonc`

**Fix:** Align both files:
```json
// package.json
{ "name": "beta", ... }

// wrangler.jsonc
{ "name": "beta", ... }
```

### Issue: Deploy succeeds but dashboard shows "Failed"

**Cause:** Name mismatch between local config and Cloudflare service

**Fix:** Ensure `wrangler.jsonc` name matches your Workers service exactly. The site is live (assets uploaded successfully), but Wrangler can't finalize the record due to naming conflict.

### Issue: Images aren't optimizing despite `imageService: 'compile'`

**Cause:** Images in `public/` folder aren't processed by Astro's image optimization

**Fix:** Import images into your components for optimization:
```astro
import { Image } from 'astro:assets';
import heroImage from '../assets/hero.jpg';

<Image src={heroImage} alt="Hero" />
```

---

## 6. Content Collections & Data

### 6.1 Deck Portfolio Collection

**src/content.config.ts**
```typescript
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const decks = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/decks' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    image: z.string().url(),
    beforeImage: z.string().url().optional(),
    afterImage: z.string().url().optional(),
    location: z.string(),
    squareFeet: z.number(),
    materials: z.array(z.string()),
    completionDate: z.coerce.date(),
    featured: z.boolean().default(false),
  }),
});

const testimonials = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/testimonials' }),
  schema: z.object({
    author: z.string(),
    company: z.string().optional(),
    rating: z.number().int().min(1).max(5),
    text: z.string(),
    date: z.coerce.date(),
    avatarUrl: z.string().url().optional(),
    source: z.enum(['Google', 'Yelp', 'Facebook', 'Direct']).default('Direct'),
  }),
});

export const collections = { decks, testimonials };
```

### 6.2 Sample Deck Entry

**src/content/decks/hillside-mountain-view.md**
```markdown
---
title: Hillside Mountain View
description: Modern composite deck with wraparound seating
image: https://cdn.example.com/decks/hillside-mountain-view.jpg
location: Anchorage, Alaska
squareFeet: 450
materials:
  - TimberTech composite
  - Aluminum railings
  - Cedar trim
completionDate: 2024-06-15
featured: true
---

This expansive deck overlooks the Chugach Mountains and features a built-in hot tub area...
```

### 6.3 Sample Testimonial Entry

**src/content/testimonials/john-doe.json**
```json
{
  "author": "John Doe",
  "company": "Anchorage Homes LLC",
  "rating": 5,
  "text": "Deck Masters transformed our backyard. The attention to detail and craftsmanship is unmatched.",
  "date": "2024-06-20",
  "avatarUrl": "https://cdn.example.com/avatars/john-doe.jpg",
  "source": "Google"
}
```

### 6.4 Display Collections

**src/components/DeckGallery.astro**
```astro
---
import { getCollection } from 'astro:content';
import { Image } from 'astro:assets';

const decks = await getCollection('decks');
const featured = decks.filter(d => d.data.featured);
---

<div class="gallery">
  {featured.map((deck) => (
    <a href={`/portfolio/${deck.slug}`}>
      <Image 
        src={deck.data.image} 
        alt={deck.data.title}
        width={400}
        height={300}
      />
      <h3>{deck.data.title}</h3>
      <p>{deck.data.location}</p>
    </a>
  ))}
</div>
```

---

## 7. GHL API Integration (Stage 2)

Once your site is live and stable, integrate GoHighLevel for lead capture and CRM automation.

### 7.1 Add GHL API Key to Cloudflare

In **Cloudflare Dashboard** → **Workers** → **Settings** → **Environment Variables**:

```
GHL_API_KEY = "your-gohighlevel-api-key"
GHL_LOCATION_ID = "your-gohighlevel-location-id"
```

### 7.2 Create Lead Submission Endpoint

**src/pages/api/leads.ts**
```typescript
import { defineAction, h } from 'astro:actions';
import { z } from 'astro:content';

export const server = {
  submitLead: defineAction({
    accept: 'json',
    input: z.object({
      name: z.string().min(2),
      email: z.string().email(),
      phone: z.string().regex(/^\+?1?\d{9,15}$/),
      projectType: z.enum(['new-deck', 'remodel', 'repair']),
      squareFeet: z.number().optional(),
      message: z.string().optional(),
    }),
    handler: async (input, context) => {
      const env = context.locals.runtime.env;
      
      // Store lead in KV for backup
      await env.LEADS_KV.put(
        `lead-${Date.now()}`,
        JSON.stringify({
          ...input,
          submittedAt: new Date().toISOString(),
        }),
        { expirationTtl: 2592000 } // 30 days
      );

      // POST to GHL
      const response = await fetch(
        `https://api.gohighlevel.com/v1/contacts/`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.GHL_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            firstName: input.name,
            email: input.email,
            phone: input.phone,
            locationId: env.GHL_LOCATION_ID,
            customFields: {
              project_type: input.projectType,
              square_feet: input.squareFeet?.toString(),
              inquiry_message: input.message,
            },
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        console.error('GHL API error:', error);
        throw new Error(`Failed to create contact: ${response.statusText}`);
      }

      const ghlContact = await response.json();
      return {
        success: true,
        contactId: ghlContact.contact?.id,
        message: 'Lead submitted successfully. We\'ll contact you within 24 hours.',
      };
    },
  }),
};
```

### 7.3 Lead Form Component

**src/components/LeadForm.astro**
```astro
---
import { actions } from 'astro:actions';
---

<form id="lead-form">
  <input type="text" name="name" placeholder="Your Name" required />
  <input type="email" name="email" placeholder="Your Email" required />
  <input type="tel" name="phone" placeholder="Your Phone" required />
  
  <select name="projectType" required>
    <option>Select Project Type</option>
    <option value="new-deck">New Deck</option>
    <option value="remodel">Remodel</option>
    <option value="repair">Repair</option>
  </select>
  
  <input type="number" name="squareFeet" placeholder="Est. Square Feet" />
  <textarea name="message" placeholder="Project Details"></textarea>
  
  <button type="submit">Get Free Quote</button>
  <div id="form-status"></div>
</form>

<script>
  const form = document.getElementById('lead-form');
  const statusDiv = document.getElementById('form-status');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(form);
    const data = {
      name: formData.get('name'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      projectType: formData.get('projectType'),
      squareFeet: formData.get('squareFeet') ? parseInt(formData.get('squareFeet')) : undefined,
      message: formData.get('message'),
    };

    try {
      statusDiv.textContent = 'Submitting...';
      const result = await actions.submitLead(data);
      statusDiv.innerHTML = `<p style="color: green;">${result.message}</p>`;
      form.reset();
    } catch (error) {
      statusDiv.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
    }
  });
</script>
```

---

## Quick Reference: Deployment Checklist

- [ ] `astro.config.mjs`: `output: 'server'`, `assets.binding: 'PROJECT_ASSETS'`
- [ ] `wrangler.jsonc`: Minimal, service name matches Dashboard
- [ ] `package.json`: Name matches service name
- [ ] Local build: `npm run build` → Check `dist/client` exists
- [ ] Local test: `npm run preview` → Test static & dynamic routes
- [ ] Dashboard: Build command = `npm run build`
- [ ] Dashboard: Deploy command = `rm -rf .wrangler dist && npm run build && npx wrangler deploy --assets dist/client`
- [ ] Push to GitHub: Automatic deployment triggers
- [ ] Verify: Dashboard shows "Success" with green checkmark

---

## Performance Targets

With this setup, you should achieve:

| Metric | Target |
|--------|--------|
| Homepage load (prerendered) | <500ms (TTFB <100ms) |
| Deck portfolio pages (prerendered) | <300ms |
| Lead form submission (server) | <2s (including GHL API call) |
| Image optimization (build-time) | -30% file size |
| Edge caching | 24 hours default |

---

## Reference Links

- [Astro 6 Beta Docs](https://docs.astro.build/)
- [Astro + Cloudflare Adapter](https://docs.astro.build/en/guides/integrations-guide/cloudflare/)
- [Astro Actions](https://docs.astro.build/en/guides/actions/)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/configuration/)

---

**Last Updated:** February 27, 2026  
**Astro Version:** 6.0.0-beta.17  
**Cloudflare Adapter:** 13.0.0-beta.11  
**Status:** ✅ Production-Ready
