---
paths:
    - 'web/**'
---

# Frontend Design

The design rules are in `web/DESIGN.md`: tokens only, which `<Button>` variant
to use, the primitives in `web/src/shared/ui/`, how errors and results are
shown, phone first at 360px. Read it before changing anything under `web/`.

The must-know lines:

- No raw colours, radii, shadows or sizes in component CSS, and no fallback
  values: `var(--bg-card)`, never `var(--bg-card, #fff)`.
- Always `<Button variant>`, `ResponsivePanel`, `ConfirmDialog`, `FormField`.
  Never a bare styled `<button>`, a hand-rolled dialog or `window.confirm`.
- Result of an action: toast. Failed page load: `ErrorAlert` with a retry.
  Wrong field: that field's own error. Never swallow a `catch`.
- Nothing may scroll sideways at 360px. The browser tests assert it.
- A new or changed flow extends `e2e/pantry.spec.ts`.

Folder layout and import rules: `.claude/rules/module-conventions.md`.
