const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const files = [
  "api/_shared.js",
  "api/chat.js",
  "api/admin.js",
  "api/profile.js",
  "api/health.js",
  "api/live-token.js",
  "api/diagnostics.js",
  "public/js/firebase.js",
  "public/js/chat-storage.js"
];
let failed = false;
function check(source, filename, moduleMode = false) {
  const ext = moduleMode ? ".mjs" : ".js";
  const temp = path.join(os.tmpdir(), "jarvis-check-" + process.pid + "-" + Math.random().toString(36).slice(2) + ext);
  fs.writeFileSync(temp, source);
  const result = spawnSync(process.execPath, ["--check", temp], { encoding: "utf8" });
  try { fs.unlinkSync(temp); } catch (_) {}
  if (result.status !== 0) {
    failed = true;
    process.stderr.write("\nSyntax error in " + filename + "\n" + result.stderr + result.stdout);
  }
}
for (const file of files) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) { failed = true; console.error("Missing required file: " + file); continue; }
  check(fs.readFileSync(full, "utf8"), file, file.endsWith("firebase.js") || file.endsWith("chat-storage.js"));
}
for (const file of ["public/index.html", "public/admin.html"]) {
  const full = path.join(root, file);
  const html = fs.readFileSync(full, "utf8");
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  let count = 0;
  for (const match of scripts) {
    const attrs = match[1] || "";
    if (/application\/ld\+json/i.test(attrs)) continue;
    if (!match[2].trim()) continue;
    check(match[2], file + " inline script " + (++count), /type=["']module["']/i.test(attrs));
  }
  if (!count) { failed = true; console.error("No executable inline scripts found in " + file); }
}
for (const file of ["package.json", "vercel.json", "data/jarvis-knowledge.json"]) {
  try { JSON.parse(fs.readFileSync(path.join(root, file), "utf8")); }
  catch (error) { failed = true; console.error("Invalid JSON in " + file + ": " + error.message); }
}
const mainHtml = fs.readFileSync(path.join(root, "public/index.html"), "utf8");
const adminHtml = fs.readFileSync(path.join(root, "public/admin.html"), "utf8");
const adminApi = fs.readFileSync(path.join(root, "api/admin.js"), "utf8");
const profileApi = fs.readFileSync(path.join(root, "api/profile.js"), "utf8");
const healthApi = fs.readFileSync(path.join(root, "api/health.js"), "utf8");
const liveTokenApi = fs.readFileSync(path.join(root, "api/live-token.js"), "utf8");
const chatApi = fs.readFileSync(path.join(root, "api/chat.js"), "utf8");
const diagnosticsApi = fs.readFileSync(path.join(root, "api/diagnostics.js"), "utf8");
const sharedApi = fs.readFileSync(path.join(root, "api/_shared.js"), "utf8");
const adminPage = fs.readFileSync(path.join(root, "public/admin.html"), "utf8");
function requireText(source, value, label) { if (!source.includes(value)) { failed = true; console.error("Missing required behavior: " + label); } }
function forbidText(source, value, label) { if (source.includes(value)) { failed = true; console.error("Removed feature still present: " + label); } }
forbidText(mainHtml, "jarvisAnimations", "user animation toggle");
forbidText(mainHtml, "jarvisTheme", "removed dark/system theme selector");
forbidText(mainHtml, "admin-animations-off", "runtime animation override");
forbidText(mainHtml, "jarvisSoundEffects", "inactive sound effects toggle");
forbidText(adminHtml, "animationEnabled", "admin animation toggle");
forbidText(adminApi, "body.animation", "runtime animation write");
forbidText(profileApi, "animation:", "profile animation response");
requireText(mainHtml, "source.playbackRate.value = playbackRate", "Live voice speed setting");
requireText(mainHtml, "liveModelTurnActive", "accurate streamed audio speaking-state tracking");
requireText(mainHtml, "activeChatController?.abort()", "cancel stale chat requests on New Chat");
requireText(mainHtml, "state.liveSocket || liveOpening || reconnectTimer", "cancel pending Live reconnect on New Chat");
requireText(mainHtml, "i < event.results.length", "preserve final speech recognition transcript segments");
requireText(mainHtml, "state.recognition?.stop()", "stop browser speech capture on New Chat");
requireText(mainHtml, "localStorage.setItem(\"jarvisLiveVoice\",prefs.voice.value)", "persist the selected Live voice consistently");
requireText(mainHtml, "new AudioWorkletNode", "Live microphone PCM processing");
requireText(mainHtml, "realtimeInput", "Live microphone streaming");
requireText(mainHtml, "liveAttemptId", "Live startup cancellation guard");
requireText(mainHtml, "setupTimeout", "Live setup timeout");
requireText(mainHtml, "sessionResumptionUpdate", "top-level Live session resumption updates");
requireText(mainHtml, "openLive(true)", "automatic Live session resumption");
requireText(mainHtml, "resumeHandle = null;\n      reconnectAttempts = 0;", "reset stale session state before a fresh Live connection");
requireText(mainHtml, "contextWindowCompression", "long-session context compression");
requireText(mainHtml, "Connection dropped. Restoring the current voice conversation", "resumable Live disconnect recovery");
requireText(mainHtml, "reconnectAttempts < 3", "bounded Live reconnect attempts");
requireText(mainHtml, "Math.ceil(sampleRate * 0.1)", "approximately 100ms audio frame batching");
requireText(liveTokenApi, "guard(req, res", "Live token CORS/request guard");
forbidText(liveTokenApi, "Access-Control-Allow-Origin", "wildcard token CORS headers");
requireText(liveTokenApi, "controller.abort()", "Live token upstream timeout");
requireText(liveTokenApi, "bidiGenerateContentSetup", "REST-compatible constrained Gemini Live token");
requireText(liveTokenApi, "fieldMask: \"model,generationConfig.responseModalities,sessionResumption\"", "Live token locks only required fields while allowing client speech/system configuration");
forbidText(liveTokenApi, "authToken:", "invalid wrapper around REST AuthToken request body");
requireText(liveTokenApi, "v1beta/auth_tokens", "REST AuthToken creation endpoint version");
forbidText(liveTokenApi, "liveConnectConstraints:", "invalid SDK-only REST token field");
requireText(mainHtml, "v1alpha.GenerativeService.BidiGenerateContentConstrained", "ephemeral-token Live WebSocket API version");
requireText(mainHtml, "window.jarvisGetIdToken = async function", "stable Firebase ID-token provider before auth initialization");
requireText(profileApi, "Firebase Auth remains primary profile store", "profile persistence without Firestore");
requireText(profileApi, "updateUser(identity.user.uid, { displayName })", "persist profile display name to Firebase Authentication");
requireText(adminApi, "firestoreAvailable", "graceful admin dashboard without Firestore");
requireText(adminPage, "runDiagnostics", "admin backend diagnostics control");
requireText(diagnosticsApi, "geminiLiveToken", "Gemini Live token backend diagnostic");
requireText(diagnosticsApi, "testLiveSocket", "actual Gemini Live WebSocket setup handshake test");
requireText(diagnosticsApi, "geminiText", "Gemini text backend diagnostic");
requireText(sharedApi, "displayName: decoded.name || ''", "Firebase Auth display-name fallback");
requireText(mainHtml, "jarvis-premium-light-theme", "premium light interface theme");
requireText(mainHtml, "jarvisEyeBlink", "animated robot eye blink");
requireText(mainHtml, `live-robot-chest"><span>JARVIS</span><small>IP BABA</small>`, "consistent robot chest branding");
forbidText(mainHtml, "IP BABA by JARVIS AI", "duplicate live robot brandline");
forbidText(mainHtml, "JARVIS AI · by IP BABA", "duplicate chat subheading");
requireText(chatApi, "gemini-3.8-flash", "current primary chat model");
requireText(chatApi, "gemini-3.6-flash", "current fallback chat model");
requireText(chatApi, "gemini-3.6-flash", "current fallback chat model");
requireText(chatApi, "GEMINI_REQUEST_TIMEOUT_MS || 22000", "longer per-model response window");
requireText(chatApi, "MAX_TOTAL_GEMINI_MS = 48000", "streaming chat budget leaves headroom under the Vercel function timeout");
requireText(chatApi, ":streamGenerateContent?alt=sse", "Gemini text responses stream progressively over SSE");
requireText(chatApi, "text/event-stream; charset=utf-8", "chat backend emits server-sent events");
requireText(chatApi, "Promise.allSettled", "independent Firestore lookups run concurrently");
requireText(chatApi, 'logUsage(identity.user.uid, identity.user.email, "success")', "chat usage logging runs after answer streaming without blocking it");
requireText(liveTokenApi, "uses: 5", "short-lived Live token allows bounded reconnects");
requireText(diagnosticsApi, "v1beta/auth_tokens", "Live diagnostic uses the REST AuthToken creation endpoint");
requireText(diagnosticsApi, "bidiGenerateContentSetup", "Live diagnostic uses the REST AuthToken setup field");
forbidText(diagnosticsApi, "liveConnectConstraints:", "invalid SDK-only Live token field in diagnostics");
requireText(mainHtml, "Math.ceil(sampleRate * 0.1)", "Live microphone audio sent in approximately 100ms chunks");
requireText(mainHtml, "jarvisProfileNameDisplay", "inline profile username display");
requireText(mainHtml, "jarvisEditProfileName", "pencil-triggered inline profile editing");
requireText(mainHtml, "jarvisCancelProfileName", "cancelable profile username editing");
requireText(mainHtml, "jarvis-v9-professional-polish", "professional UI and fixed robot overrides");
requireText(mainHtml, "jarvis-mobile-robot-refresh-v12", "mobile-first Text and immersive Live Voice layout");
requireText(mainHtml, "readJARVISChatStream", "browser consumes progressive chat response events");
requireText(mainHtml, "requestTimeout = setTimeout(() => controller.abort(), 55000)", "browser chat timeout is aligned with backend stream budget");
forbidText(mainHtml, 'userBar.hidden', "removed reference to missing user bar DOM element");
forbidText(mainHtml, 'userBar=$("jarvisUserBar")', "removed lookup for missing user bar DOM element");
requireText(mainHtml, 'src="/assets/ipbaba-logo.png"', "local IP BABA logo used in authentication screen");
requireText(mainHtml, ".robot-orbit{animation:none!important", "robot orbit no longer spins");
requireText(mainHtml, ".live-robot-body{animation:none!important;transform:none!important}", "Live robot body stays fixed");
 requireText(chatApi, "All Gemini streaming models exhausted", "Gemini streaming failure diagnostics");
requireText(chatApi, "MAX_TOTAL_GEMINI_MS", "Gemini streaming is bounded below Vercel timeout");
requireText(chatApi, "MAX_TOTAL_GEMINI_MS", "overall Gemini streaming deadline guard");
requireText(healthApi, "gemini-3.8-flash", "health endpoint reports the current primary text model");
requireText(healthApi, "fallbackTextModel", "health endpoint reports the current fallback text model");
requireText(liveTokenApi, "v1beta/auth_tokens", "ephemeral token provisioning uses the documented REST endpoint");
// Every DOM id must be unique. Duplicate ids make UI controls and overlays unreliable.
const allIds = [...mainHtml.matchAll(/\\bid=["']([^"']+)["']/g)].map(match => match[1]);
const idCounts = new Map();
for (const id of allIds) idCounts.set(id, (idCounts.get(id) || 0) + 1);
for (const [id, count] of idCounts) {
  if (count > 1) { failed = true; console.error("Duplicate DOM id: " + id); }
}
if (failed) process.exit(1);
console.log("JARVIS syntax and JSON validation passed.");
