const { guard, verifyFirebaseUser, getFirestore } = require("./_shared");

async function timedFetch(url, options, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    return { ok: response.ok, status: response.status, text };
  } finally { clearTimeout(timer); }
}

async function testLiveSocket(token, model, timeoutMs = 9000) {
  if (typeof WebSocket === "undefined") throw new Error("WebSocket is not available in this Node runtime.");
  return new Promise((resolve, reject) => {
    let socket;
    try { socket = new WebSocket("wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=" + token); }
    catch (error) { reject(error); return; }
    let settled = false;
    const timer = setTimeout(() => finish(new Error("Live WebSocket setup timed out.")), timeoutMs);
    function finish(error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { socket.close(); } catch (_) {}
      if (error) reject(error); else resolve(true);
    }
    socket.addEventListener("open", () => {
      try {
        socket.send(JSON.stringify({
          setup: {
            model: "models/" + model,
            generationConfig: { responseModalities: ["AUDIO"] },
            sessionResumption: {}
          }
        }));
      } catch (error) { finish(error); }
    }, { once: true });
    socket.addEventListener("message", event => {
      try {
        const data = JSON.parse(typeof event.data === "string" ? event.data : String(event.data));
        if (data.setupComplete || data.setup_complete) finish();
        else if (data.error) finish(new Error(data.error.message || "Gemini Live setup was rejected."));
      } catch (error) { if (error instanceof SyntaxError) return; finish(error); }
    });
    socket.addEventListener("error", () => finish(new Error("Gemini Live WebSocket connection failed.")), { once: true });
    socket.addEventListener("close", event => {
      if (!settled) finish(new Error("Gemini Live WebSocket closed before setup completed (code " + event.code + ")."));
    }, { once: true });
  });
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
      }, 20000);
      let body = {}; try { body = JSON.parse(response.text); } catch (_) {}
      const answer = (body.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("").trim();
      checks.geminiText = response.ok && answer
        ? { ok: true, message: "Text model " + textModel + " returned a response." }
        : { ok: false, message: "Gemini text request failed (HTTP " + response.status + "): " + String(body.error?.message || body.error?.status || "No text response.").slice(0, 180) };
    } catch (error) {
      checks.geminiText.message = error?.name === "AbortError" ? "Gemini text test timed out after 20 seconds." : String(error.message || error).slice(0, 180);
    }

    try {
      const now = Date.now();
      const response = await timedFetch("https://generativelanguage.googleapis.com/v1beta/auth_tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          uses: 5,
          expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
          newSessionExpireTime: new Date(now + 60 * 1000).toISOString(),
          fieldMask: "model,generationConfig.responseModalities,sessionResumption",
          bidiGenerateContentSetup: {
            model: "models/" + liveModel,
            generationConfig: { responseModalities: ["AUDIO"] },
            sessionResumption: {}
          }
        })
      }, 12000);
      let body = {}; try { body = JSON.parse(response.text); } catch (_) {}
      if (response.ok && typeof body.name === "string" && body.name.startsWith("auth_tokens/")) {
        await testLiveSocket(body.name, liveModel);
        checks.geminiLiveToken = { ok: true, message: "Ephemeral token issued and Gemini Live WebSocket setup completed for " + liveModel + "." };
      } else {
        checks.geminiLiveToken = { ok: false, message: "Gemini Live token request failed (HTTP " + response.status + "): " + String(body.error?.message || body.error?.status || "Token missing.").slice(0, 180) };
      }
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
