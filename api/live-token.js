const { guard, verifyFirebaseUser } = require("./_shared");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (guard(req, res, { method: "POST", json: true, maxBytes: 1000 })) return;

  const identity = await verifyFirebaseUser(req);
  if (identity.error) return res.status(identity.error === "firebase_admin_not_configured" ? 503 : 401).json({ ok:false, error:identity.error });

  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_LIVE_MODEL || "gemini-3.8-live";
  if (!apiKey) return res.status(503).json({ ok:false, error:"gemini_api_key_missing" });

  const now = Date.now();
  // REST expects the authToken wrapper and bidiGenerateContentSetup oneof.
  // liveConnectConstraints is an SDK configuration name, not a REST field.
  const payload = {
    authToken: {
      uses: 5,
      expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
      newSessionExpireTime: new Date(now + 60 * 1000).toISOString(),
      bidiGenerateContentSetup: {
        model: "models/" + model,
        generationConfig: { responseModalities: ["AUDIO"] },
        sessionResumption: {}
      }
    }
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const upstream = await fetch("https://generativelanguage.googleapis.com/v1alpha/auth_tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const raw = await upstream.text();
    let data;
    try { data = JSON.parse(raw); } catch (_) { data = { raw }; }

    if (!upstream.ok) {
      console.error("Gemini Live AuthToken error:", upstream.status, data);
      return res.status(502).json({
        ok:false, error:"live_token_upstream_error", upstreamStatus:upstream.status,
        upstreamError:data?.error?.message || data?.error?.status || data?.raw || "Gemini rejected the Live authentication token request."
      });
    }
    const token = data?.name;
    if (!token) {
      console.error("Gemini Live token missing:", data);
      return res.status(502).json({ ok:false, error:"live_token_missing", upstreamError:"Gemini returned no ephemeral token." });
    }
    return res.status(200).json({ ok:true, token, model, expiresAt:payload.authToken.expireTime, newSessionExpiresAt:payload.authToken.newSessionExpireTime });
  } catch (error) {
    if (error?.name === "AbortError") return res.status(504).json({ ok:false, error:"live_token_timeout", message:"Gemini token service timed out. Please try again." });
    console.error("Gemini Live token server failure:", error);
    return res.status(502).json({ ok:false, error:"live_token_server_error", message:error?.message || "Unable to contact Gemini AuthToken service." });
  } finally {
    clearTimeout(timeout);
  }
};
