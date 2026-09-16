# 1 HUNDRED CLUB — Daily Board

Token-gated board for **today only**.
Leagues: MLB · NHL · NBA · WNBA · NFL.

Same hosting shape as the games (`wanted-run`, `kush-quest`):
one public GitHub repo → GitHub Pages → phone browser.

The engine stays off this repo. This repo is the **storefront + lock**.
You drop the card. They burn tokens. The pick unlocks **only after you mark payment received**.

## The rule that GitHub cannot break

GitHub Pages is a static file host. It cannot see Cash App. It cannot see Stripe. It cannot know that money actually moved.

If the pick text lives inside `index.html`, anyone can View Source and steal it.
So the public file only shows the schedule, token balance, locked cards, and the Cash App pay ticket.

Unlock:

1. **House confirm (Cash App, day one)** — buyer sends $ to cash.app/$1HundredClub with the order code in the note. You open HOUSE, confirm after the money is in, send them the redeem code.
2. **Stripe webhook later** — same board, worker credits tokens when Stripe says the payment succeeded.

Do not mix “Venmo me and I will unlock an App Store build.” Apple/Google ban that.

## Token law

- Need tokens to enter. Floor = cost of one pick.
- Each unlocked game burns tokens.
- Non-refundable.
- Lot expires Dec 31 of the year AFTER the purchase year (buy in 2026 → dies 2027-12-31).

Starter packs in `index.html` CONFIG: SINGLE 100 tok / $10, STACK 300 / $25, BRICK 1000 / $75. One pick = 100 tokens. Change those numbers.

## Run it

1. Settings → Pages → Deploy from **main** / root.
2. Phone: https://cbrazy27.github.io/one-hundred-club/
3. HOUSE button → PIN starter `100` — change it.
4. Buyer pays with the on-screen order code in the Cash App note.
5. You confirm. They redeem. They burn. Card opens.

Same-phone demo: CONFIRM $ drops tokens on that phone so you can walk the board. Other phones need the redeem code or `worker.js`.

## Worker

`worker.js` is the optional Cloudflare Worker. Picks live there, not in GitHub. Set `CONFIG.API` when you deploy it.
