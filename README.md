# Home Reserves

Static mobile PWA at https://gemmawantling-tech.github.io/Home-Reserves-/.

## Scanning and stocktake

Choose **Scan barcode** to request the rear camera, or type a barcode. ZXing 0.21.3 (Apache-2.0, vendored under `vendor/`) decodes EAN-13/EAN-8 and UPC locally. Camera use requires HTTPS or localhost. Images are never uploaded. Only barcode lookup requests go to Open Food Facts over HTTPS. Unsupported cameras, permission denial, unavailable products and network failures have a manual fallback.

Review imported facts, supply missing pack sizes and portions, and explicitly choose ingredient, side or complete meal portions. Manufacturer serving sizes are never automatically classified as meals. Stocktake queues entries until **Confirm entries**; closing/reloading before confirmation loses the queue and triggers an unload warning. Repeated camera callbacks latch until the next deliberate scan. Retries use transaction IDs; repeated barcodes update one inventory record. Use **Set exact quantity** for a count rather than incoming purchases. Stock units must match recipe quantities.

Saved products remain available at zero stock, and the catalogue is included in JSON backups. Existing product corrections take priority over external lookup data. Product details can be edited through Inventory → Edit → Edit product & portions. Inventory totals, meal availability, expiry and category totals recompute after updates. Complete meal products are excluded from recipe allocation to prevent double counting. Ingredient and side portions alone do not add food coverage days. One stock line retains the earliest best-before date when stock is added; per-batch dates are not tracked.

## Data and deployment

This repository uses the existing `home_reserves_inventory_v1` localStorage key. **It has no Firebase backend, household accounts or cross-device synchronisation.** Existing local data remains in place. No Firebase configuration, data or permissions are changed. The catalogue belongs to this browser's household inventory. Export backups regularly. Main branch is served by GitHub Pages; no build is required. The service-worker cache version changes with releases. External product requests bypass its cache.

`barcode-scanner.js` owns camera decoding; `product-lookup.js` is a replaceable provider adapter; `inventory-core.js` contains pure validation and inventory operations; `scanning.js` integrates the UI. Open Food Facts data is attributed in the product review. Database: ODbL, contents: Database Contents License, images: CC BY-SA. See https://world.openfoodfacts.org/terms-of-use. Missing records are expected. The app identifies itself through OFF's `user_agent` request parameter and requests only needed fields; saved catalogue records avoid repeated lookups. Public API use is subject to OFF rate limits. Commercial redistribution must follow the applicable share-alike and attribution terms.

## Validation

Run `node --test tests/*.test.cjs`. Browser integration: install Playwright externally, then `node tests/browser.cjs` against a local server on port 8765, or set `TEST_URL`. The browser test mocks product lookup and checks mobile scan entry, catalogue corrections, queued commits, quantity/portion refresh and reload persistence. It does not establish physical camera performance; Android Chrome and iOS Safari real-device checks remain necessary.

## Portion estimates and categories update

Drinks, Snacks, Treats and Alcohol are added once for existing inventories and imported backups, without moving stock, replacing custom categories, resetting quantities or overwriting catalogue corrections. Drinks and Alcohol use general stock categories, excluded from both direct meal coverage and recipe allocation.

Open Food Facts pack and serving weights are normalised to grams or millilitres. A missing serving count can be calculated from a pack and serving amount in matching units; calculated counts remain labelled estimates. Ambiguous multipacks, mixed/drained/prepared weights, unknown sizes and mismatched dimensions are left for review. A product's barcode alone cannot supply missing facts.

The review card offers an editable serving weight and **Use calculated portions**. Optional starting estimates are dry rice 75g (side), dry pasta 75g (ingredient), and dry oats 40g (ingredient). These are planning choices, not product facts or personalised dietary advice. Estimates can be replaced by a manual count, and saved corrections take priority on subsequent scans. Imported servings never imply a complete meal. Pack size and serving size must refer to the same dry/prepared/drained basis.

Settings shows when a backup download was last requested, with a reminder to check the file was saved. It does not claim to verify a file on the user's phone. Cross-device household sync still requires a configured backend, authentication and household access controls; it is not enabled by this release.

Additional validation: `node tests/portions-browser.cjs` tests existing-data migration, new categories, imported weight calculations, explicit estimates, correction preservation, backup download and beverage exclusion from food coverage.
