---
name: IP-SAKTI
colors:
  surface: '#ebfeed'
  surface-dim: '#ccdfce'
  surface-bright: '#ebfeed'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#e5f9e7'
  surface-container: '#dff3e2'
  surface-container-high: '#daeddc'
  surface-container-highest: '#d4e7d6'
  on-surface: '#0f1f15'
  on-surface-variant: '#414942'
  inverse-surface: '#243429'
  inverse-on-surface: '#e2f6e4'
  outline: '#727971'
  outline-variant: '#c1c8c0'
  surface-tint: '#3f674a'
  primary: '#3d6448'
  on-primary: '#ffffff'
  primary-container: '#557e60'
  on-primary-container: '#f6fff4'
  inverse-primary: '#a5d1ae'
  secondary: '#54642d'
  on-secondary: '#ffffff'
  secondary-container: '#d7eba5'
  on-secondary-container: '#5a6a32'
  tertiary: '#9c3f00'
  on-tertiary: '#ffffff'
  tertiary-container: '#bf5515'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#c1edc9'
  primary-fixed-dim: '#a5d1ae'
  on-primary-fixed: '#00210e'
  on-primary-fixed-variant: '#284f34'
  secondary-fixed: '#d7eba5'
  secondary-fixed-dim: '#bbce8b'
  on-secondary-fixed: '#151f00'
  on-secondary-fixed-variant: '#3d4c17'
  tertiary-fixed: '#ffdbcc'
  tertiary-fixed-dim: '#ffb693'
  on-tertiary-fixed: '#351000'
  on-tertiary-fixed-variant: '#7a3000'
  background: '#ebfeed'
  on-background: '#0f1f15'
  surface-variant: '#d4e7d6'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  statutory-citation:
    fontFamily: Source Serif 4
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 30px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1280px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
---

## Brand & Style

The design system is built for a high-fidelity AI legal platform specializing in Indian Intellectual Property and Traditional Knowledge. It bridges the gap between ancient wisdom and modern technology through a **Natural Minimalist** aesthetic. 

The brand personality is authoritative, calm, and intellectually rigorous. The UI avoids the cold, sterile blues of typical SaaS, opting instead for a warm, organic palette that feels grounded in the earth and culture it protects. The visual style utilizes heavy whitespace, sophisticated typography pairings, and subtle tactile transitions to evoke a sense of trust and precision.

## Colors

The color palette is derived from natural elements—clay, leaf, and parchment—to provide a dignified legal atmosphere.

- **Primary (Earthy Sage Green):** Used for primary actions, success states, and brand markers.
- **Secondary (Pale Herbal Ivory):** Used for card backgrounds, active navigation states, and subtle highlighting of AI-generated content.
- **Tertiary (Terracotta Amber):** Reserved for call-to-actions that require immediate attention or secondary interactive accents.
- **Alert (Deep Rust Ochre):** Specifically for headers in statutory citations, urgent notifications, and critical legal warnings.
- **Neutral (Dark Slate Green-Charcoal):** The primary color for all text, ensuring high legibility without the harshness of pure black.
- **Background (Warm Soft Cream):** The foundational canvas, reducing eye strain during long-form legal reading.

## Typography

This design system utilizes a dual-font strategy to distinguish between user interface and legal authority.

- **UI & Navigation (Inter):** A clean, systematic sans-serif used for all functional elements, inputs, and general body text to ensure maximum readability and a modern SaaS feel.
- **Statutory & Legal Citations (Source Serif 4):** A professional serif used exclusively for legal excerpts, AI-generated legal opinions, and official citations. This creates a visual "authority shift" that helps users immediately identify source material versus interface text.

Headlines should use tighter letter spacing for a more premium, editorial look. Body text maintains a generous line height (1.5x+) to facilitate the consumption of complex legal data.

## Layout & Spacing

The layout follows a **Fixed Grid** philosophy for content-heavy pages (Legal Research) and a **Fluid Workspace** for the AI Chat interface.

- **Grid System:** A 12-column grid on desktop with a 24px gutter. 
- **The "Legal Margin":** Content should be centered with wide margins (minimum 40px) to mimic the feel of a legal brief.
- **Sidebar:** A fixed 280px minimalist sidebar for navigation, which can collapse into a 64px icon-only rail to maximize workspace.
- **Chat Interface:** A floating, centered prompt bar (max-width 800px) with dynamic padding that expands as the user types.

## Elevation & Depth

To maintain a minimalist aesthetic, depth is communicated through **Tonal Layers** rather than heavy shadows.

- **Level 0 (Surface):** The `#FAFAF5` background.
- **Level 1 (Cards/Sidebar):** Uses `#E7FBB4` with a very soft, 1px border of 10% opacity `#1B2B20`.
- **Level 2 (Modals/Popovers):** A slightly raised surface using an ambient shadow (Blur: 20px, Y: 4, Opacity: 4%) with a subtle tint of the Primary color to maintain the organic feel.
- **Active State:** Elements do not "lift" but instead shift color to a slightly deeper saturation of the Primary or Secondary palette.

## Shapes

The design system uses **Soft (0.25rem)** roundedness to balance professional rigidity with modern approachability.

- **Small Components:** Checkboxes and small tags use `rounded-sm`.
- **Standard Components:** Buttons, input fields, and standard cards use `rounded-md` (0.5rem).
- **Large Components:** The floating prompt bar and main content containers use `rounded-lg` (0.75rem).
- **Interactive States:** On hover, buttons should not increase in roundness but may feature a subtle scale transform (1.02x).

## Components

### Buttons & Inputs
- **Primary Action:** Solid `#638C6D` with white or cream text. No gradients.
- **Secondary Action:** Ghost style with `#638C6D` borders and text.
- **Floating Prompt Bar:** A pill-shaped, wide input field with a `#E7FBB4` background and a subtle shadow. The "Send" button is the Tertiary Terracotta color for visual pop.

### Cards
- **Sleek Cards:** Minimalist borders (1px solid, low opacity). Header areas within cards should use the Pale Herbal Ivory background to create internal hierarchy.

### Data Tables
- **Accessible Tables:** No vertical borders. Horizontal borders are 1px thick in a very light neutral. Header rows use `label-sm` typography with the Deep Rust Ochre color for titles to provide clear categorization of legal data.

### Sidebars
- **Minimalist Sidebar:** Uses a transparent background against the primary canvas. Active links are indicated by a `#E7FBB4` background block with a 4px left-accent border in Earthy Sage Green.

### Chips & Tags
- **Case Status Tags:** Small, pill-shaped tags using the Secondary color palette with 80% opacity for a soft, integrated look.