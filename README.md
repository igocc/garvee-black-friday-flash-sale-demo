# GARVEE Black Friday Vote & Drop

A responsive, public-facing interaction prototype for a Shopify Black Friday campaign. Shoppers vote a ranked product queue, unlock access through three actions, and preview two-unit drops opening every two hours.

> **Prototype boundary:** voting, customer login, booking, share completion, inventory, reservation, and checkout are simulated in the browser. This repository does not connect to a Shopify store and does not process orders.

## Open locally

```bash
npm run serve
```

Then open `http://localhost:4173`.

## Compare three page directions

The floating bottom switcher, or the left/right arrow keys, changes the shareable `?variant=` URL:

- `?variant=A` — **Drop Arena:** a high-energy live drop and product-first hero
- `?variant=B` — **Schedule First:** an editorial timetable with the queue as the main story
- `?variant=C` — **Guided Quest:** a conversion-led eligibility journey

All variants share the same business state and interactions.

## Included interactions

- Anonymous product vote limited by a demo voter Cookie and vote Cookie
- Vote-sorted ranking and projected two-hour drop schedule
- Voting, countdown, live, and sold-out state previews
- Simulated Shopify Customer Account login
- Sequential login → event booking → share-action eligibility
- Two-unit live inventory, one-claim limit, and visual five-minute hold
- Explicit prototype disclosures and a Shopify implementation-boundary dialog
- Responsive layouts, keyboard variant switching, focusable controls, and reduced-motion support
- Demo reset control for repeatable stakeholder walkthroughs

## Shopify implementation boundary

The production campaign is not a theme-only feature. It needs an app backend with an App Proxy, private database, scheduler, Admin API access, and order/inventory reconciliation. Cookie ID is only a light duplicate-vote deterrent. Shopify does not natively prove that an external social post succeeded, and a normal cart does not reserve inventory for five minutes.

For verified platform details and primary Shopify documentation, read [docs/shopify-implementation-notes.md](docs/shopify-implementation-notes.md).

## Data note

Product names, images, list prices, and comparison prices are adapted from the GARVEE public catalog snapshot captured for the adjacent collection-page prototype on 2026-09-23. Vote counts, drop prices, eligibility, schedule, and inventory are deterministic demo values, not live business claims.

## Validate

```bash
npm test
```

The smoke test checks JavaScript syntax, required files, the four campaign phases, the three variants, and referenced local product images.
