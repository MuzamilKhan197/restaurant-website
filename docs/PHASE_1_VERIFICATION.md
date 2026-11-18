# Phase 1 verification

Verified on 16 November 2026.

## Automated checks

- TypeScript strict type check: passed.
- ESLint: passed with no errors or warnings.
- Prettier source formatting: passed.
- New foundation tests: 10 passed (menu search/filter recovery, preserved sample
  prices, public configuration validation and private-key exclusion).
- Previous application tests: all 30 passed against isolated test databases.
- Next.js production build: passed, including static route generation.
- HTTP smoke checks: customer pages, menu detail, workspace, design system,
  upcoming-module pages and health endpoint returned 200; unknown URL returned 404.

## Browser checks

- Desktop storefront and workspace rendered correctly with local images/fonts.
- Menu search returned the expected dish; unmatched search showed an empty state;
  resetting restored the catalogue.
- Customer mobile layout and navigation were checked at 390 × 844.
- Workspace mobile overview rendered without horizontal page overflow.
- Shared primary action changed state.
- Dialog moved focus inside, closed with Escape and returned focus to its trigger.
- Workspace section finder filtered and navigated to the correct section.
- Planned sections clearly identify their phase and do not imply database access.

## Scope boundary

The new Next.js workspace does not read the legacy SQLite database and contains
no customer records. Supabase, authentication, RLS, transactions and business
workflows remain in their approved later phases. The original files and data
remain preserved; no operational data was migrated or deleted.
