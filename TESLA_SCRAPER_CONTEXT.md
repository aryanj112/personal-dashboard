# Tesla Careers Scraper — Current State

This note is a focused companion to the broader docs in `AGENTS.md`, `docs/architecture.md`, and `backend/personal_api/services/README.md`.

## Why Tesla is still hard

Tesla uses a proprietary careers stack at `tesla.com/careers/search` and protects it with
**Akamai Bot Manager**. That means successful scraping depends on more than just headers:

1. TLS / JA3-style fingerprinting
2. Browser fingerprinting and JS behavior
3. IP reputation and geography

That third point matters a lot here. Making the browser *look* US-like can help, but it does
not fully replace a real US residential IP or a trustworthy US proxy.

## What the code is doing now

### Tracked company source

Tesla is already configured in the app as:

- `source_type = "tesla"`
- `source_key = "tesla"`

So the old Workday path is no longer the active Tesla fetch path.

### Active fetch path

When the internships backend fetches Tesla, it now calls:

- `backend/personal_api/services/internships.py`
- `backend/personal_api/services/tesla_scraper.py`

The Tesla scraper currently:

1. Launches Camoufox
2. Uses a US-style locale by default (`en-US`)
3. Can optionally use:
   - `TESLA_SCRAPER_GEOIP=true`
   - `TESLA_SCRAPER_PROXY_SERVER=...`
   - `TESLA_SCRAPER_PROXY_USERNAME=...`
   - `TESLA_SCRAPER_PROXY_PASSWORD=...`
4. Watches Tesla network responses for likely JSON job payloads
5. Repeatedly scrolls / tries load-more controls
6. Falls back to DOM scraping
7. Raises much more detailed diagnostics if it still finds nothing

## What changed most recently

The current Tesla scraper was hardened to make the next real-world test more useful:

- configurable locale / geoip / proxy hooks
- repeated loading instead of just one scroll
- broader recursive JSON extraction for unknown Tesla payload shapes
- better DOM fallback
- much better diagnostics in `last_fetch_error`

So if the next test fails, the error should tell us a lot more about whether we hit:

- browser/session startup issues
- Akamai/IP blocking
- Tesla response shape changes
- parsing failures after page load

## What we know right now

- Camoufox is installed in this project environment.
- The Tesla tracker exists in the DB with `source_type='tesla'`.
- In the current local DB snapshot, Tesla currently has `1` active stored posting.
- In the Codex sandbox environment, launching Camoufox itself aborted before a meaningful
  Tesla test could complete, so this environment is not a trustworthy place to validate
  the live Tesla flow end-to-end.

## Most likely blocker

The biggest remaining unknown is still the **network/IP side**.

We can absolutely make the browser look more US-like:

- locale
- timezone/geolocation derived from IP
- proxy-aware browser configuration

But if the request still comes from a non-US or suspicious IP, Akamai may still block it.

## Best next test

Run the backend on a real machine/network and then fetch Tesla with one of these setups:

1. US residential internet connection
2. US VPN or US proxy
3. ideally US proxy + `TESLA_SCRAPER_GEOIP=true`

Then trigger Tesla fetch from the app and inspect the new `last_fetch_error` message if it fails.

## Useful env vars for that test

```bash
export TESLA_SCRAPER_LOCALE=en-US
export TESLA_SCRAPER_GEOIP=true
export TESLA_SCRAPER_PROXY_SERVER=http://host:port
export TESLA_SCRAPER_PROXY_USERNAME=...
export TESLA_SCRAPER_PROXY_PASSWORD=...
```

Other optional tuning:

```bash
export TESLA_SCRAPER_HEADLESS=true
export TESLA_SCRAPER_DEBUG=true
export TESLA_SCRAPER_MAX_SCROLLS=10
export TESLA_SCRAPER_TIMEOUT_MS=45000
export TESLA_SCRAPER_SCROLL_WAIT_MS=2500
```

## If it still fails after a US-based test

Next likely steps would be:

1. inspect the new diagnostic URLs/errors
2. capture Tesla's real JSON endpoint shape from that session
3. harden the extractor against that exact payload
4. if Akamai still wins, try a managed anti-bot proxy/scraping provider
