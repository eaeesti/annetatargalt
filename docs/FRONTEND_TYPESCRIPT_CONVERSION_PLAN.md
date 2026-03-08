# Frontend TypeScript Conversion Plan

## Current State

- **~78 JavaScript files** in `src/` (`.js` only, no `.jsx`)
- TypeScript, `@types/react`, `@types/react-dom`, `@types/node` already installed
- Next.js App Router, Tailwind CSS, SWR
- Vitest unit test suite (70 tests) covering all converted utils
- All CMS data flows: Strapi API → server component → props → child components

### Completed

- ✅ **Phase 0** — `tsconfig.json`, `next.config.ts`, `type-check` script, Vitest setup
- ✅ **Phase 1** — 7 pure utils converted (`string`, `array`, `object`, `estonia`, `react`, `seo`, `donation`) + tests
- ✅ **Phase 2** — `utils/strapi.ts` (API layer) + `utils/proportions.ts` + tests
- ✅ **Phase 3** — 4 icons + 9 elements converted. `Button` pulled in early (was Phase 5)
- ✅ **Phase 4** — Modal + 16 form components converted. `setValidity` typed as `React.Dispatch<React.SetStateAction<Record<string, boolean>>>`

---

## Auto-generated Strapi Types

**`scripts/generate-strapi-types.mjs`** reads all `backend/src/api/*/content-types/**/*.json` and `backend/src/components/**/*.json` and generates `frontend/src/types/generated/strapi.ts`.

Output: 50 TypeScript interfaces/types covering every CMS entity, component, and section. The `StrapiSection` discriminated union is generated from the `dynamiczone` attribute lists in the CMS schemas — it automatically includes new sections when schemas change.

**Do not edit `frontend/src/types/generated/strapi.ts` manually.**

### Auto-run hooks

The generator runs automatically via npm lifecycle hooks in `backend/package.json`:
- `predevelop` — runs before `yarn develop` (Strapi dev server)
- `prebuild` — runs before `yarn build` (Strapi production build)

Manual trigger from repo root: `yarn generate-types`

### Adding a new section

1. Add the component schema in Strapi admin (or create the JSON file in `backend/src/components/sections/`)
2. Run `yarn generate-types` (or restart Strapi dev — it runs automatically)
3. Create the React component in `frontend/src/components/sections/`, extending the generated interface:
   ```tsx
   import type { StrapiNewSection, StrapiGlobal } from "@/types/generated/strapi";

   interface NewSectionProps extends StrapiNewSection {
     global: StrapiGlobal;
   }

   export default function NewSection({ title, global }: NewSectionProps) { ... }
   ```
4. Done — Section.tsx dispatches it dynamically, no registry change needed.

---

## Key Challenges

### 1. Dynamic section `require()` in `Section.js`

```js
const Component = require(`./sections/${componentName}`).default;
```

The dynamic `require()` is kept as-is to preserve the "add component and you're done" workflow. TypeScript allows `require()` — it just needs a single type cast in `Section.tsx` that never changes:

```tsx
// One permanent cast — Section.tsx never needs updating for new sections
const mod = require(`./sections/${componentName}`) as { default: React.ComponentType<Record<string, unknown>> };
const Component = mod.default;
```

`section` is typed as `StrapiSection` (the generated discriminated union), so `Page.tsx` and the rest of the data flow are fully typed. Type safety for individual sections is enforced at the component definition level, not at the dispatcher.

### 2. `Proportions` class ✅ resolved

Used a single `ProportionEntry` interface with all optional fields rather than a generic type parameter. The recursive `proportions?: Proportions` field is typed as optional. This is simpler and works well since `strict: false` means the compiler doesn't force exhaustive null-checks on the nested structure.

```ts
interface ProportionEntry {
  locked: boolean;
  proportion: number;
  toFund?: boolean;
  fund?: boolean;
  proportions?: Proportions;
}
```

### 3. `Button` component `...rest` spread

```js
export default function Button({ text, type, size, ..., ...rest }) {
```

When rendered as `<button>`, `rest` should be `React.ComponentPropsWithoutRef<"button">`. When rendered as `<Anchor>` (link), it passes `rest` to Anchor. The prop interface needs to handle both cases — likely via an overload or union type.

---

## Phases

### ✅ Phase 0: Infrastructure (done)

**Goal:** Get `yarn type-check` running with zero changes to business logic.

