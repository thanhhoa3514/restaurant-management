# Apple — Glass / Soft-Futurism Reference

Reference DESIGN.md for premium consumer software with translucent surfaces. SF Pro everywhere, system tints sparingly, vibrancy materials over solid fills.

## 1. Visual Theme & Atmosphere

Soft futurism. Frosted vibrancy materials, layered translucency, SF Pro at every size, system tints used as accent rather than fill. Hardware-adjacent — every surface implies physical depth.

Mood: calm, premium, trustworthy.

## 2. Color Palette & Roles

```
/* light */
--bg:                  #ffffff
--bg-elevated:         #ffffff
--surface-grouped:     #f2f2f7
--separator:           rgba(60,60,67,0.18)
--text:                #1d1d1f
--text-secondary:      rgba(60,60,67,0.78)
--text-tertiary:       rgba(60,60,67,0.55)

/* dark */
--bg-dark:             #000000
--bg-elevated-dark:    #1c1c1e
--surface-grouped-dark:#2c2c2e
--separator-dark:      rgba(84,84,88,0.65)

/* system tints (use sparingly, one per surface) */
--system-blue:         #007aff
--system-green:        #34c759
--system-red:          #ff3b30
--system-orange:       #ff9500
--system-purple:       #af52de
--system-pink:         #ff2d55
--system-yellow:       #ffcc00

/* vibrancy materials (alpha over backdrop blur) */
--material-thin:       rgba(255,255,255,0.6)
--material-regular:    rgba(255,255,255,0.78)
--material-thick:      rgba(255,255,255,0.92)
```

Rule: pick one system tint per surface and use it for the primary action only. Materials replace solid fills on overlays, navigation bars, sidebars.

## 3. Typography Rules

- **All UI + body:** `SF Pro Text` (≤19px), `SF Pro Display` (≥20px). Fallback `system-ui`.
- **Mono / code:** `SF Mono`, fallback `Menlo`.
- Use Apple's optical sizing — never disable `font-optical-sizing`.

Scale: 11 / 12 / 13 / 15 / 17 / 22 / 28 / 34 / 44 / 56 (matches Apple HIG).

Body 17px on touch, 13px on dense desktop.

## 4. Component Stylings

**Buttons**
- Primary: `--system-blue` fill, white text, radius 12, padding 10/20, weight 600.
- Bordered: clear fill, 1px `--system-blue`, blue text.
- Plain: text-only blue, no border.

**Cards / sections**
- `--bg-elevated` fill (light) or `--bg-elevated-dark` (dark), radius 14, no border.
- Grouped lists: `--surface-grouped`, separator hairline between rows.

**Sheets / modals**
- `--material-regular` over backdrop blur 30px. Rounded top corners 16px. Detents at 50% / 100%.

**Inputs**
- `--surface-grouped` fill, no border, radius 10, padding 11/14.
- Focus: 4px outer halo using current system tint at 18% alpha.

**Navigation**
- Nav bars use `--material-thin` over content. Title type weight 600. Large-title pattern: 34px → 17px on scroll.

## 5. Layout Principles

- Touch targets ≥44pt. Desktop dense ≥28pt.
- 8pt base unit. 4 / 8 / 12 / 16 / 20 / 24 / 32 / 44 / 56 / 80 scale.
- Safe-area inset everywhere on mobile. Edge-to-edge content; chrome floats above.

## 6. Depth & Elevation

Material layering replaces shadows on iOS. macOS uses subtle `0 1px 0 rgba(0,0,0,0.04)` divider plus material backdrop. Never drop-shadow over a material — defeats the blur.

## 7. Do's and Don'ts

**Do**
- Use one system tint per screen for primary action.
- Apply `backdrop-filter: blur(30px) saturate(180%)` on translucent surfaces.
- Honor SF Pro optical sizing thresholds (Text ≤19px, Display ≥20px).

**Don't**
- Mix system tints on the same surface.
- Replace SF Pro with Inter — kills the platform feel instantly.
- Drop-shadow buttons, cards, or inputs.
- Use hard 1px borders on cards; use radius + material instead.

## 8. Responsive Behavior

