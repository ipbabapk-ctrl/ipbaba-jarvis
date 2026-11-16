const { guard, verifyFirebaseUser, getFirestore } = require("./_shared");

module.exports = async (req, res) => {
  if (guard(req, res, { method: req.method === "GET" ? "GET" : "POST", json: req.method !== "GET", maxBytes: 2000 })) return;
  const identity = await verifyFirebaseUser(req);
  if (identity.error) return res.status(identity.error === "firebase_admin_not_configured" ? 503 : 401).json({ error: identity.error });
  try {
    if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
    const displayName = req.method === "POST" ? String((req.body || {}).displayName || "").trim().replace(/\s+/g, " ").slice(0, 40) : "";
    if (req.method === "POST" && !displayName) return res.status(400).json({ error: "display_name_required" });
    let ref = null;
    try { const db = await getFirestore(); ref = db.collection("jarvisProfiles").doc(identity.user.uid); }
    catch (storeError) { console.warn("Profile Firestore unavailable; Firebase Auth remains primary profile store", storeError.message); }

    if (req.method === "GET") {
      let profile = {};
      if (ref) {
        try { const snap = await ref.get(); if (snap.exists) profile = snap.data(); }
        catch (error) { console.warn("Profile store read failed; using Firebase Auth profile", error.message); }
      }
      return res.status(200).json({ profile: { ...profile, displayName: profile.displayName || identity.user.displayName || "" }, storage: profile.updatedAt ? "firestore" : "firebase-auth" });
    }

    const auth = await import("firebase-admin/auth");
    const app = (await import("firebase-admin/app")).getApps()[0];
    await auth.getAuth(app).updateUser(identity.user.uid, { displayName });
    let firestoreSaved = false;
    if (ref) {
      try { await ref.set({ displayName, updatedAt: new Date().toISOString() }, { merge: true }); firestoreSaved = true; }
      catch (storeError) { console.warn("Profile saved to Firebase Auth; Firestore profile write failed", storeError.message); }
    }
    return res.status(200).json({ ok: true, displayName, storage: firestoreSaved ? "firestore+firebase-auth" : "firebase-auth", warning: firestoreSaved ? null : "firestore_unavailable" });
  } catch (error) {
    console.error("Profile API failed", error);
    return res.status(500).json({ error: "profile_update_failed", hint: String(error.message || "Firebase profile update failed.").slice(0,180) });
  }
};
