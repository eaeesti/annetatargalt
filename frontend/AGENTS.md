# Frontend — Agent Guide

Next.js (App Router) + TypeScript. Source in `src/`.

```bash
yarn develop    # Next.js dev server on port 3000
yarn build      # production build
yarn lint       # ESLint
yarn type-check # tsc --noEmit (once tsconfig.json exists)
```

See root [AGENTS.md](../AGENTS.md) for shared TypeScript conventions.

## Source Layout

```
src/
├── app/
│   ├── layout.tsx                  # root layout (global nav, fonts)
│   ├── [[...slug]]/page.tsx        # catch-all route — fetches CMS page by slug
│   ├── manifest.ts / robots.ts / sitemap.ts
│   └── ...
├── components/
│   ├── Page.tsx                    # renders a page's sections dynamically
│   ├── Navbar.tsx / Footer.tsx / Banner.tsx
│   ├── Modal.tsx / Section.tsx
│   ├── elements/                   # small reusable components (Button, Image, etc.)
│   │   └── forms/                  # form input components
│   ├── icons/                      # SVG icon components
│   └── sections/                   # full-page sections rendered from CMS content
└── utils/
    ├── strapi.ts                   # all Strapi API fetch functions
    ├── donation.ts                 # donation request helpers
    ├── estonia.ts                  # Estonian ID code / amount formatting
    ├── string.ts                   # string formatting utilities
    ├── object.ts / array.ts        # generic helpers
    ├── proportions.ts              # donation proportion logic
    └── seo.ts                      # metadata builder
```

## Path Alias

`@/` maps to `src/`. Always use it for imports within `src/`:
```ts
import { formatEstonianAmount } from "@/utils/estonia";
```

## File Extensions

- `.tsx` for any file that contains JSX (components, pages)
- `.ts` for pure TypeScript (utils, types, no JSX)

## Server vs Client Components

Next.js App Router defaults to **server components**. Explicitly opt in to client rendering:

```tsx
"use client";  // must be the very first line
```

Rules:
- Server components: `async function`, can `await` data fetches directly, no hooks.
- Client components: `"use client"`, can use hooks (`useState`, `useEffect`, `useRouter`, SWR), no top-level `await`.
- Sections that use state or event handlers are client components (`DonationSection`, etc.).
- Sections that only render CMS data are server components.

## Component Conventions

All components are function declarations with a named default export:

```tsx
export default function MyComponent({ title, count }: MyComponentProps) {
  // ...
}
```

Props:
- Define props as a named `interface` in the same file: `interface MyComponentProps { ... }`
- Use destructuring in the function signature (not `props.foo` everywhere).
- Strapi CMS fields are `string | null` — handle nulls at the component boundary with `??` fallbacks.
- Children typed as `React.ReactNode`.

Avoid:
- `React.FC<Props>` — prefer explicit `function` declarations.
- Inline prop types — use a named interface.
- `props.something` style — destructure in the signature.

## Strapi API Layer (`utils/strapi.ts`)

All Strapi fetches go through `fetchAPI(path, urlParamsObject, options)`. The CMS API is Strapi v5:
- Collection types return `{ data: Item[] }` — always guard `response.data?.length`.
- Single types return `{ data: Item }` — access as `response.data`.
- Relations are returned as arrays directly (no `{ data: [...] }` wrapper on relations in v5).
- All CMS fields are potentially `null` or `undefined` — type them accordingly.

Define typed interfaces for Strapi responses rather than using `any`:
```ts
interface StrapiPage {
  id: number;
  documentId: string;
  slug: string | null;
  title: string | null;
  metadata: StrapiMetadata | null;
  // ...
}
```

## SWR (Client-side Fetching)

Used only in client components that need real-time or user-triggered data. Server components fetch directly with `await`.

## Tailwind CSS

All styling via Tailwind utility classes. No CSS modules or styled-components. The `@/` alias works in `className` strings via the tailwind config.
