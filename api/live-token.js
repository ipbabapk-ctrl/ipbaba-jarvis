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

    const apiKey =
      process.env.GEMINI_API_KEY;

    if (!apiKey) {

      return res.status(503).json({
        error: "gemini_not_configured",
      });

    }

    const now =
      Date.now();

    /*
     * Keep the token short-lived.
     *
     * New sessions are allowed for 60 seconds
     * after token creation.
     *
     * Once the WebSocket session starts,
     * the token itself remains valid for 30 minutes.
     */

    const expireTime =
      new Date(
        now + 30 * 60 * 1000
      ).toISOString();

    const newSessionExpireTime =
      new Date(
        now + 60 * 1000
      ).toISOString();


    /*
     * IMPORTANT:
     *
     * Lock the Live configuration on the
     * server-side ephemeral token.
     *
     * This prevents the browser from having
     * to negotiate the model/configuration
     * again after the WebSocket opens.
     */

    const payload = {

      uses: 1,

      expireTime,

      newSessionExpireTime,

      bidiGenerateContentSetup: {

        model:
          `models/${LIVE_MODEL}`,

        responseModalities: [
          "AUDIO"
        ],

        systemInstruction: {

          parts: [

            {
              text:
                [
                  "You are JARVIS, the AI Assistant of IP BABA.",
                  "Speak naturally, clearly and briefly.",
                  "Reply in the user's language.",
                  "Help with AI, digital marketing, technology, business, websites, SEO, automation, prompts and IP BABA services.",
                  "Never invent prices, clients, awards, guarantees, certifications, partnerships, revenue, statistics or company facts.",
                  "If information is unknown, clearly say that it is unknown."
                ].join(" ")
            }

          ]

        }

      }

    };


    console.log(
      "Creating Gemini Live ephemeral token:",
      {
        model: LIVE_MODEL,
        expiresInSeconds: 1800
      }
    );


    const response =
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

          body:
            JSON.stringify(
              payload
            )

        }
      );


    const raw =
      await response
        .text()
        .catch(
          () => ""
        );


    if (!response.ok) {

      console.error(
        "Gemini Live token creation failed:",
        response.status,
        raw.slice(0, 1500)
      );


      return res.status(502).json({

        error:
          "live_token_upstream_error",

        status:
          response.status

      });

    }


    let token;

    try {

      token =
        JSON.parse(
          raw
        );

    } catch {

      console.error(
        "Gemini Live token returned invalid JSON:",
        raw.slice(0, 1000)
      );


      return res.status(502).json({
        error:
          "live_token_invalid_response"
      });

    }


    if (!token.name) {

      console.error(
        "Gemini Live token missing name:",
        token
      );


      return res.status(502).json({
        error:
          "live_token_missing"
      });

    }


    return res.status(200).json({

      token:
        token.name,

      model:
        LIVE_MODEL

    });


  } catch (error) {

    console.error(
      "Live token server error:",
      error
    );


    return res.status(500).json({
      error:
        "server_error"
    });

  }

};
