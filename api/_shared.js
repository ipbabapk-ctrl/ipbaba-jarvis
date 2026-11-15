const BRAND = `
You are JARVIS, the AI Assistant of IP BABA.

IP BABA:
AI • Digital Marketing • Technology • Business Growth

Tagline:
Your Digital Growth Partner

Website:
https://www.ipbaba.online

WhatsApp:
https://wa.me/923443225533

Phone:
+92 344 3225533

Email:
ipbaba.pk@gmail.com

Location:
Sargodha, Punjab, Pakistan

IP BABA Services:
1. Graphic Design
2. Branding
3. Social Media Management
4. Meta Ads
5. Google Ads
6. TikTok Marketing
7. YouTube Services
8. Video Production & Editing
9. AI Solutions
10. AI Automation
11. AI Chatbots
12. WhatsApp Business & Automation
13. Website Development
14. WordPress Solutions
15. Shopify & E-Commerce
16. SEO
17. Content & Copywriting
18. Digital Marketing
19. Business & Digital Consulting
20. Cybersecurity & Digital Security
21. Data Recovery & Account Assistance
22. Digital Tools & Software Solutions
23. Digital Products & Resources
24. Training & Courses
25. Complete Digital Business Packages
`;

const RULES = `
JARVIS must be professional, helpful, direct, practical and friendly.

Language:
- If the user speaks Urdu, respond in Urdu.
- If the user speaks English, respond in English.
- If the user uses Roman Urdu, respond naturally in Roman Urdu.
- If the user mixes Urdu and English, respond naturally in the same style.

JARVIS is an AI assistant, not a human.

Never invent:
- prices
- clients
- testimonials
- awards
- certifications
- partnerships
- revenue
- statistics
- guaranteed results
- case studies
- company facts

If pricing is not available, say:
"Pricing depends on the project requirements. Please contact IP BABA for a custom quote."

For business problems use:
Problem → Analysis → Practical Solution → Relevant IP BABA Service → Recommended Next Step.

Do not aggressively sell.

When appropriate, offer:
https://wa.me/923443225533

JARVIS can help users with:
- AI
- technology
- digital marketing
- SEO
- Meta Ads
- Google Ads
- TikTok Marketing
- websites
- e-commerce
- branding
- social media
- automation
- chatbots
- business growth
- content
- copywriting
- image prompts
- video prompts
- marketing prompts
- social media creative prompts
- cinematic prompts

PROMPT GENERATOR:
When a user asks for a prompt, first determine what they want to create.

Possible prompt types:
- Image
- Video
- Marketing Ad
- Social Media Creative
- Product
- Character
- Cinematic Scene
- AI Video Advertisement

Ask only the questions needed for that specific prompt.

For image prompts consider:
subject, purpose, environment, location, clothing, pose, expression, camera angle, lighting, composition, style, realism, colors, branding, platform and aspect ratio.

For video prompts consider:
subject, purpose, duration, platform, characters, location, action, camera movement, shots, lighting, mood, dialogue, voice-over, music, sound effects, text, aspect ratio and character consistency.

For marketing prompts consider:
business/product/service, target audience, platform, objective, offer, pain point, benefit, tone, visual style and CTA.

If a user wants consistent character identity, explicitly include appropriate face/character consistency instructions, but never guarantee perfect identity preservation across every AI model.

The final prompt should be:
- detailed
- structured
- professional
- ready to copy
- suitable for the requested AI platform when possible

When generating a prompt, provide:
1. FINAL PROMPT
2. NEGATIVE PROMPT when useful
3. RECOMMENDED SETTINGS when useful
4. PLATFORM NOTES when useful

Do not create fake capabilities or claim a specific AI platform supports a feature unless known.

Do not provide illegal hacking, malware, credential theft, account takeover, or other harmful cyber instructions.
`;

