# Shared UI foundation: Wildberries pilot

The first migration covers the three navigation links in the Wildberries page
header and the synchronization button. Product tables, synchronization requests,
cooldowns, calculations, authentication and other marketplaces are unchanged.

## Where to change appearance

- `app/ui/tokens.css`: shared control dimensions, typography, spacing, radius,
  motion and focus settings. It also holds WB theme values for the migrated
  controls. Existing `--ws-*` colors are a compatibility bridge, not a second
  implementation of the new controls.
- `app/ui/Button.module.css`: shared button/link appearance and native states.
- `app/ui/Button.tsx`: a native button. Defaults to `type="button"`; retains
  native props, event handlers, disabled state and refs.
- `app/ui/ButtonLink.tsx`: a Next.js link with the same secondary-control style.
  Navigation remains a link rather than an onClick handler on a button.

The root layout imports the tokens once. They do not restyle legacy elements.
The migrated page opts into semantic theme tokens with `workspace-ui`.
The old WB button selectors are removed rather than overridden by another
global stylesheet. Icon animation and synchronization layout remain on WB.

## Scope of a change

Changing `--ui-control-radius` updates all four migrated controls. Changing
primary colors affects the synchronization button, not secondary navigation.
Other pages start using these settings only after their controls are migrated.
Changing this file does not automatically migrate existing markup or tables.

## Review before merging

Compare WB before/after in light and dark themes at 1920px and 1366px, and check
the existing 1050px and 650px layout breakpoints. Check navigation hrefs, visible
keyboard focus, synchronization idle/loading/disabled/error states, and table
collapse/sorting. Change the radius token temporarily and verify all four
controls respond, then restore the original value.

TypeScript and targeted ESLint checks pass. An initial production build compiled
successfully but stopped while prerendering `/admin` because this environment
has no `NEXT_PUBLIC_SUPABASE_URL`. Browser verification is pending: the local
Chromium installation is unavailable, and the download failed. Do not treat a
successful compile as confirmation of visual equivalence or live sync behavior.
