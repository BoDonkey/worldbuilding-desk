# UI Design System & Style Bible

This guide defines the visual direction for UI work in this project. Consult it before creating or altering UI, CSS, layout, or visual component styling.

Use existing CSS variables wherever possible. Do not hardcode colors in component styles. If a token listed here is missing from `apps/web/src/styles/theme.css`, either use the closest existing token or add/update the shared theme tokens deliberately; do not invent one-off component variables.

The surface, button, input, and badge tokens below were recovered from the `codex/review-completion-state` reference branch and should be treated as the preferred token vocabulary for future UI polish.

## 1. Core Design Philosophy

* **Aesthetic:** Warm, tactile, and distraction-free. It should feel like a modern, digital writer's desk.
* **Shapes:** Friendly but professional. Heavy use of rounded corners (10px to 16px for containers, 12px for buttons, 999px for pills/badges).
* **Borders:** Nearly all surface components, panels, and inputs feature a soft 1px border (`var(--surface-border-soft)` or `var(--color-border)`) to define geometry without harsh drop shadows.

## 2. Color Variables

* **Backgrounds:**
* `var(--color-bg-primary)`: App background.
* `var(--color-bg-secondary)`: Sidebar/Nav backgrounds.
* `var(--surface-panel)`: Default card/panel background.
* `var(--surface-panel-elevated)`: For modals, chat areas, and floating elements.


* **Text:**
* `var(--color-text-primary)`: Standard text.
* `var(--color-text-secondary)`: Muted/helper text.


* **Accents & States:**
* `var(--color-accent)`: Primary brand color (Blue).
* `var(--color-focus)`: Outline color for keyboard focus.


* **Editor/Content specifically:**
* `var(--editor-surface-bg)`: The actual writing canvas.
* `var(--editor-text-color)`: Text on the canvas.



## 3. Component Specifications

**Buttons:**

* Always use a 12px `border-radius`.
* Include a 1px solid border matching the button variant.
* Apply a slight `transform: translateY(-1px)` and background color change on hover.
* **Variants:**
* *Default*: `var(--button-bg)`, `var(--button-text)`, `var(--button-border)`.
* *Primary* (Earthy Green/Sage): `var(--button-primary-bg)`, `var(--button-primary-text)`.
* *Secondary* (Warm Taupe): `var(--button-secondary-bg)`, `var(--button-secondary-text)`.
* *Danger* (Soft Red): `var(--button-danger-bg)`, `var(--button-danger-text)`.



**Inputs & Forms:**

* Text inputs and Textareas get a 10px `border-radius`.
* Background: `var(--input-bg)`. Border: `var(--input-border)`.
* **Focus State:** Must use `outline: none`, apply `var(--input-border-focus)` to the border, and use a `box-shadow` with `color-mix` to create a 3px soft focus ring.
* Checkboxes are custom-styled polygons scaling a checkmark icon, turning `var(--color-accent)` when checked.

**Badges, Pills, and Chips (e.g., Tool Tags, Statuses):**

* Use `border-radius: 999px`.
* Include a 1px solid border.
* Padding should be tight (e.g., `0.2rem 0.5rem`).
* Font size should be small (`12px` or `var(--font-size-sm)`).
* Font weight should be `600` or `700`.

**Chat/AI Interface (AIAssistant):**

* User Messages: Max-width 80%, aligned right. Styled exactly like a Primary Button (`var(--button-primary-bg)`).
* AI Messages: Max-width 80%, aligned left. Styled like a standard surface panel (`var(--surface-panel)` with `var(--surface-border-soft)`).

## 4. Layout & Breakpoints

* **Desktop Layout:** Relies on a fixed Left Rail (`88px` wide). The main content area must have left padding to account for this (`padding-left: calc(88px + 1.75rem)`).
* **Mobile Breakpoint (`max-width: 900px`):**
* The Left Rail disappears completely.
* A fixed bottom mobile bar (`min-height: 66px`) takes over navigation.
* Modals transition to bottom-anchored slide-ups with a dark overlay (`rgba(15, 23, 42, 0.45)`).
* Ensure all bottom padding accounts for `env(safe-area-inset-bottom)`.



## 5. Typography Rules

* UI text uses standard `system-ui`.
* Any text meant to represent user-generated worldbuilding content should hook into the editor CSS variables (`var(--editor-font-family)` and `var(--editor-line-height)`).
* Use `letter-spacing: 0.04em` or `0.06em` and `text-transform: uppercase` for tiny subheadings or section labels.
