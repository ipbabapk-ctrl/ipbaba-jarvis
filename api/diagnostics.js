const { guard, verifyFirebaseUser, getFirestore } = require("./_shared");

async function timedFetch(url, options, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (guard(req, res, { method: "POST", json: true, maxBytes: 1000 })) return;
  const identity = await verifyFirebaseUser(req);
  if (identity.error) return res.status(identity.error === "firebase_admin_not_configured" ? 503 : 401).json({ error: identity.error });
  if (!identity.user.admin) return res.status(403).json({ error: "admin_only" });

  const checks = {
    firebaseAuth: { ok: true, message: "Firebase Admin verified the signed-in administrator." },
    geminiText: { ok: false, message: "Not tested." },
    geminiLiveToken: { ok: false, message: "Not tested." },
    firestore: { ok: false, message: "Not tested." }
  };
  const apiKey = process.env.GEMINI_API_KEY;
  const textModel = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const liveModel = process.env.GEMINI_LIVE_MODEL || "gemini-3.8-live";

  if (!apiKey) {
    checks.geminiText.message = "GEMINI_API_KEY is missing in Vercel environment variables.";
    checks.geminiLiveToken.message = "GEMINI_API_KEY is missing in Vercel environment variables.";
  } else {
    try {
      const response = await timedFetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(textModel) + ":generateContent", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "Reply with exactly: OK" }] }], generationConfig: { maxOutputTokens: 8 } })
      }, 12000);
      const body = await response.json().catch(() => ({}));
      const answer = (body.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("").trim();
      checks.geminiText = response.ok && answer
        ? { ok: true, message: "Text model " + textModel + " returned a response." }
        : { ok: false, message: "Gemini text request failed (HTTP " + response.status + "): " + String(body.error?.message || body.error?.status || "No text response.").slice(0, 180) };
    } catch (error) {
      checks.geminiText.message = error?.name === "AbortError" ? "Gemini text test timed out after 12 seconds." : String(error.message || error).slice(0, 180);
    }

    try {
      const now = Date.now();
      const response = await timedFetch("https://generativelanguage.googleapis.com/v1beta/auth_tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          uses: 1,
          expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
          newSessionExpireTime: new Date(now + 60 * 1000).toISOString(),
          liveConnectConstraints: {
            model: "models/" + liveModel,
            config: { responseModalities: ["AUDIO"], sessionResumption: {} }
          }
        })
      }, 12000);
      const body = await response.json().catch(() => ({}));
      checks.geminiLiveToken = response.ok && typeof body.name === "string" && body.name.startsWith("auth_tokens/")
        ? { ok: true, message: "Gemini issued a scoped Live token for " + liveModel + "." }
        : { ok: false, message: "Gemini Live token request failed (HTTP " + response.status + "): " + String(body.error?.message || body.error?.status || "Token missing.").slice(0, 180) };
    } catch (error) {
      checks.geminiLiveToken.message = error?.name === "AbortError" ? "Gemini Live token test timed out after 12 seconds." : String(error.message || error).slice(0, 180);
    }
  }

  try {
    const db = await getFirestore();
    await db.collection("jarvisConfig").doc("runtime").get();
    checks.firestore = { ok: true, message: "Firestore is reachable." };
  } catch (error) {
    checks.firestore.message = "Firestore is unavailable: " + String(error.message || error).slice(0, 180);
  }

  const ok = checks.firebaseAuth.ok && checks.geminiText.ok && checks.geminiLiveToken.ok && checks.firestore.ok;
  return res.status(200).json({ ok, checks, testedAt: new Date().toISOString() });
};
