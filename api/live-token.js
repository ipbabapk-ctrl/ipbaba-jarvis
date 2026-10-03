const { guard } = require("./_shared");

const LIVE_MODEL =
  process.env.GEMINI_LIVE_MODEL || "gemini-3.8-live";

module.exports = async (req, res) => {
  if (
    guard(req, res, {
      method: "POST",
      json: true,
      maxBytes: 10000,
    })
  ) {
    return;
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(503).json({
        error: "gemini_not_configured",
      });
    }

    const now = Date.now();

    const payload = {
      uses: 1,
      expireTime: new Date(
        now + 30 * 60 * 1000
      ).toISOString(),
      newSessionExpireTime: new Date(
        now + 60 * 1000
      ).toISOString(),
    };

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/auth_tokens",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const detail = await response
        .text()
        .catch(() => "");

      console.error(
        "Gemini Live token error:",
        response.status,
        detail.slice(0, 700)
      );

      return res.status(502).json({
        error: "live_token_upstream_error",
      });
    }

    const token = await response.json();

    if (!token.name) {
      return res.status(502).json({
        error: "live_token_missing",
      });
    }

    return res.status(200).json({
      token: token.name,
      model: LIVE_MODEL,
    });
  } catch (error) {
    console.error(
      "Live token server error:",
      error
    );

    return res.status(500).json({
      error: "server_error",
    });
  }
};
