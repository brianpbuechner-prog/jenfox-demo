# Jen Fox for House: portfolio demo

A public demo of the tools built for Jen Fox's 2026 campaign for Minnesota House 41B:
the private team site, the State of the Race brief, the election night party screen, and the yard sign app.

What is real and what is not:
- Real: 2026 and 2024 election results (MN Secretary of State), Campaign Finance Board totals, yard sign counts,
  website traffic (Wix) and newsletter statistics. All public or the campaign's own.
- Sample values: every VoteBuilder (VAN) figure, the final-stretch list counts, and anything from a voter-file vendor.
- Made up: every household, address, name and phone number in the sign app screens.

Nothing here talks to Airtable, VAN or the live sign app. Team site reads come from `lib/fixtures.json`
(built by `scripts/make_fixtures.py`), and the sign app pages in `public/signs/` answer their own API calls
in the browser from `public/signs/demo-api.js`.

Run locally: `npm install`, then `npm run dev`. Deploys to Vercel with no environment variables.
