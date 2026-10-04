export default async function handler(req, res) {
  // ----------------------------------------------------
  // CORS
  // ----------------------------------------------------
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "method_not_allowed"
    });
  }

  // ----------------------------------------------------
  // Environment
  // ----------------------------------------------------
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

  // ----------------------------------------------------
  // Token lifetime
  // ----------------------------------------------------
  const now = Date.now();

  const expireTime =
    new Date(
      now + 30 * 60 * 1000
    ).toISOString();

  const newSessionExpireTime =
    new Date(
      now + 60 * 1000
    ).toISOString();

  // ----------------------------------------------------
  // Gemini Ephemeral Live Token
  // ----------------------------------------------------
  const payload = {
    uses: 1,

    expireTime,

    newSessionExpireTime,

    liveConnectConstraints: {
      model: `models/${model}`,

      config: {
        sessionResumption: {},

        responseModalities: [
          "AUDIO"
        ]
      }
    }
  };

  try {

    const upstream =
      await fetch(
        "https://generativelanguage.googleapis.com/v1beta/auth_tokens",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "x-goog-api-key":
              apiKey
          },

          body: JSON.stringify(
            payload
          )
        }
      );


    const raw =
      await upstream.text();


    let data;

    try {
      data =
        JSON.parse(raw);
    }
    catch {
      data = {
        raw
      };
    }


    // --------------------------------------------------
    // Gemini rejected token request
    // --------------------------------------------------
    if (!upstream.ok) {

      console.error(
        "Gemini Live token error:",
        upstream.status,
        data
      );

      return res.status(502).json({
        ok: false,
        error:
          "live_token_upstream_error",

        upstreamStatus:
          upstream.status,

        upstreamError:
          data?.error?.message ||
          data?.error?.status ||
          data?.raw ||
          "Gemini rejected the Live token request."
      });

    }


    // --------------------------------------------------
    // Successful token
    // --------------------------------------------------
    const token =
      data?.name;


    if (!token) {

      console.error(
        "Gemini token response missing name:",
        data
      );

      return res.status(502).json({
        ok: false,
        error:
          "live_token_missing",

        upstreamError:
          "Gemini returned a response but no token name was found."
      });

    }


    return res.status(200).json({

      ok: true,

      token,

      model,

      expiresAt:
        expireTime,

      newSessionExpiresAt:
        newSessionExpireTime

    });

  }
  catch (error) {

    console.error(
      "Live token fetch failed:",
      error
    );

    return res.status(500).json({

      ok: false,

      error:
        "live_token_server_error",

      message:
        error?.message ||
        "Unable to contact Gemini token service."

    });

  }
}
