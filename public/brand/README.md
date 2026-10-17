# Apixis Wallet brand kit

Served from this folder at `/brand/`. PNG and ICO only. Do not add SVG, JPG, or a second logo folder.

The artwork is the official Apixis Family Company logo. `logo-full.png` places the existing mark on the left and the existing name on the right. `mark.png` is the icon only. The white files are the same pixels with the color knocked out to white. Nothing else is redrawn.

Colors are the live Wallet theme: primary `#63f6f0` (`--ix-cyan`), accent `#ffd783` (`--ix-gold`), background `#080914` (`--ix-bg`), text `#edf4ff` (`--ix-text`).

| File | Use |
| --- | --- |
| `logo-full.png` | Horizontal lockup. Site header and anywhere the full name should show. Transparent. |
| `logo-full-white.png` | Same lockup, white, for dark backgrounds. Transparent. |
| `mark.png` | Icon only. Transparent 995×995 square; the artwork is centered and not stretched. Source for the small icons. |
| `mark-white.png` | Same square, white. Transparent. |
| `favicon.ico` | Browser tab fallback (16, 32, and 48). Mark on the theme background. |
| `favicon-32.png` | 32px PNG tab icon. Mark on the theme background. |
| `apple-touch-icon.png` | 180px Apple touch icon. Mark on the theme background. |
| `icon-192.png` | 192px manifest icon. Mark on the theme background. |
| `icon-512.png` | 512px manifest icon. Mark on the theme background. |
| `og-image.png` | 1200×630 link preview. The lockup sits on the theme background. |

The Wallet header, metadata icons, Open Graph image, and web manifest all point at these `/brand/` paths. Domain in `brand.json` is `wallet.apixis.dev`.