1. Add `tsconfig.json`:
```json
{
  "extends": "next/typescript",
  "compilerOptions": {
    "strict": false,
    "noImplicitAny": false,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

Start with `strict: false` — enable per-phase once the files are converted.

2. Add to `package.json`:
```json
"type-check": "tsc --noEmit"
```

3. Rename `next.config.js` → `next.config.ts` and convert to ESM:
```ts
import type { NextConfig } from "next";
const nextConfig: NextConfig = { /* ... */ };
export default nextConfig;
```

4. Verify: `yarn type-check` passes, `yarn build` still works.

---

### ✅ Phase 1: Pure Utilities (done)

**Goal:** Convert pure functions — no JSX, no React. Easiest files. Strapi types come from the auto-generated file, so no manual type definitions needed.

| File | Notes |
|---|---|
| `utils/string.ts` | String formatting, template substitution |
| `utils/array.ts` | Generic array helpers |
| `utils/object.ts` | `at()`, `pick()` — needs generic type params |
| `utils/estonia.ts` | Amount formatting, Estonian ID validation |
| `utils/react.ts` | `classes()` helper — `(...args: (string | false | null | undefined)[]) => string` |
| `utils/seo.ts` | `buildMetadata()` — takes `StrapiGlobal` + `StrapiMetadata` from generated types |
| `utils/donation.ts` | `makeDonationRequest()` — return type `Promise<Response>` |

---

### ✅ Phase 2: Strapi API + Proportions (done)

**Goal:** Type the data-fetching layer and the complex Proportions class.

**`utils/strapi.ts`:**
- `fetchAPI<T>(path, params, options): Promise<T>` — generic return type
- Each fetch function typed with the generated interfaces:
  ```ts
  import type { StrapiGlobal, StrapiPage, StrapiSpecialPage } from "@/types/generated/strapi";

  export async function getGlobal(): Promise<StrapiGlobal>
  export async function getPageBySlug(slug: string): Promise<StrapiPage>
  export async function getSpecialPages(): Promise<StrapiSpecialPage[]>
  // ...
  ```

**`utils/proportions.ts`:**
- The most complex conversion. Use generic type parameter as described in Key Challenges.
- The recursive `proportions.proportions` pattern is the main challenge.
- Consider whether `Proportions<CauseEntry>` accurately captures the two-level structure, or if two separate classes are cleaner.

---

### ✅ Phase 3: Icon + Simple Element Components (done)

**Goal:** Leaf components with minimal or no props complexity.

**Icons** (3 files — each is a React component wrapping an SVG, trivial to type):
- `icons/InfoIcon.tsx`, `icons/LockedIcon.tsx`, `icons/UnlockedIcon.tsx`

**Simple elements:**
- `elements/Spinner.tsx` — likely no props
- `elements/Markdown.tsx` — `{ children: string; className?: string }`
- `elements/Anchor.tsx` — extends `React.AnchorHTMLAttributes<HTMLAnchorElement>`
- `elements/Image.tsx` — wraps Next.js Image with `StrapiMedia` prop (from generated types)
- `elements/Breadcrumbs.tsx` — uses `StrapiBreadcrumb[]` from generated types
- `elements/SocialMediaIcon.tsx` — uses `StrapiSocialMediaLink` from generated types
- `elements/CopyButton.tsx`
- `elements/Summary.tsx`

Pattern for elements that extend HTML elements:
```tsx
interface AnchorProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  newTab?: boolean;
}
```

---

### ✅ Phase 4: Form Components + Modal (done)

**Goal:** Type all form inputs and the Modal component.

Form components share a common pattern — they receive a value, a setter, and validity callback:

```tsx
interface TextInputProps {
  label: string;
  value: string;
  setValue: (value: string) => void;
  setValidity?: (validity: Record<string, boolean>) => void;
  // ...
}
```

Files:
- `elements/forms/TextInput.tsx`, `TextareaInput.tsx`
- `elements/forms/AmountChooser.tsx`
- `elements/forms/BankChooser.tsx` — uses `StrapiBankIcon[]` from generated types
- `elements/forms/CheckboxInput.tsx`
- `elements/forms/CompanyInput.tsx`
- `elements/forms/DedicationInput.tsx`
- `elements/forms/DonationTypeChooser.tsx`
- `elements/forms/EmailInput.tsx`
- `elements/forms/IdCodeInput.tsx`
- `elements/forms/NameInput.tsx`
- `elements/forms/OrganizationChooser.tsx` — uses `StrapiCause[]` from generated types
- `elements/forms/PaymentMethodChooser.tsx`
- `elements/forms/PaymentSummary.tsx`
- `elements/forms/Slider.tsx`
- `elements/forms/Steps.tsx`
- `Modal.tsx`

---

### ✅ Phase 5: Section Components (done)

**Goal:** Type all section components using the generated interfaces.

Each section extends its generated interface and adds the passthrough props:

```tsx
import type { StrapiDonationSection, StrapiGlobal, StrapiPage } from "@/types/generated/strapi";

