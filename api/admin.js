const { guard, verifyFirebaseUser, getFirestore, readKnowledge, getRuntimeConfig } = require("./_shared");
module.exports = async (req, res) => {
  if (guard(req, res, { method: "GET", json: false, maxBytes: 1000 })) return;
  const identity = await verifyFirebaseUser(req);
  if (identity.error) return res.status(identity.error === "firebase_admin_not_configured" ? 503 : 401).json({ error: identity.error });
  if (!identity.user.admin) return res.status(403).json({ error: "admin_only" });
  try {
    const admin = await import("firebase-admin/app");
    const authMod = await import("firebase-admin/auth");
    const app = admin.getApps()[0];
    const db = await getFirestore();
    const result = await authMod.getAuth(app).listUsers(1000);
    const [usageSnap, config, profilesSnap] = await Promise.all([
      db.collection("jarvisUsage").get(), getRuntimeConfig(), db.collection("jarvisProfiles").get()
    ]);
    const usage = new Map(usageSnap.docs.map(d => [d.id, d.data()]));
    const profiles = new Map(profilesSnap.docs.map(d => [d.id, d.data()]));
    const users = result.users.map(u => ({
      uid:u.uid, email:u.email || "", displayName:(profiles.get(u.uid)||{}).displayName || u.displayName || "",
      disabled:!!u.disabled || !!((profiles.get(u.uid)||{}).disabled),
      emailVerified:!!u.emailVerified, createdAt:u.metadata.creationTime || "",
      requests:Number((usage.get(u.uid)||{}).requests || 0), lastSeenAt:(usage.get(u.uid)||{}).lastSeenAt || ""
    }));
    return res.status(200).json({
      users, nextPageToken: result.pageToken || null,
      knowledge: readKnowledge(), instructions: String(config.instructions || ""),
      animation: config.animation || { enabled:true, style:"3d-robot" },
      capabilities: { userDirectory:true, adminKnowledgeBase:true, adminInstructionEditor:true, analytics:true, userModerationActions:true, firestore:true },
      usageTotals: { requests:users.reduce((n,u)=>n+u.requests,0), activeUsers:users.filter(u=>u.requests>0).length }
    });
  } catch (error) {
    console.error("Admin user list failed", error);
    return res.status(500).json({ error:"admin_request_failed" });
  }
};
