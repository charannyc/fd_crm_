async function rpc(name, args) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_KEY;
  if (!url || !key) throw new Error("Database is not configured.");
  const r = await fetch(url + "/rest/v1/rpc/" + name, {
    method: "POST",
    headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const t = await r.text();
  let b = null;
  try { b = t ? JSON.parse(t) : null; } catch (e) { b = t; }
  if (!r.ok) throw new Error((b && b.message) || "Database error.");
  return b;
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST only." });
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};
  const args = Array.isArray(body.args) ? body.args : [];
  const p = String(args[0] || "");
  const rest = args.slice(1);
  const fn = String(body.fn || "");
  try {
    if (fn === "needsPin") return res.json({ ok: true, data: true });
    if (fn === "getLeadsV2") return res.json({ ok: true, data: await rpc("crm_get", { p_pin: p }) });
    if (fn === "getEmails") return res.json({ ok: true, data: await rpc("crm_emails_get", { p_pin: p, p_limit: 500 }) });
    if (fn === "getClients") return res.json({ ok: true, data: await rpc("crm_clients_get", { p_pin: p }) });
    if (fn === "saveLeadV2") {
      const d = rest[2] || {};
      await rpc("crm_save", {
        p_pin: p, p_id: Number(rest[0]), p_name: String(rest[1]),
        p_status: String(d.status == null ? "" : d.status), p_agent: String(d.agent == null ? "" : d.agent),
        p_due: String(d.due == null ? "" : d.due), p_note: String(d.note == null ? "" : d.note),
      });
      return res.json({ ok: true, data: true });
    }
    if (fn === "getMailHistoryV2" || fn === "getMailArchiveV2") return res.json({ ok: true, data: { items: [], scanned: 0, hasMore: false } });
    return res.status(400).json({ ok: false, error: "Unknown function." });
  } catch (e) {
    const m = String((e && e.message) || e);
    return res.status(/passcode/i.test(m) ? 401 : 500).json({ ok: false, error: m });
  }
};
