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
if (failed) process.exit(1);
console.log("JARVIS syntax and JSON validation passed.");
