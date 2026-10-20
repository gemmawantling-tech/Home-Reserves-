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
