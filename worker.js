/**
 * 1 HUNDRED CLUB — confirm worker
 * Cloudflare Workers. Secrets: ADMIN_PIN, optional STRIPE_WEBHOOK_SECRET
 */
const PACKS = { SINGLE: { tokens: 100, usd: 10 }, STACK: { tokens: 300, usd: 25 }, BRICK: { tokens: 1000, usd: 75 } };
const PICK_COST = 100;
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type, x-admin-pin",
    },
  });
}
function code() {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "CLUB-";
  for (let i = 0; i < 4; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
}
function expireOn(year) { return year + 1 + "-12-31"; }
export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return json({ ok: true });
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    try {
      if (path === "/order" && req.method === "POST") {
        const body = await req.json();
        const pack = PACKS[body.packId];
        if (!pack) return json({ error: "bad pack" }, 400);
        const orderId = code();
        const rec = { orderId, deviceId: String(body.deviceId || ""), packId: body.packId, tokens: pack.tokens, usd: pack.usd, status: "pending", created: Date.now(), year: new Date().getFullYear() };
        await env.CLUB.put("order:" + orderId, JSON.stringify(rec));
        return json({ orderId, tokens: pack.tokens, usd: pack.usd, cashTag: "cash.app/$1HundredClub", note: orderId });
      }
      if (path === "/confirm" && req.method === "POST") {
        const body = await req.json();
        if (String(body.pin) !== String(env.ADMIN_PIN)) return json({ error: "bad pin" }, 403);
        const rec = JSON.parse((await env.CLUB.get("order:" + body.orderId)) || "null");
        if (!rec) return json({ error: "no order" }, 404);
        if (rec.status !== "paid") {
          rec.status = "paid"; rec.paidAt = Date.now(); rec.redeem = code();
          rec.lot = { tokens: rec.tokens, remain: rec.tokens, expires: expireOn(rec.year) };
          await env.CLUB.put("order:" + rec.orderId, JSON.stringify(rec));
          await env.CLUB.put("redeem:" + rec.redeem, rec.orderId);
        }
        return json({ ok: true, orderId: rec.orderId, redeem: rec.redeem, tokens: rec.tokens });
      }
      if (path === "/redeem" && req.method === "POST") {
        const body = await req.json();
        const orderId = await env.CLUB.get("redeem:" + String(body.code || "").toUpperCase());
        if (!orderId) return json({ error: "bad code" }, 404);
        const rec = JSON.parse((await env.CLUB.get("order:" + orderId)) || "null");
        if (!rec || rec.status !== "paid") return json({ error: "not paid" }, 403);
        if (rec.redeemed) return json({ error: "already used" }, 409);
        rec.redeemed = true; rec.redeemedDevice = String(body.deviceId || "");
        await env.CLUB.put("order:" + orderId, JSON.stringify(rec));
        const walletKey = "wallet:" + rec.redeemedDevice;
        const wallet = JSON.parse((await env.CLUB.get(walletKey)) || "{\"lots\":[],\"unlocks\":{}}");
        wallet.lots.push({ id: rec.orderId, remain: rec.tokens, expires: rec.lot.expires });
        await env.CLUB.put(walletKey, JSON.stringify(wallet));
        const session = crypto.randomUUID();
        await env.CLUB.put("session:" + session, rec.redeemedDevice, { expirationTtl: 60 * 60 * 24 * 30 });
        return json({ ok: true, tokens: rec.tokens, expires: rec.lot.expires, session });
      }
      if (path === "/unlock" && req.method === "POST") {
        const body = await req.json();
        const deviceId = await env.CLUB.get("session:" + body.session);
        if (!deviceId) return json({ error: "no session" }, 401);
        const wallet = JSON.parse((await env.CLUB.get("wallet:" + deviceId)) || "{\"lots\":[],\"unlocks\":{}}");
        const today = new Date().toISOString().slice(0, 10);
        if (wallet.unlocks[body.gameId]) {
          const slate = JSON.parse((await env.CLUB.get("slate:" + today)) || "{\"games\":[]}");
          const g = slate.games.find((x) => x.id === body.gameId);
          return json({ ok: true, already: true, pick: g ? g.pick : null });
        }
        let need = PICK_COST;
        for (const lot of wallet.lots) {
          if (lot.expires < today || lot.remain <= 0) continue;
          const take = Math.min(lot.remain, need);
          lot.remain -= take; need -= take;
          if (need === 0) break;
        }
        if (need > 0) return json({ error: "not enough live tokens" }, 402);
        wallet.unlocks[body.gameId] = Date.now();
        await env.CLUB.put("wallet:" + deviceId, JSON.stringify(wallet));
        const slate = JSON.parse((await env.CLUB.get("slate:" + today)) || "{\"games\":[]}");
        const g = slate.games.find((x) => x.id === body.gameId);
        return json({ ok: true, pick: g && g.pick ? g.pick : null, tokensLeft: wallet.lots.reduce((s, l) => s + (l.expires >= today ? l.remain : 0), 0) });
      }
      if (path === "/slate" && req.method === "GET") {
        const date = url.searchParams.get("date") || new Date().toISOString().slice(0, 10);
        const slate = JSON.parse((await env.CLUB.get("slate:" + date)) || "{\"games\":[]}");
        return json({ date, games: (slate.games || []).map((g) => ({ id: g.id, league: g.league, away: g.away, home: g.home, time: g.time, locked: !g.pick })) });
      }
      if (path === "/slate" && req.method === "POST") {
        const body = await req.json();
        if (String(body.pin) !== String(env.ADMIN_PIN)) return json({ error: "bad pin" }, 403);
        const date = body.date || new Date().toISOString().slice(0, 10);
        await env.CLUB.put("slate:" + date, JSON.stringify({ games: body.games || [] }));
        return json({ ok: true, date, n: (body.games || []).length });
      }
      if (path === "/stripe" && req.method === "POST") return json({ error: "stripe not wired" }, 501);
      return json({ error: "no route" }, 404);
    } catch (err) {
      return json({ error: String(err.message || err) }, 500);
    }
  },
};
