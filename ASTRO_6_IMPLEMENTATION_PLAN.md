# Astro 6 Implementation Plan

## Project Context
Local deck builder with Cloudflare Workers deployment and upcoming integrations with GoHighLevel (GHL) and MoreGoodReviews.

---

## ✅ Highly Relevant (IMPLEMENT NOW)

### 1. Redesigned astro dev (workerd integration)
**Status:** Critical foundation
- Local development runs on same engine (workerd) as production
- Ensures local environment and production environment are in sync
- Already partially in place with Cloudflare deployment

### 2. Accessing Cloudflare Bindings via cloudflare:workers
**Status:** Priority implementation
- Import `env` directly from `cloudflare:workers`
- Type-safe access to API keys and KV namespaces
- Works both locally and in production
- Use case: KV for sessions, GHL secrets

### 3. Content Layer (Stable Collections)
**Status:** Priority implementation
- Stabilized loaders for 80+ deck photos and reviews
- Faster and more reliable collections
- Supports Stage 2 (Static Portfolio) and Stage 4 (API-driven social proof)

### 4. Node 22 Requirement
**Status:** Already configured
- Cloudflare NODE_VERSION set to 22
- Dropped support for Node 18 & 20

### 5. Removal of Legacy APIs
**Status:** Already aligned
- No longer using Astro.glob()
- No longer using Astro.locals.runtime
- Using new environment API instead

---

## ⚠️ Relevant for Stage 4 (FUTURE)

### Live Collections
**Status:** Future implementation (Stage 4)
- Real-time updates without full site rebuild
- Use case: MoreGoodReviews API integration
- Allows dynamic review updates as customers leave reviews
- Consider implementing when moving to Stage 4

---

## ❌ Overkill (SKIP)

### Content Security Policy (CSP)
**Reason:** Risk of breaking third-party scripts (GHL tracking, Review widgets). Save after site is fully functional.

### Durable Objects & R2 Storage
**Reason:** Not needed for lead-capture and portfolio site with 80 images. Static assets are faster and cheaper at this scale.

### Workers Analytics Engine
**Reason:** Use standard Google Analytics or GHL tracking instead.

---

## Next Steps
- [ ] Implement Cloudflare bindings access pattern
- [ ] Verify/stabilize Content Layer collections
- [ ] Test workerd integration locally
- [ ] Document environment setup for team
