const { guard } = require("./_shared");

const ELEVENLABS_MODEL =
  process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";

module.exports = async (req, res) => {
  if (
    guard(req, res, {
      method: "POST",
      json: true,
      maxBytes: 30000,
    })
  ) {
    return;
  }

  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const voiceId = process.env.ELEVENLABS_VOICE_ID;

    if (!apiKey) {
      return res.status(503).json({
        error: "elevenlabs_not_configured",
      });
    }

    if (!voiceId) {
      return res.status(503).json({
        error: "elevenlabs_voice_not_configured",
      });
    }

    const body = req.body || {};
    const text = String(body.text || "").trim();

    if (!text) {
      return res.status(400).json({
        error: "text_required",
      });
    }

    if (text.length > 5000) {
      return res.status(413).json({
        error: "text_too_long",
      });
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(
        voiceId
      )}`,
      {
        method: "POST",
        headers: {
          Accept: "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: ELEVENLABS_MODEL,
          output_format: "mp3_44100_128",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.15,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => "");

      console.error(
        "ElevenLabs TTS error:",
        response.status,
        detail.slice(0, 500)
      );

      return res.status(502).json({
        error: "elevenlabs_upstream_error",
      });
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());

    res.statusCode = 200;
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Length", audioBuffer.length);

    return res.end(audioBuffer);
  } catch (error) {
    console.error("TTS server error:", error);

    return res.status(500).json({
      error: "tts_server_error",
    });
  }
};
