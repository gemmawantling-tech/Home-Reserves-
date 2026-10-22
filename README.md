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

## Pantry and expiry update

The Inventory navigation label is now **Pantry**, retaining all existing records and categories. A storage-location filter shows Pantry, Freezer or any locations already entered; it does not move or reclassify stock. **Expiring** shows positive stock quantities in earliest-date order, with overdue plus 7/30/90-day ranges, overdue-only, all dates, and missing-date views. Zero and uncounted stock are excluded.

Both ordinary item editing and barcode review accept typed dates as DD/MM/YYYY, DDMMYYYY or existing ISO dates. Impossible dates are rejected; empty dates can be saved. Dates are still stored as ISO strings, preserving existing backups. Use-by and best-before share one field: users must follow the label on the pack; per-batch dates remain unsupported. When adding stock of an existing barcode, the earliest existing date is retained. To correct that date, edit the stock item or choose Edit product details only.

Validation: `node --test tests/*.test.cjs` and `node tests/expiry-browser.cjs` cover date parsing, range boundaries, used-up stock exclusion, location filtering, manual date replacement/clearing, and persistence across reloads.

## Expandable Pantry categories

Pantry groups stock into accessible native expandable category sections, including household-created categories. Each header shows its matching item-type count and below-optimum / due-date indicators. Sections initially collapse; unfiltered open/closed choices are remembered locally under a separate UI-preference key. Search and filters open matching groups by default; toggling a filtered group affects only that filter view. Expand all / Collapse all act on visible groups. Quantity changes and edits preserve the current view; editing an item's category moves its card into the appropriate section. Unrecognised categories remain visible as Uncategorised. Expiring retains its date-sorted list. Stock, catalogue, portions and backups are unchanged.

`node tests/groups-browser.cjs` validates category/custom/uncategorised grouping, remembered expansion, stock adjustments, category edits, search, location filtering, data preservation and mobile layout.

## Detailed recipe notebook

**Recipes** is a cooking notebook alongside the existing **Meals** stock-allocation planner. It includes the user-provided Easy homemade flatbreads (no yeast), with five ingredients, six steps, yield, approximate timing, vegan note, equipment, garlic variation, softness tip and serving suggestions. Add/edit/delete your own recipes, search names/ingredients/dietary notes, and tick off method steps while cooking. Checklist state lasts for the current page session and can be reset; recipe edits persist.

Ingredient quantities remain readable recipe text (g, ml, tbsp, tsp, fractions), without guessing conversions to inventory packs. Notebook recipes do not deduct stock or add preparedness meal portions. Use Meals to define a complete meal's inventory requirements. Recipes are stored under the existing inventory backup's `cookbook` field. Older data and backups receive a copy of the starter only when that field is absent; deleted starters stay deleted. Existing stock, catalogue corrections, recipes used for allocation, and coverage remain unchanged. New notebook entries are validated and escaped when rendered. No camera/product images or other data are uploaded for this feature.

Run `node tests/recipes-browser.cjs` to validate mobile recipe details, checklists, add/edit/search/delete, reload/backup preservation, unchanged inventory and unchanged meal coverage. `node --test tests/*.test.cjs` includes notebook migration and validation checks.