- iOS: sheet detents adapt to content height. Large-title shrinks on scroll.
- macOS: sidebar uses `NSSplitViewController` ratios — 240/flex.
- iPadOS: column layouts collapse on size class transitions.
- Web/PWA: prefer `env(safe-area-inset-*)` and `@media (prefers-color-scheme)`.

## 9. Agent Prompt Guide

Bias: SF Pro everywhere with optical-size respect, system tints as accent (one per surface), vibrancy materials over solid fills, 12/14 radius, no card borders.

Reject: Inter substitution, multi-tint surfaces, shadowed cards, Material Design ripples, hard 1px borders on cards.

## 10. Icon Usage (SF Symbols)

- **Use SF Symbols exclusively** for all icons — never emoji (🚀🎨⚙️) as UI elements.
- Consistent sizing: use SF Symbol scale hierarchy — `.small` / `.medium` / `.large` rather than arbitrary pt values.
- Brand logos: use official vector when available; never guess or use incorrect paths.
- Hover/active icon states: use `opacity` or `weight` transitions — never `scale` transforms that shift layout.

## 11. Interaction & Microfeedback

- `cursor-pointer` on every tappable/clickable element (buttons, cards, list rows, menu items).
- Hover states: tint background or increase opacity; never use scale transforms that cause layout shift.
- Transition timing: 150–300ms with `ease-in-out` or `ease` curve. Instant jumps or >500ms feel sluggish.
- Focus ring: use system tint at 18% alpha, 4px offset — consistent with input focus style.
- Disabled state: `--text-tertiary` fill, no pointer events.

## 12. Accessibility (a11y) Requirements

- All non-decorative images must have descriptive `alt` text.
- Form inputs require explicit labels (not placeholders alone).
- Color is never the sole differentiator — pair with shape, text, or icon.
- Minimum contrast: body text ≥4.5:1, large text ≥3:1 against background.
- Touch targets ≥44pt (apple.md §5 already enforces this).
- Respect `prefers-reduced-motion` — disable parallax, scale animations, and material transitions.
- Keyboard navigation: all interactive elements reachable and activatable without pointer.
- `prefers-color-scheme` media query required for web/PWA exports.

## 13. Pre-Delivery Checklist

Before marking any Apple-glass implementation complete, verify:

- [ ] No emoji used as UI icons (SF Symbols only)
- [ ] All icons use consistent sizing (SF Symbol scale, not arbitrary pt)
- [ ] System tint: exactly one per surface, used for primary action only
- [ ] `backdrop-filter: blur(30px) saturate(180%)` on all translucent surfaces
- [ ] `cursor-pointer` on all interactive elements
- [ ] Hover states use opacity/tint — no layout-shifting scales
- [ ] Transitions 150–300ms
- [ ] Light-mode text ≥ `#475569` (slate-600) minimum
- [ ] No hard 1px borders on cards (radius + material instead)
- [ ] No `drop-shadow` over material surfaces
- [ ] `prefers-reduced-motion` respected
- [ ] Keyboard-focusable interactive elements
- [ ] Alt text on all non-decorative images
- [ ] Safe-area insets on mobile (`env(safe-area-inset-*)`)

## 14. Motion Tokens & Easing

Apple Glass surfaces use material-implied motion — physical, damped, never bouncy. Define easing tokens instead of freestyling cubic-bezier.

**Easing curves** (tokenize at `:root`):
```
--ease-out:    cubic-bezier(0.16, 1, 0.3, 1);   /* elements entering — decelerate */
--ease-in:     cubic-bezier(0.7,  0, 0.84, 0);   /* elements leaving  — accelerate */
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);   /* state toggles     — symmetrical */
```

**Duration buckets**:
```
--dur-micro: 120ms;   /* button press, toggle tick, colour shift        */
--dur-short: 220ms;   /* hover lift, tooltip, menu open, focus ring    */
--dur-long:  420ms;   /* modal/drawer/sheet open, page section reveal   */
```

