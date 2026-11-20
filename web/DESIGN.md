# Pantry design rules

Adapted from the Arcane Gather design language in `escalation-league`
(`.claude/rules/frontend-*.md`, `docs/design/`). The rules carry over; the
brand does not. This app is light, spruce green and shelf-tag yellow, set in
Archivo.

## Tokens

- All colours, radii, shadows, spacing and type sizes are tokens in
  `src/ui/tokens.css`. Component CSS uses `var(--token)` and nothing raw.
- No fallback values: `var(--bg-card)`, never `var(--bg-card, #fff)`.
- Type sizes come from `--step-*`. Headings that should look like ticket
  numerals take the `.display` class (narrow, heavy Archivo).

## Which button

Always `<Button variant>` from `src/ui/Button.tsx`, never a bare `<button>`
with its own styling.

| Variant | Use |
|---|---|
| `cta` | The single most important action on a screen. At most one. |
| `primary` | Confirms a form or dialog. |
| `secondary` | Other actions beside a primary or cta. The default. |
| `ghost` | Low-emphasis actions repeated per row: undo, cancel, steppers. |
| `danger-outline` | Opens a destructive flow. |
| `danger` | Confirms the destructive action, inside `ConfirmDialog`. |
| `link` | A row's title that opens that row. Never wrap a whole row in a button. |

A button label says what happens, and the toast that follows uses the same
words: "Add shelf" gives "Shelf added".

## Other primitives (`src/ui/`)

- **Badge**: status pills. The text carries the meaning; colour reinforces it.
- **ResponsivePanel**: every dialog. Modal from 768px, bottom sheet below.
  Never hand-roll a dialog, an Escape handler or a focus trap.
- **ConfirmDialog**: every destructive confirmation. No `window.confirm`.
- **FormField**: every labelled input or select. Errors attach to their
  field. Toolbar controls still get a label, visually hidden.
- **Segmented**: pick one of a few. It wraps; it never scrolls sideways.
- **EmptyState / SkeletonRows**: empty and loading screens. No "Loading" text.

## Showing errors and results

| Situation | Use |
|---|---|
| Result of something the person just did | Toast (`useToast`). Errors stay 10s. |
| A page failed to load | `ErrorAlert` with a retry. Never a reload. |
| A form field is wrong | The field's own error, via `FormField`. |

The scan list is the one exception: scan results land in the list, where
the volunteer is already looking. Never swallow a `catch`.

## Phone first

- Design for 360px. Touch targets are at least `--touch` (44px).
- The section nav and dialog actions sit at the bottom, at the thumb.
- Nothing may need sideways scrolling. The browser tests assert this.
- Every animation is switched off under `prefers-reduced-motion`.

## Tests

A new or changed flow extends the happy path in `e2e/pantry.spec.ts`, which
runs at phone and desktop widths (`npm run test:e2e`).
