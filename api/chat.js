const { guard, BRAND, RULES } = require("./_shared");

const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

module.exports = async (req, res) => {
  if (guard(req, res, { method: "POST", json: true, maxBytes: 120000 })) return;

  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return res.status(503).json({ error: "gemini_not_configured" });

    const body = req.body || {};
    const messages = Array.isArray(body.messages) ? body.messages.slice(-24) : [];
    if (!messages.length) return res.status(400).json({ error: "messages_required" });

    const contents = messages.map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: String(m.text || "").slice(0, 6000) }]
    })).filter(m => m.parts[0].text.trim());

    if (!contents.length) return res.status(400).json({ error: "empty_message" });

    const system = `${RULES}\n${BRAND}\nUse clean Markdown. Only append the exact token [[CTA]] at the very end when contacting IP BABA is a genuinely useful next step.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        generationConfig: {
          temperature: 0.65,
          maxOutputTokens: 2500
        }
      })
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("Gemini chat error", response.status, detail.slice(0, 500));
      return res.status(502).json({ error: "gemini_upstream_error" });
    }

    const data = await response.json();
    const reply = (data.candidates?.[0]?.content?.parts || [])
      .map(p => p.text || "")
      .join("")
      .trim();

    if (!reply) return res.status(502).json({ error: "empty_gemini_response" });
    return res.status(200).json({ reply });
  } catch (error) {
    console.error("Chat server error", error);
    return res.status(500).json({ error: "server_error" });
  }
};
