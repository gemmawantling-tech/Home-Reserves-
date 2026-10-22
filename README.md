# Home Reserves

Static mobile PWA at https://gemmawantling-tech.github.io/Home-Reserves-/.

## Scanning and stocktake

Choose **Scan barcode** to request the rear camera, or type a barcode. ZXing 0.21.3 (Apache-2.0, vendored under `vendor/`) decodes EAN-13/EAN-8 and UPC locally. Camera use requires HTTPS or localhost. Images are never uploaded. Only barcode lookup requests go to Open Food Facts over HTTPS. Unsupported cameras, permission denial, unavailable products and network failures have a manual fallback.

Review imported facts, supply missing pack sizes and portions, and explicitly choose ingredient, side or complete meal portions. Manufacturer serving sizes are never automatically classified as meals. Stocktake queues entries until **Confirm entries**; closing/reloading before confirmation loses the queue and triggers an unload warning. Repeated camera callbacks latch until the next deliberate scan. Retries use transaction IDs; repeated barcodes update one inventory record. Use **Set exact quantity** for a count rather than incoming purchases. Stock units must match recipe quantities.

Saved products remain available at zero stock, and the catalogue is included in JSON backups. Existing product corrections take priority over external lookup data. Product details can be edited through Inventory → Edit → Edit product & portions. Inventory totals, meal availability, expiry and category totals recompute after updates. Complete meal products are excluded from recipe allocation to prevent double counting. Ingredient and side portions alone do not add food coverage days. Products now retain distinct expiry batches under one stock line; the root expiry summarises the earliest remaining date.

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

Both ordinary item editing and barcode review accept typed dates as DD/MM/YYYY, DDMMYYYY or existing ISO dates. Impossible dates are rejected; empty dates can be saved. Dates are still stored as ISO strings, preserving existing backups. Use-by and best-before share a date field: users must follow the label on the pack. Added stock now has its own expiry batch. Use Manage batches to correct individual quantities and dates; a single-batch date can also be edited on the item.

Validation: `node --test tests/*.test.cjs` and `node tests/expiry-browser.cjs` cover date parsing, range boundaries, used-up stock exclusion, location filtering, manual date replacement/clearing, and persistence across reloads.

## Expandable Pantry categories

Pantry groups stock into accessible native expandable category sections, including household-created categories. Each header shows its matching item-type count and below-optimum / due-date indicators. Sections initially collapse; unfiltered open/closed choices are remembered locally under a separate UI-preference key. Search and filters open matching groups by default; toggling a filtered group affects only that filter view. Expand all / Collapse all act on visible groups. Quantity changes and edits preserve the current view; editing an item's category moves its card into the appropriate section. Unrecognised categories remain visible as Uncategorised. Expiring retains its date-sorted list. Stock, catalogue, portions and backups are unchanged.

`node tests/groups-browser.cjs` validates category/custom/uncategorised grouping, remembered expansion, stock adjustments, category edits, search, location filtering, data preservation and mobile layout.

## Detailed recipe notebook

**Recipes** is a cooking notebook alongside the existing **Meals** stock-allocation planner. It includes the user-provided Easy homemade flatbreads (no yeast), with five ingredients, six steps, yield, approximate timing, vegan note, equipment, garlic variation, softness tip and serving suggestions. Add/edit/delete your own recipes, search names/ingredients/dietary notes, and tick off method steps while cooking. Checklist state lasts for the current page session and can be reset; recipe edits persist.

Ingredient quantities remain readable recipe text (g, ml, tbsp, tsp, fractions), without guessing conversions to inventory packs. Notebook recipes do not deduct stock or add preparedness meal portions. Use Meals to define a complete meal's inventory requirements. Recipes are stored under the existing inventory backup's `cookbook` field. Older data and backups receive a copy of the starter only when that field is absent; deleted starters stay deleted. Existing stock, catalogue corrections, recipes used for allocation, and coverage remain unchanged. New notebook entries are validated and escaped when rendered. No camera/product images or other data are uploaded for this feature.

Run `node tests/recipes-browser.cjs` to validate mobile recipe details, checklists, add/edit/search/delete, reload/backup preservation, unchanged inventory and unchanged meal coverage. `node --test tests/*.test.cjs` includes notebook migration and validation checks.

## Recipe pantry cross-check

Each detailed recipe now shows **Check against your pantry** and **Link ingredients**. Confirm exact pantry items, per-batch amounts and units once; links are stored in `cookbook[].pantryLinks` and included in existing JSON backups. Exact unambiguous names can be suggested, but are only confirmed when the user saves. Ingredient edits invalidate links for changed rows; ordinary recipe-detail edits preserve unchanged links.

