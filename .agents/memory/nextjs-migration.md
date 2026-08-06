---
name: Next.js migration patterns
description: How the original Vite+Express Senedd Tracker was migrated to Next.js 15 App Router; adaptation rules to follow when touching UI files
---

## React Router → Next.js adaptations
- `useNavigate()` → `useRouter()` from `next/navigation`; `navigate(path)` → `router.push(path)`
- `useParams()` → `useParams()` from `next/navigation` (in client components, returns `{ id: string }` directly)
- `Link to="..."` → `Link href="..."` from `next/link`
- `NavLink` active state → `Link` + `usePathname()` check
- `useLocation()` → `usePathname()` from `next/navigation`
- No `BrowserRouter` wrapper — Next.js handles routing natively

## SSR safety
- All pages with hooks/browser APIs must have `"use client"` at top
- `ThemeProvider` and `I18nProvider` read `localStorage` only in `useEffect` (not at module level or in useState initializer) to avoid SSR mismatches
- HTML element initialized with `data-theme="dark"` (the app's default)
- `suppressHydrationWarning` on `<html>` handles theme mismatch between server/client

## File layout
- `app/globals.css` — full 2486-line CSS (from `frontend/src/ui/styles.css`)
- `lib/i18n/translations.ts` — full EN + CY string maps
- `lib/api.ts` — client-side API helpers matching backend response shapes
- `contexts/` — ThemeContext, I18nContext, ToastContext (all "use client")
- `components/Shell.tsx` — nav + footer + scroll-to-top
- `components/Providers.tsx` — wraps Theme + I18n + Toast providers

**Why:** The previous migration agent replaced original UI with simplified stubs. These patterns are needed whenever touching UI files to preserve the original design.
