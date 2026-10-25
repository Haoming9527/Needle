# Needle public site

The public My finds and Seller studio showcase. First-time visitors enter the quick tour, and a compact animation demonstrates the extension's right-click flow. The website is separate from the repository README's playable promo video.

## Work locally

Run from the repository root:

```powershell
npm run dev:site
npm run build:site
npm run preview:site
```

The development site uses `http://127.0.0.1:5180`. Production preview uses `http://127.0.0.1:4180`. Build output is `dist/website/`, separate from the extension's `dist/extension/`.

The site is a static React application. Saved finds, language, and tour completion use browser-local state; seller metrics and creator matches are labelled example data. It does not connect to the extension's local API or perform Google sign-in.

Product, creator, and thumbnail images and fonts live in `public/assets/`. Asset URLs are relative so the same build works at the GitHub Pages project path `/Needle/`.

`src/components/ExtensionDemo.jsx` and its stylesheet contain the compact right-click example on My finds. It illustrates identification, a product match, and adding to a cart without changing saved data. It plays once, offers pause/replay, pauses when hidden or while the tour is open, and shows a static result for reduced motion.

## Publication

Public address: [haoming9527.github.io/Needle](https://haoming9527.github.io/Needle/).

GitHub Pages serves only the built static site from the `codex/public-site` branch. The extension backend, API keys, and SQLite database are excluded. To update the site, rebuild, publish the contents of `dist/website/` to that branch, and check the Pages deployment result.

## Verification

The initial production build was previewed under `/Needle/`. Browser checks covered the first-visit quick tour, tour navigation/completion, product search/details, save toggling, EN/KO switching, Seller studio product selection, and a refresh of `#seller`. No browser console warnings or errors were observed in that check. `.nojekyll` is a GitHub hosting directive rather than a browser asset. The website does not include the README's promo video.

The animated extension example was checked at a narrow mobile viewport for overflow, pause/resume, replay, completion, and pausing throughout the quick tour. Closing the tour starts the visible example. No console warnings or errors were observed.