Checks read the latest pantry quantities without deducting stock or changing meal coverage. Known pack sizes convert stock packs to grams or millilitres, kg/L inventory units are supported, and bottled-water `litresPerUnit` is respected. UK measuring tsp and tbsp mean 5ml and 15ml. No density conversion between weight and volume is inferred. Users can explicitly enter a required number or fraction of counted stock units. Uncounted quantities, missing links, removed products, incompatible units, shortages and past recorded dates are distinguished. A shared stock item is allocated only once across all linked ingredients within the recipe. Results apply to one recipe batch, not a combined allocation across multiple cooking recipes.

Validation: `node tests/recipe-stock-browser.cjs` and `node --test tests/*.test.cjs` cover linking/suggestions, conversions, unknown quantities, shortages, expiry review, repeated ingredients, safe edits, persistence and no unintended stock consumption.

## Family first-aid kit checklist

Pantry → **Family first-aid kit** opens a nested checklist for a family with boys aged 12 and 9 and no reported health conditions. A First aid-category stock item whose name contains “kit” also links to it. Twenty entries cover wound dressings/bandages, cleansing/protection, tools/information, and medicines to review with a pharmacist. Editable non-medicine quantities are practical starter targets, explicitly not official clinical quantities. All actual counts start unknown, and medicine targets start blank. No medicine doses are supplied; both children are under 16, with NHS aspirin, medicine-measure and ibuprofen suitability cautions linked in the UI.

Contents are saved separately under `firstAidKit` in the existing JSON backup, without resetting or adding duplicate Pantry stock records. Optional typed expiry dates use the existing date validation; positive-count kit contents participate in Expiring under a separate kit heading. The checklist is for one household kit and does not infer how many complete kits exist. Sources are linked in the app: NHS Wales Llandaff North Medical Centre family first-aid box, NHS medicines for babies and children, and British Red Cross emergency-kit guidance. Content is paraphrased; suggested target counts are app planning choices, not attributed as NHS requirements.

Validation: `node --test tests/*.test.cjs` and `node tests/first-aid-browser.cjs` cover initial unknown quantities, optional medicine targets, count validation, typed dates, expiry listing, persistence and preserving existing stock/recipes/catalogue.

## Simplified stock entry

Manual and barcode entry now lead with item identity, quantity, category, location and optional typed date, followed by Save actions. Portions/pack size, product details/nutrition, and targets/notes are collapsed sections; the calculator is also collapsed. Existing barcode products show a compact identity/current-stock card with Add / Use / Set / Edit action choices. Explicit product-detail editing expands the relevant sections.

Saving remembers category and location for new entries, respecting a currently selected category filter. Existing product data always takes precedence over these defaults. Form fields remain in the form while collapsed, preserving metadata and user corrections; invalid hidden fields open their parent sections. Unknown portions are allowed and marked for later review in stock cards. They do not add complete-meal coverage. New-product targets are retained, and manual entry now exposes optional pack size for recipe checks. Stocktake session entries continue to be reviewed before final inventory confirmation.

Validation: `node tests/quick-entry-browser.cjs` covers repeat/new/manual flows, quantity placement, collapsed fields, metadata preservation, remembered defaults and excluding unknown portions from meal coverage. At 390×844, the tested repeat-product quantity begins around 253px from the top with five visible controls (previous audit: around 1,574px and 15 controls). Existing scan, portion, expiry, category and recipe-stock workflows were also checked.

## Expiry batches and cooking ideas

A stock product retains one Pantry card and total while `batches` records per-date quantities. Existing entries are read as one legacy batch with their original count/date; no migration invents extra stock or changes IDs. Scanning the same barcode adds a batch for the entered date, combining same-date batches. Existing-product add forms start with a blank new-batch date, avoiding silently reusing the oldest date. Use **dates and quantities → Manage batches** to split old stock, correct individual dates or replace batch counts. Batch editing retains product metadata and links. Quick stock use removes earliest dated quantities first, followed by undated stock; exhausted rows disappear and the earliest summary updates. Setting a total reduces oldest stock or adds an undated excess without redistributing existing dates. Plus adds undated stock; scanning or batch management can specify its date.

Expiring flattens dated batches into separate entries, preserving the parent product link. It includes undated batches in the missing-date filter and omits zero stock. Batch entries show product totals and link to batch management rather than offering ambiguous per-product +/- controls. JSON backups include batches; recipe and meal links retain product IDs.

