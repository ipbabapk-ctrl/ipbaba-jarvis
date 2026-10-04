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
  const model = process.env.GEMINI_LIVE_MODEL || "gemini-3.8-live";

  if (!apiKey) {
    return res.status(500).json({
      ok: false,
      error: "gemini_api_key_missing"
    });
  }

  const now = Date.now();

  // Token remains usable for 30 minutes.
  const expireTime = new Date(
    now + 30 * 60 * 1000
  ).toISOString();

  // Give the browser enough time to establish the Live session.
  const newSessionExpireTime = new Date(
    now + 10 * 60 * 1000
  ).toISOString();

  const payload = {
    uses: 1,

    expireTime,

    newSessionExpireTime,

    bidiGenerateContentSetup: {
      model: `models/${model}`,

      generationConfig: {
        responseModalities: ["AUDIO"]
      },

      systemInstruction: {
        parts: [
          {
            text:
              "You are JARVIS, the AI Assistant of IP BABA. " +
              "Speak naturally, clearly and briefly. " +
              "Reply in the user's language. " +
              "Help with AI, digital marketing, technology, business, websites, automation, prompts and IP BABA services. " +
              "Never invent prices, clients, testimonials, awards, certifications, partnerships, revenue, statistics, guarantees or company facts. " +
              "If information is unknown, clearly say that it is unknown. " +
              "For live voice conversations, sound natural and conversational rather than reading long structured answers. " +
              "Keep responses concise unless the user specifically asks for detail."
          }
        ]
      },

      sessionResumption: {}
    }
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
      data = { raw };
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
      newSessionExpiresAt: newSessionExpireTime
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
