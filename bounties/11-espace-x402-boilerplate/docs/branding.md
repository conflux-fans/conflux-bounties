# Customizing Frontend Branding

This guide explains how to rebrand the x402 web frontend for your own project.

## Color Scheme

Edit `apps/web/tailwind.config.js` to change the four brand colors:

```js
conflux: {
  blue:  '#1E3A5F',   // primary dark
  teal:  '#00B4D8',   // accent / CTA
  dark:  '#0A1929',   // background
  light: '#E2E8F0',   // text / foreground
},
```

Update the matching CSS custom properties in `apps/web/src/app/globals.css`:

```css
:root {
  --background: #0A1929;
  --foreground: #E2E8F0;
  --card:       #0F2744;
  --card-border:#1E3A5F;
  --accent:     #00B4D8;
  --accent-dim: rgba(0, 180, 216, 0.15);
}
```

## App Name and Tagline

All brand text lives in two files:

| Text | File | What to change |
|------|------|----------------|
| Page title | `apps/web/src/app/layout.tsx` | `metadata.title` |
| Meta description | `apps/web/src/app/layout.tsx` | `metadata.description` |
| Navbar logo | `apps/web/src/components/Navbar.tsx` | Replace the `"x4"` text span with an `<img>` or SVG |
| Navbar title | `apps/web/src/components/Navbar.tsx` | `"x402 Boilerplate"` string |
| Navbar tagline | `apps/web/src/components/Navbar.tsx` | `"Pay-per-request APIs on Conflux eSpace"` |
| Hero heading | `apps/web/src/app/page.tsx` | `"Monetize your APIs with HTTP 402"` |
| Navigation links | `apps/web/src/components/Navbar.tsx` | `NAV_LINKS` array |

## Logo

Replace the text logo in `Navbar.tsx` with your own image:

```tsx
// Before (text logo)
<span className="...">x4</span>

// After (image logo)
<img src="/logo.svg" alt="My App" className="h-8 w-8" />
```

Place your logo file in `apps/web/public/`.

## Wallet Connection Theme

The wallet modal uses ConnectKit. Change the theme in `apps/web/src/components/Providers.tsx`:

```tsx
<ConnectKitProvider theme="midnight">  {/* or "default", "soft", "retro", "nouns" */}
```

## Faucet and Network Links

Set via environment variables (no code changes needed):

```env
NEXT_PUBLIC_FAUCET_URL=https://your-faucet-url.com
NEXT_PUBLIC_NETWORK=testnet
```

## Favicon

Replace `apps/web/src/app/favicon.ico` with your own icon file.
