# Testimonials Setup

Simple, lean testimonials implementation using Astro Content Layer.

## Structure

- **`src/content/reviews/reviews.json`** - Simplified review data (author, rating, text, date, avatar, source)
- **`src/content.config.ts`** - Content collection schema with validation
- **`src/components/TestimonialCard.astro`** - Individual review card
- **`src/components/TestimonialsMasonry.astro`** - Masonry grid layout
- **`public/google-logo.svg`** - Source indicator logo

## How It Works

1. **Content Layer loads reviews** from the JSON collection at build time
2. **Type-safe schema** ensures data consistency
3. **Masonry layout** automatically adjusts to screen size (CSS Grid)
4. **Image optimization** handled by Cloudflare's `imageService: 'compile'`
5. **Zero client-side JS** - purely static HTML

## Adding Reviews

Edit `src/content/reviews/reviews.json` and add a new object:

```json
{
  "author": "Customer Name",
  "rating": 5,
  "text": "Review text here...",
  "date": "2026-02-20",
  "avatarUrl": "https://image-url.com/avatar.jpg",
  "source": "Google"
}
```

All fields are validated at build time.

## Using in Pages

```astro
---
import TestimonialsMasonry from '../components/TestimonialsMasonry.astro';
---

<TestimonialsMasonry />
```

## Image Optimization

- **Build-time compilation** via `imageService: 'compile'`
- **External domains** whitelisted: `images.stokeleads.com`
- **Fallback avatars** use initials if no image URL
- Serves AVIF/WebP automatically to modern browsers