interface DonationSectionProps extends StrapiDonationSection {
  global: StrapiGlobal;
  page: StrapiPage;
}

export default function DonationSection({ title, amount1, global, page }: DonationSectionProps) { ... }
```

All CMS fields are already typed in the generated interface. No manual field declarations needed.

Start with the simpler sections (text, header) before tackling `DonationSection` (the most complex) and `ForeignDonationSection`.

Files (25 total, sections + elements):
- Simple: `TextSection`, `HeaderSection`, `LoadingSection`, `SpecialHeaderSection`, `RedirectSection`
- Medium: `HeroSection`, `CtaSection`, `EntityTextSection`, `BlogHeaderSection`
- Complex: `DonationSection`, `ForeignDonationSection`
- Content: `BlogPostsSection`, `CausesSection`, `CauseOrganizationsSection`, `OrganizationsSection`, `OrgHeaderSection`, `OrganizationCtaSection`
- Other: `ContactSection`, `FaqSection`, `PartnerSection`, `PowerSection`, `StatsSection`, `TeamSection`, `TestimonialsSection`, `ThankYouSection`, `CampaignSection`
- `elements/DonationSummary.tsx`
- `elements/Organization.tsx`
- `elements/Button.tsx` — the `...rest` challenge (see Key Challenges above)

---

### ✅ Phase 6: Layout + Page (done)

**Goal:** Type the top-level structural components and `Section.tsx` (the dynamic dispatcher).

**`Section.tsx`:** Keep dynamic `require()` with a single permanent type cast (see Key Challenges). `section` prop typed as `StrapiSection`:

```tsx
import type { StrapiSection, StrapiGlobal, StrapiPage, StrapiCause, StrapiOrganization, StrapiBlogPost } from "@/types/generated/strapi";

interface SectionProps {
  section: StrapiSection;
  global: StrapiGlobal;
  page: StrapiPage;
  entity?: StrapiCause | StrapiOrganization | StrapiBlogPost;
}
```

**`Page.tsx`:** Receives `page`, `global`, `entity` — all from generated types.

**`Navbar.tsx`**, **`Footer.tsx`**, **`Banner.tsx`**: Receive subsets of `StrapiGlobal`.

---

### Phase 7: App Layer (2–3 hours)

**Goal:** Type Next.js route files and metadata.

```tsx
// app/[[...slug]]/page.tsx
interface PageParams {
  slug?: string[];
}

export async function generateMetadata(
  { params }: { params: Promise<PageParams> }
): Promise<Metadata> { ... }

export default async function SlugPage(
  { params }: { params: Promise<PageParams> }
) { ... }
```

Files:
- `app/layout.tsx`
- `app/[[...slug]]/page.tsx`
- `app/[[...slug]]/not-found.tsx`
- `app/robots.ts`
- `app/sitemap.ts`
- `app/manifest.ts`

---

### Phase 8: Strict Mode (1–2 hours)

Enable strict mode in `tsconfig.json`:
```json
{
  "compilerOptions": {
    "strict": true
  }
}
```

Fix any new errors — most likely `strictNullChecks` violations from Strapi fields that can be `null`.

---

## Verification

After each phase:
```bash
yarn type-check   # must stay clean as we go
yarn build        # must succeed
yarn develop      # sanity-check in browser
```

Final target:
- `yarn type-check`: 0 errors (`strict: true`)
- `yarn build`: successful production build

---

## File Count Summary

| Category | Files | Phase |
|---|---|---|
| tsconfig + config | 2 | 0 |
| Pure utils | 7 | 1 |
| Strapi API + Proportions | 2 | 2 |
| Icons + simple elements + Button | 13 | 3 |
| Form components + Modal | 16 | 4 |
| Section components + elements | 24 | 5 |
| Layout + Page + Section | 5 | 6 |
| App layer | 6 | 7 |
| **Total** | **~73** | |

**Types file:** auto-generated by `scripts/generate-strapi-types.mjs` — not counted above, not manually edited.
