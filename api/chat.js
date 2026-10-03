const { guard, BRAND, RULES } = require("./_shared");

const PRIMARY_MODEL =
  process.env.GEMINI_MODEL || "gemini-3.7-flash";

const FALLBACK_MODEL =
  process.env.GEMINI_FALLBACK_MODEL || "gemini-3.8-flash";

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function callGemini(model, key, system, contents) {
  return fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: system }],
        },
        contents,
        generationConfig: {
          maxOutputTokens: 2500,
        },
      }),
    }
  );
}

module.exports = async (req, res) => {
  if (
    guard(req, res, {
      method: "POST",
      json: true,
      maxBytes: 120000,
    })
  ) {
    return;
  }

  try {
    const key = process.env.GEMINI_API_KEY;

    if (!key) {
      return res.status(503).json({
        error: "gemini_not_configured",
      });
    }

    const body = req.body || {};

    const messages = Array.isArray(body.messages)
      ? body.messages.slice(-24)
      : [];

    if (!messages.length) {
      return res.status(400).json({
        error: "messages_required",
      });
    }

    const contents = messages
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [
          {
            text: String(m.text || "").slice(0, 6000),
          },
        ],
      }))
      .filter((m) => m.parts[0].text.trim());

    if (!contents.length) {
      return res.status(400).json({
        error: "empty_message",
      });
    }

    const system = `${RULES}
${BRAND}

Use clean Markdown.

Only append the exact token [[CTA]] at the very end when contacting IP BABA is a genuinely useful next step.
`;

    const models = [
      PRIMARY_MODEL,
      FALLBACK_MODEL,
    ].filter(
      (model, index, arr) =>
        model && arr.indexOf(model) === index
    );

    let lastStatus = 0;
    let lastDetail = "";

    for (const model of models) {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await callGemini(
            model,
            key,
            system,
            contents
          );

          lastStatus = response.status;

          if (response.ok) {
            const data = await response.json();

            const reply = (
              data.candidates?.[0]?.content?.parts || []
            )
              .map((p) => p.text || "")
              .join("")
              .trim();

            if (reply) {
              return res.status(200).json({
                reply,
              });
            }

            lastDetail = "empty_response";
          } else {
            lastDetail = await response
              .text()
              .catch(() => "");

            const retryable =
              response.status === 429 ||
              response.status === 500 ||
              response.status === 502 ||
              response.status === 503 ||
              response.status === 504;

            if (!retryable) {
              console.error(
                "Gemini non-retryable error",
                model,
                response.status,
                lastDetail.slice(0, 700)
              );

              return res.status(502).json({
                error: "gemini_upstream_error",
              });
            }
          }
        } catch (error) {
          console.error(
            "Gemini request error",
            model,
            error
          );

          lastStatus = 503;
          lastDetail = String(error);
        }

        if (attempt < 2) {
          await sleep(700 * Math.pow(2, attempt));
        }
      }
    }

    console.error(
      "All Gemini attempts failed:",
      lastStatus,
      lastDetail.slice(0, 1000)
    );

    return res.status(503).json({
      error: "gemini_temporarily_unavailable",
    });
  } catch (error) {
    console.error(
      "Chat server error:",
      error
    );

    return res.status(500).json({
      error: "server_error",
    });
  }
};
