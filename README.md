# กำไรวันดี
Mobile daily flower sales journal. Buildless static app. Preview data remains browser-local under `wandee-demo-v1`. Cloud mode does not upload demo records.

## Google setup still required
No live Google account or spreadsheet has been connected or tested by the developer. The app requires a Google Cloud OAuth Web Client ID and an existing spreadsheet URL, entered via the login setup dialog. Public setup is stored on that browser, not deployed globally. Enable Sheets API, configure consent/test users, and add this authorized JavaScript origin:

https://pornchaibank.github.io

Uses Google Identity Services token model and the spreadsheets scope. Visitors consent themselves and must have edit access to the selected file. No client secret required. Tokens remain in memory, are discarded on logout and are never put into localStorage, logs, source or URLs. On expiry, the user must sign in again. This is Google authorization directly, separate from any ChatGPT Google Drive connection.

First sign-in reads metadata only. The explicit initialization button adds the dedicated WandeeSales_v1 tab in one batch, with headers and profit formatting. Existing tabs are untouched. App saves append immutable event versions; the web app reads the last event for each record ID. Do not sort or manually aggregate the version log as a sales table: historical versions would duplicate totals. Date is ISO text; user text is written using RAW to avoid formula interpretation. The app uses numeric computed outputs rather than spreadsheet formulas.

Write retries preflight-read the stable event ID to avoid repeating uncertain commits. Pending operations are stored in sessionStorage (data only, never token). Form stays dirty on failure. Concurrent edit preflight detects already changed versions; Google Sheets has no compare-and-swap transaction for simultaneous appends, so strict simultaneous-writer guarantees are not provided. Capacity is bounded to 10,000 event rows; reaching the read limit blocks further operation rather than silently truncating totals.

## Validation
The source project test suite tests mocked Google responses: no writes on login, RAW append, positive/negative profits, edit versions, conflict checks, uncertain-write deduplication, malformed data and auth expiry. It does not prove live OAuth or Google account permissions. Login visual checks used embedded mobile viewports 390x844, 360x640 and 320x568 with no overflow.

Generated image asset: flower-shop-v3.png. Created with the built-in image generation tool: photorealistic warm Thai florist shop, marigolds, jasmine, blush roses, sage shopfront, morning light, no text or people.

## GitHub Pages
Serve the main branch root. The deployable files are at the repository root and use relative asset URLs. Google Authorized JavaScript origins must contain the origin only (https://pornchaibank.github.io), without the repository path. Browser-local demo records and setup on another domain are not automatically transferred here.
