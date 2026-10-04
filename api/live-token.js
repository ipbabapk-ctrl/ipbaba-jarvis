export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "method_not_allowed"
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const model =
    process.env.GEMINI_LIVE_MODEL ||
    "gemini-3.8-live";

  if (!apiKey) {
    return res.status(500).json({
      ok: false,
      error: "gemini_api_key_missing"
    });
  }

  const now = Date.now();

  /*
    Ephemeral token lifetime.
    30 minutes for the token itself.
  */
  const expireTime = new Date(
    now + 30 * 60 * 1000
  ).toISOString();

  /*
    Give the browser enough time to establish
    a new Live session.
  */
  const newSessionExpireTime = new Date(
    now + 10 * 60 * 1000
  ).toISOString();

  /*
    IMPORTANT:
    Do NOT include bidiGenerateContentSetup here.

    The client-side WebSocket setup in index.html
    will provide:
      - model
      - generationConfig
      - systemInstruction
      - sessionResumption

    This keeps the token as authentication only
    instead of locking the Live configuration.
  */
  const payload = {
    uses: 1,
    expireTime,
    newSessionExpireTime
  };

  try {
    const upstream = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/auth_tokens",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },

        body: JSON.stringify(payload)
      }
    );

    const raw = await upstream.text();

    let data;

    try {
      data = JSON.parse(raw);
    } catch {
      data = {
        raw
      };
    }

    if (!upstream.ok) {
      console.error(
        "Gemini Live AuthToken error:",
        upstream.status,
        data
      );

      return res.status(502).json({
        ok: false,
        error: "live_token_upstream_error",
        upstreamStatus: upstream.status,
        upstreamError:
          data?.error?.message ||
          data?.error?.status ||
          data?.raw ||
          "Gemini rejected the Live authentication token request."
      });
    }

    const token = data?.name;

    if (!token) {
      console.error(
        "Gemini Live token missing:",
        data
      );

      return res.status(502).json({
        ok: false,
        error: "live_token_missing",
        upstreamError:
          "Gemini returned a response but no token name was found."
      });
    }

    console.log(
      "Gemini Live ephemeral token created successfully."
    );

    return res.status(200).json({
      ok: true,
      token,
      model,
      expiresAt: expireTime,
      newSessionExpiresAt:
        newSessionExpireTime
    });

  } catch (error) {
    console.error(
      "Gemini Live token server failure:",
      error
    );

    return res.status(500).json({
      ok: false,
      error: "live_token_server_error",
      message:
        error?.message ||
        "Unable to contact Gemini AuthToken service."
    });
  }
}