**Principles**:
- Animate only `transform` + `opacity` (GPU-composited). Never `width`, `height`, `top`, `left`, `margin`, `padding`.
- Exits are ~75% of enter duration. A 220ms enter pairs with a 165ms exit.
- **Reduced motion is non-optional**: `@media (prefers-reduced-motion: reduce)` collapses all spatial motion to opacity crossfade at ≤150ms. Functional animations (progress, loading) still run.
- **Never** bounce / elastic / overshoot easings on UI elements — `cubic-bezier(0.34, 1.56, 0.64, 1)` is banned. Reserve spring physics only for physical interactions (drag-and-drop release, swipe-to-dismiss).
- One orchestrated page-load sequence (stagger by DOM index, cap total stagger at ~500ms). After first reveal, no more on-scroll animations — the page settles.
- No `transition: all` — always specify properties.

## 15. Interactive Element — 8-State Discipline

Every interactive element (button, link, input, toggle, card action) must define all eight states:

| State | Trigger | Treatment |
|---|---|---|
| **Default** | At rest | Base styling as defined in §4 |
| **Hover** | Pointer over | System tint background or 1px translateY(-1px). Must wrap in `@media (hover: hover)` so touch doesn't get stuck states. |
| **Focus** | Keyboard/ programmatic | `:focus-visible` ring: system tint at 18% alpha, 4px outer halo, 2–3px width, ≥3:1 contrast. **Never `:focus` alone, never animated.** |
| **Active / Press** | During press | `translateY(1px)` + darker tint. Duration 100ms. |
| **Disabled** | Not available | `--text-tertiary` fill, `opacity: 0.5`, `cursor: not-allowed`, `aria-disabled="true"`, `tabindex="-1"` |
| **Loading** | Async in-flight | Inline spinner replacing icon slot, label stays readable. Field stays editable. |
| **Error** | Failed validation | `--system-red` border or tint, error icon (SF Symbol exclamationmark.circle), message below, `aria-invalid="true"`. Never colour alone. |
| **Success** | Completed | Subtle `--system-green` indicator (checkmark.circle), auto-dismiss 2.5s. Silent success preferred — no congratulatory toast. |

**Input fields — no-layout-shift rule**: `border-width` is constant across every state (always 1px). State changes go to `background-color`, `outline`, or `box-shadow` only. A page with 1px default border and 2px focus border shifts layout on every tap — that's a tell.

**Heights**: input height = button height. Pick one base (44pt touch floor on iOS, 32pt on dense desktop) for every form control and adjacent button.

## 16. Copy & Voice

Apple Glass copy follows Apple's own restraint: specific verbs, no hype, no exclamation marks in error states.

**Buttons**: label = verb for the action. "Save changes", "Create account", "Send invitation". Never "OK", "Submit", "Click here".

**Error messages** — three parts:
1. What happened (past tense, factual). "That card was declined."
2. Why, if known. "Your bank flagged the charge."
3. What to do (imperative). "Try another card, or contact your bank."

**Empty states** — three beats:
1. One line naming what's empty. "No projects yet."
2. One line why it matters. "Projects group your tasks and team."
3. One button — the single next action. "Create Project."

**Microcopy bans**:
- "Oops!", "Uh oh!", "Something went wrong." — name the thing that broke.
- Exclamation marks in error states.
- Humour in frustration paths (forgot-password, payment-failed).
- Startup clichés: "Unleash", "Supercharge", "Reimagine", "Seamless", "Next-generation".
- Placeholder-as-label — labels go above inputs, visible always.

**Typography hygiene**:
- Curly quotes: `"Hello"` / `'word'` (never straight quotes).
- Em-dash `—` for interruption (U+2014). En-dash `–` for ranges (U+2013). Never `--`.
- Ellipsis `…` (U+2026). Never `...`.
- Non-breaking space before units: `10 kg`, `5 min`.

## 17. Focus & Interaction Accessibility

**Focus rings**:
- Use `:focus-visible` exclusively — keyboard users see the ring, pointer users don't.
- 2–3px solid outline, system tint (--system-blue at 100% or current tint), 2px offset.
- ≥3:1 contrast against both the element background and the page background.
- **Appear instantly** — never animate focus-ring opacity or width. Keyboard users need the indicator at frame 0.
- Never `outline: none` without a replacement.

**Interaction media queries** — hover effects and touch targets adapt to device capability:
```
@media (hover: hover) and (pointer: fine) {
  .btn:hover { background: var(--system-blue); }
}
@media (pointer: coarse) {
  .btn { min-height: 48px; }
}
```
Every hover affordance has a keyboard/focus equivalent. No interaction is hover-only.

