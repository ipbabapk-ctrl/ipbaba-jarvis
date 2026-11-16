const { guard, verifyFirebaseUser, getFirestore } = require("./_shared");

module.exports = async (req, res) => {
  if (guard(req, res, { method: req.method === "GET" ? "GET" : "POST", json: req.method !== "GET", maxBytes: 2000 })) return;
  const identity = await verifyFirebaseUser(req);
  if (identity.error) return res.status(identity.error === "firebase_admin_not_configured" ? 503 : 401).json({ error: identity.error });
  try {
    const db = await getFirestore();
    const ref = db.collection("jarvisProfiles").doc(identity.user.uid);
    if (req.method === "GET") {
      const snap = await ref.get();
      return res.status(200).json({ profile: snap.exists ? snap.data() : {} });
    }
    if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
    const displayName = String((req.body || {}).displayName || "").trim().replace(/\s+/g, " ").slice(0, 40);
    if (!displayName) return res.status(400).json({ error: "display_name_required" });
    await ref.set({ displayName, updatedAt: new Date().toISOString() }, { merge: true });
    const auth = await import("firebase-admin/auth");
    const app = (await import("firebase-admin/app")).getApps()[0];
    await auth.getAuth(app).updateUser(identity.user.uid, { displayName });
    return res.status(200).json({ ok: true, displayName });
  } catch (error) {
    console.error("Profile API failed", error);
    return res.status(500).json({ error: "profile_update_failed" });
  }
};