Recipes → **What can I cook?** groups saved recipes into ready, needing 1–2 ingredients, needing checks, and larger shortages. It uses confirmed pantry links and compatible quantities, independently per recipe batch. Past-date stock is excluded from recipe-check usable quantities while newer stock can still satisfy the ingredient. Unknown dates still require a pack/freshness check. Compatible known amounts prevent duplicate ingredient allocation; unknown links or incompatible units cannot become ready suggestions. Items dated in the next 30 days are highlighted. No stock is consumed and no new complete-meal coverage is inferred.

An optional **Add basic cupboard recipes** button adds original tomato pasta, beans with rice, and oat porridge templates without duplicating them or replacing user recipes. Their ingredients require user-confirmed pantry links; unspecified cooking-water quantities are left for review. Dietary notes require checking actual packs.

Validation: `node --test tests/*.test.cjs` and `node tests/batches-cooking-browser.cjs` cover legacy preservation, same-barcode different dates, same-date merging, earliest-first consumption, totals, date edits, reload/backup preservation, per-batch expiry, newer stock after an expired batch, cooking readiness/near-matches/uncertainty and optional recipe templates. Existing quick entry, scanning, portions, grouping, recipes, expiry and first-aid workflows were checked.

## Gaps to review

Overview → **Identify gaps** opens an expandable review, also linked from What can I cook. Confirmed stock shortages compare counted quantities against user-entered targets and show the exact difference. Linked recipe shortages are listed independently per recipe batch, without summing shared-stock demands into a misleading shopping quantity. First-aid shortages use only entries with positive, chosen checklist targets; optional medicine targets are never invented.

Review sections separately identify uncounted stock, recipes with missing links/incompatible quantities/date review, counted food without portion information, first-aid supplies not yet checked, past-date batches, undated batches and optional stock targets not yet set. Unknown counts are not treated as zero or as confirmed shortages. Date review uses individual batches. Review buttons open item editing, the recipe or the family kit. The summary is computed without altering inventory, recipes or first-aid records and refreshes after edits. It is based on recorded data and targets, not a certification of complete household preparedness or nutritional coverage.

Validation: `node --test tests/*.test.cjs` and `node tests/gaps-browser.cjs` verify exact stock differences, unknown/shortage separation, recipe checks, optional medicines, per-batch date review, editing refresh and direct review links. Quick entry and batch/cooking workflows remain checked.

Food-day coverage (v12): Overview now accounts for stock energy separately from the tracked-meal planner. Each usable stock batch contributes once, using optional `kcalPerUnit` or imported kcal/100g (or kJ converted at 4.184) multiplied by its pack size. Raw g/kg/ml/l stock units take precedence over pack size. Serving-only and prepared nutrition are not inferred. Food and Drinks categories are included; water, alcohol and nonfood are excluded. Past-date batches are excluded, undated stock is flagged. Unknown calories, pack sizes and stock counts remain visible gaps, not invented values. Household daily energy defaults to an explicitly provisional 2,000 kcal × household size; an optional total override is saved in Settings. It is not a tailored dietary recommendation or nutritional completeness measure. Review calories allows manual label values and a user-triggered Open Food Facts suggestion with review before save; existing product corrections are preserved. Existing records and backup format remain compatible.

Food groups (v13): Adds Sauces & condiments, Carbohydrates, Vegetables, Proteins, Legumes & pulses, Ready meals, Fruit, Dairy & alternatives, Baking ingredients and Oils & fats as food categories. The one-time upgrade preserves existing item categories and custom matching categories. Pantry → Organise food provides a batch review with name-based suggestions only for general Food items; Cancel leaves data unchanged and Save updates inventory/catalogue categories without changing quantities, batches, portions or nutrition. Categories remain editable in Settings and selectable in manual and scanner entry. Deleted groups are not recreated on every load. Ready meals never implies complete-meal portions.

First-aid category (v14): Family first-aid kit now lives in the Pantry category accordion instead of a toolbar button. The existing First aid category is renamed when it still has the default name; its stock lines retain their IDs and counts. The category also displays the separate 20-entry kit checklist, with an Edit kit checklist action inside. Category/search/status filters and expand/collapse controls apply to checklist entries; location filters show only inventory with a recorded location. Checklist contents are not copied into inventory, calories or category stock totals. Existing checklist data, expiry tracking and backup fields remain unchanged.
