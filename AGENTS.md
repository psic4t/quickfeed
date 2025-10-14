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
