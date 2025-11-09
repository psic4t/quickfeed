# Agent Guidelines for quickfeed

## Commands

- **Build**: `npm run build`
- **Dev**: `npm run dev`
- **Lint**: `npm run lint` (fix with `npm run lint:fix`)
- **Type check**: `npm run check`
- **Test**: `npm run test` (single test: `npm run test -- filename.test.ts`)
- **Format**: `npm run format`

## Code Style

- **TypeScript**: Strict mode enabled, use explicit types
- **Imports**: Use `$lib/` for internal imports, external imports at top
- **Formatting**: Prettier with single quotes, semicolons, 100 char width
- **Svelte**: Order: options-scripts-markup-styles, use `<script lang="ts">`
- **Naming**: camelCase for variables, PascalCase for components/types
- **Error handling**: Use try/catch, avoid `any` (warned by ESLint)
- **Performance**: Use `contain: strict` for feed items, virtual scrolling
- **Testing**: Vitest with jsdom, setup in `src/test/setup.ts`

## Project Structure

- Components in `src/lib/components/`
- Types in `src/lib/types.ts`
- Config in `src/lib/config.ts`
- Routes in `src/routes/`

## Mobile Viewport Implementation

**Problem**: Profile Pic and "View JSON" button not visible on mobile browsers due to viewport height issues with browser address bar.

**Solution**: CSS-based safe area padding using `env()` variables and dynamic viewport height.

**Key Changes**:
- `app.html`: Added `viewport-fit=cover` to meta viewport tag
- `MediaItem.svelte`:
  - Uses `100dvh` instead of `100vh` for dynamic viewport height
  - Added CSS custom properties: `--safe-area-inset-bottom: env(safe-area-inset-bottom, 0px)`
  - Bottom overlay padding: `calc(2rem + var(--safe-area-inset-bottom) + var(--mobile-browser-height))`
  - 60px estimated browser height added to account for mobile browser UI

**Browser Support**: Modern browsers (Chrome 108+, Safari 16+) with fallbacks for older browsers.

**Testing**: Verify Profile Pic and JSON button visibility on iOS Safari, Android Chrome, and PWA mode.

When you need to search docs, use `context7` tools.
