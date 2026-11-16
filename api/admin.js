const { guard, verifyFirebaseUser, getFirestore, readKnowledge, getRuntimeConfig } = require("./_shared");
module.exports = async (req, res) => {
  if (req.method === "OPTIONS") { guard(req, res, { method: "POST", json: true, maxBytes: 40000 }); return; }
  if (req.method !== "GET" && req.method !== "POST") { res.setHeader("Allow", "GET, POST, OPTIONS"); return res.status(405).json({error:"method_not_allowed"}); }
  if (guard(req, res, { method: req.method, json: req.method === "POST", maxBytes: 40000 })) return;
  const identity = await verifyFirebaseUser(req);
  if (identity.error) return res.status(identity.error === "firebase_admin_not_configured" ? 503 : 401).json({ error: identity.error });
  if (!identity.user.admin) return res.status(403).json({ error: "admin_only" });
  if (req.method === "POST") {
    let body = req.body || {};
    let action = String(body.action || "");
    try {
      const db = await getFirestore();
      if (action === "save-config") {
        const instructions = String(body.instructions || "").slice(0, 12000);
        const animation = body.animation && typeof body.animation === "object" ? { enabled: body.animation.enabled !== false, style: "3d-robot" } : {enabled:true,style:"3d-robot"};
        let knowledge;
        if (body.knowledgeJson !== undefined) {
          if (typeof body.knowledgeJson !== "string" || body.knowledgeJson.length > 30000) return res.status(400).json({error:"knowledge_json_too_large"});
          try { knowledge = JSON.parse(body.knowledgeJson); } catch (_) { return res.status(400).json({error:"invalid_knowledge_json"}); }
          if (!knowledge || Array.isArray(knowledge) || typeof knowledge !== "object") return res.status(400).json({error:"knowledge_must_be_object"});
        }
        const update = {instructions,animation,updatedAt:new Date().toISOString(),updatedBy:identity.user.email};
        if (knowledge) update.knowledge = knowledge;
        await db.collection("jarvisConfig").doc("runtime").set(update,{merge:true});
        return res.status(200).json({ok:true});
      }
      if (action === "save-profile") {
        const uid=String(body.uid||"");
        const displayName=String(body.displayName||"").trim().slice(0,40);
        if(!uid || !displayName) return res.status(400).json({error:"uid_and_name_required"});
        await db.collection("jarvisProfiles").doc(uid).set({displayName,updatedAt:new Date().toISOString()},{merge:true});
        return res.status(200).json({ok:true});
      }
      if (action === "moderate-user") {
        const uid=String(body.uid||"");
        if(!uid || uid===identity.user.uid) return res.status(400).json({error:"invalid_target_uid"});
        const authMod=await import("firebase-admin/auth");
        await authMod.getAuth((await import("firebase-admin/app")).getApps()[0]).updateUser(uid,{disabled:body.disabled===true});
        await db.collection("jarvisProfiles").doc(uid).set({disabled:body.disabled===true,moderatedAt:new Date().toISOString(),moderatedBy:identity.user.email},{merge:true});
        return res.status(200).json({ok:true});
      }
      if (action === "get-knowledge") return res.status(200).json({knowledge:readKnowledge()});
      return res.status(400).json({error:"unknown_admin_action"});
    } catch(error) { console.error("Admin action failed",error); return res.status(500).json({error:"admin_action_failed"}); }
  }
  try {
    const admin = await import("firebase-admin/app");
    const authMod = await import("firebase-admin/auth");
    const app = admin.getApps()[0];
    const db = await getFirestore();
    const pageToken = String((req.query && req.query.pageToken) || "");
    const result = await authMod.getAuth(app).listUsers(1000, pageToken || undefined);
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
      knowledge: config.knowledge || readKnowledge(), instructions: String(config.instructions || ""),
      animation: config.animation || { enabled:true, style:"3d-robot" },
      capabilities: { userDirectory:true, adminKnowledgeBase:true, adminInstructionEditor:true, analytics:true, userModerationActions:true, firestore:true },
      usageTotals: { requests:usageSnap.docs.reduce((n,d)=>n+Number((d.data()||{}).requests||0),0), activeUsers:usageSnap.docs.filter(d=>Number((d.data()||{}).requests||0)>0).length }
    });
  } catch (error) {
    console.error("Admin user list failed", error);
    return res.status(500).json({ error:"admin_request_failed" });
  }
};
