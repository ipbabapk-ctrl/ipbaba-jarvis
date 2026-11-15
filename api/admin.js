const { guard, verifyFirebaseUser } = require("./_shared");
module.exports = async (req, res) => {
  if (guard(req, res, { method: "GET", json: false, maxBytes: 1000 })) return;
  const identity = await verifyFirebaseUser(req);
  if (identity.error) return res.status(identity.error === "firebase_admin_not_configured" ? 503 : 401).json({ error: identity.error });
  if (!identity.user.admin) return res.status(403).json({ error: "admin_only" });
  try {
    const admin = await import("firebase-admin/app");
    const authMod = await import("firebase-admin/auth");
    const app = admin.getApps()[0];
    const result = await authMod.getAuth(app).listUsers(1000);
    return res.status(200).json({ users: result.users.map(u => ({ uid:u.uid, email:u.email || "", displayName:u.displayName || "", disabled:!!u.disabled, emailVerified:!!u.emailVerified, createdAt:u.metadata.creationTime || "" })), nextPageToken: result.pageToken || null });
  } catch (error) { console.error("Admin user list failed", error); return res.status(500).json({ error:"admin_request_failed" }); }
}
