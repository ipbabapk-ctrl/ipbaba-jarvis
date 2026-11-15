module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({
      ok: false,
      error: "method_not_allowed",
    });
  }

  return res.status(200).json({
    ok: true,
    service: "IP BABA JARVIS",
    status: "online",
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    firebaseAdminConfigured: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON),
    adminEmailConfigured: Boolean(process.env.ADMIN_EMAIL),
    apiOriginAllowlistConfigured: Boolean(process.env.ALLOWED_ORIGINS),
    textModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    elevenLabsConfigured: Boolean(process.env.ELEVENLABS_API_KEY),
    elevenLabsVoiceConfigured: Boolean(
      process.env.ELEVENLABS_VOICE_ID
    ),
    timestamp: new Date().toISOString(),
  });
};