**Keyboard navigation**: all interactive elements reachable via Tab in logical DOM order. Focus order matches visual order. Skip links recommended for navigation-heavy pages.

## 18. Apple-Glass Anti-Patterns (from Hallmark)

**Do not** ship any of these:

- **Gradient text on headings** — `background-clip: text` with linear-gradient. Apple uses solid ink + weight.
- **Bounce / elastic / overshoot easings** on buttons, modals, tooltips. Dated; breaks the calm mood.
- **Hover-only affordances** — a menu, delete button, or tooltip that only appears on hover. Touch users get nothing.
- **Glassmorphism as decoration** — frosted panels layered over a gradient background purely for aesthetic. Glass communicates *depth* (overlay over content) or it's decoration.
- **`transition: all`** — animates every property including layout ones. Always specify individual properties.
- **Animated hover gradients** — background that shifts through colours on hover. Distracting, expensive.
- **Shadow-glow on dark surfaces** — `box-shadow` on a dark card creates a coloured halo. Use elevation via lightness instead.
- **Card-in-card** — a bordered container inside another bordered container. Pick one containment layer.
- **Icon-tile feature card** — rounded-rect icon in a coloured square, heading below, two-line copy below. Apple uses inline or typographic features.
- **Auto-rotating carousels** — WCAG failure. Manual advance only, or pause-on-hover-and-focus.
- **Confirmation dialogs for reversible actions** — use optimistic update + Undo toast (5–10s) instead.
- **Animate-on-scroll everything** — pick one orchestrated entrance. The page settles after first reveal.
- **Phantom 3D** — Three.js for a stationary object the user can't manipulate. If it's not interactive, use a still image or SVG.

## 19. z-Index Scale

Define named levels at `:root` — never freestyle `z-index: 9999`:
```
--z-base:     1;
--z-raised:   10;
--z-dropdown: 100;
--z-sticky:   200;
--z-modal:    400;
--z-toast:    500;
--z-tooltip:  600;
```

Vibrancy materials (apple.md §6) default to `--z-raised` to `--z-sticky`. Sheets/modals use `--z-modal`. Toasts stack at `--z-toast`.

## 20. Viewport & Layout Discipline

- Use `dvh` / `svh` / `lvh` instead of `vh` for heights interacting with mobile chrome (`100dvh` not `100vh`).
- Never `width: 100vw` — use `width: 100%` with container padding. `100vw` includes scrollbar on desktop → horizontal overflow.
- Root carries `overflow-x: clip` on both `html` and `body` (not `hidden`, which breaks `position: sticky`).
- Display headers wrap inside long words via `overflow-wrap: anywhere; min-width: 0`.
- Image-bearing grid tracks use `minmax(0, 1fr)` — never bare `1fr` (which forces images past viewport).
- Section heads collapse to one column on mobile.
- No clickable text wrapping to two lines at any viewport 320–1920px. Buttons, nav links, CTAs are single-line affordances. Shorten the label if needed, or use `white-space: nowrap`.

## 21. Pre-Emit Self-Critique

Before finalising any Apple-glass output, score it 1–5 on these six axes. Anything < 3 triggers a revision pass:

| Axis | What it measures | 1 | 3 | 5 |
|---|---|---|---|---|
| **Philosophy** | Does it honour the soft-futurism / calm / premium brief? | Generic glass | Mostly follows, one drift | Every decision reinforces the brief |
| **Hierarchy** | Do system tints point to the primary action only? | Multi-tint surface | One tint per screen but overused | Tint occupies ≤3% of viewport |
| **Execution** | Are materials, blur, and tokens correctly implemented? | Hard fills everywhere | Materials used but fallbacks missing | Proper layering + fallbacks |
| **Specificity** | Apple-native or generic glass? | Could be any UI kit | SF Pro used but spacing off | Optical sizing, 8pt scale, HIG-compliant |
| **Restraint** | Are there unnecessary decorations? | Aurora blobs, orb floaters, gradients | One decorative element too many | Nothing that doesn't serve hierarchy |
| **Variety** | Does this section differ from other sections? | Equal padding, same rhythm everywhere | Some variation | Break-out element, uneven padding, rhythm change |

**Fail gate**: If any axis scores < 3, identify the specific violation and fix before shipping.
