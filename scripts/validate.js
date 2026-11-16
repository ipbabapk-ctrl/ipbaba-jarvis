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
  "api/live-token.js",
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
const liveTokenApi = fs.readFileSync(path.join(root, "api/live-token.js"), "utf8");
const chatApi = fs.readFileSync(path.join(root, "api/chat.js"), "utf8");
function requireText(source, value, label) { if (!source.includes(value)) { failed = true; console.error("Missing required behavior: " + label); } }
function forbidText(source, value, label) { if (source.includes(value)) { failed = true; console.error("Removed feature still present: " + label); } }
forbidText(mainHtml, "jarvisAnimations", "user animation toggle");
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
requireText(mainHtml, "contextWindowCompression", "long-session context compression");
requireText(mainHtml, "Connection dropped. Restoring the current voice conversation", "resumable Live disconnect recovery");
requireText(mainHtml, "reconnectAttempts < 3", "bounded Live reconnect attempts");
requireText(mainHtml, "this.buffer.length >= 1764", "low-latency audio frame batching");
requireText(liveTokenApi, "guard(req, res", "Live token CORS/request guard");
forbidText(liveTokenApi, "Access-Control-Allow-Origin", "wildcard token CORS headers");
requireText(liveTokenApi, "controller.abort()", "Live token upstream timeout");
requireText(chatApi, "gemini-3.8-flash", "current primary chat model");
requireText(chatApi, "gemini-3.7-flash", "current fallback chat model");
if (failed) process.exit(1);
console.log("JARVIS syntax and JSON validation passed.");