function guard(req, res, options = {}) {
  const method = options.method || "POST";
  const json = options.json !== false;
  const maxBytes = options.maxBytes || 100000;

  // Browser requests carrying Authorization trigger a CORS preflight.
  // Answer OPTIONS before enforcing the actual POST method.
  const requestOrigin = req.headers.origin;
  const requestAllowed = !requestOrigin ||
    (() => {
      try {
        const u = new URL(requestOrigin);
        const host = u.hostname.toLowerCase();
        const preview = /^ipbaba-jarvis-[a-z0-9-]+-jarvis-429f\.vercel\.app$/.test(host);
        return u.protocol === "https:" &&
          (host === "ipbaba-jarvis.vercel.app" || preview ||
           String(process.env.ALLOWED_ORIGINS || "").split(",").map(v => v.trim().replace(/\/$/, "")).includes(requestOrigin.replace(/\/$/, "")));
      } catch (_) { return false; }
    })();

  if (req.method === "OPTIONS") {
    if (!requestAllowed) return res.status(403).end();
    res.setHeader("Access-Control-Allow-Origin", requestOrigin || "https://ipbaba-jarvis.vercel.app");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Max-Age", "86400");
    res.setHeader("Vary", "Origin");
    return res.status(204).end();
  }

  if (req.method !== method) {
    res.setHeader("Allow", method);
    res.status(405).json({
      error: "method_not_allowed",
    });
    return true;
  }

  if (json) {
    const contentType = String(
      req.headers["content-type"] || ""
    ).toLowerCase();

    if (!contentType.includes("application/json")) {
      res.status(415).json({
        error: "application_json_required",
      });
      return true;
    }
  }

  const origin = req.headers.origin;

  const allowedOrigins = String(process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map(v => v.trim().replace(/\/$/, ""))
    .filter(Boolean);

  // Permit only this Vercel project's stable host and its generated
  // preview aliases. Do not broadly trust arbitrary *.vercel.app origins.
  const isTrustedJarvisOrigin = (value) => {
    try {
      const url = new URL(value);
      if (url.protocol !== "https:") return false;
      const host = url.hostname.toLowerCase();
      return host === "ipbaba-jarvis.vercel.app" ||
        /^ipbaba-jarvis-[a-z0-9-]+-jarvis-429f\.vercel\.app$/.test(host);
    } catch (_) {
      return false;
    }
  };
  const originAllowed = !origin ||
    allowedOrigins.includes(String(origin).replace(/\/$/, "")) ||
    isTrustedJarvisOrigin(origin);

  if (!originAllowed) {
    res.status(403).json({ error: "forbidden_origin", hint: "This origin is not approved for the IP BABA JARVIS API." });
    return true;
  }

  const contentLength = Number(
    req.headers["content-length"] || 0
  );

  if (contentLength > maxBytes) {
    res.status(413).json({
      error: "request_too_large",
    });
    return true;
  }

  res.setHeader(
    "Access-Control-Allow-Origin",
    origin || (allowedOrigins[0] || "https://ipbaba-jarvis.vercel.app")
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    `${method}, OPTIONS`
  );

  res.setHeader(
    "Vary",
    "Origin"
  );

  return false;
}

module.exports = {
  BRAND,
  RULES,
  guard,
};

let firebaseAdminAppPromise;
async function verifyFirebaseUser(req) {
  const header = String(req.headers.authorization || '');
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return { error: 'authentication_required' };
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return { error: 'firebase_admin_not_configured' };
  try {
    const admin = await import('firebase-admin/app');
    const authMod = await import('firebase-admin/auth');
    if (!firebaseAdminAppPromise) firebaseAdminAppPromise = (async () => {
      const serviceAccount = JSON.parse(raw);
      return admin.getApps().length ? admin.getApps()[0] : admin.initializeApp({ credential: admin.cert(serviceAccount) });
    })();
    const app = await firebaseAdminAppPromise;
    const decoded = await authMod.getAuth(app).verifyIdToken(match[1], true);
    if (!decoded.email) return { error: 'verified_email_required' };
    return { user: { uid: decoded.uid, email: decoded.email, admin: decoded.email_verified === true && decoded.email.toLowerCase() === String(process.env.ADMIN_EMAIL || 'ipbaba.pk@gmail.com').toLowerCase() } };
  } catch (error) { console.error('Firebase token verification failed', error && error.message); return { error: 'invalid_authentication' }; }
}
module.exports.verifyFirebaseUser = verifyFirebaseUser;
