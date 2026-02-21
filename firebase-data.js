import { db } from "./firebase.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

/**
 * ✅ 关键修复：
 * 1) 每台设备生成一个稳定的 deviceId（存在 localStorage）
 * 2) 如果 gwm_user.id 还是 "local-user"，就自动替换成 deviceId（避免跨设备冲突）
 */
function safeUserFromLocal() {
  // 1) deviceId：每台设备唯一、持久
  let deviceId = localStorage.getItem("gwm_device_id");
  if (!deviceId) {
    const rnd = crypto.getRandomValues(new Uint32Array(4)).join("-");
    deviceId = "dev_" + rnd;
    localStorage.setItem("gwm_device_id", deviceId);
  }

  // 2) 读 gwm_user
  let u = {};
  try {
    const raw = localStorage.getItem("gwm_user");
    u = raw ? JSON.parse(raw) : {};
  } catch {
    u = {};
  }

  const username = u.username || "Guest";
  const email = u.email || "";
  const photoDataUrl = u.photoDataUrl || "";

  // 3) 如果 id 不存在 或 还是 local-user，就强制用 deviceId
  const badId = !u.id || u.id === "local-user" || u.id === "local_user";
  const id = badId ? deviceId : u.id;

  // 4) 写回（保证后续所有地方都用这个新 id）
  if (badId) {
    localStorage.setItem(
      "gwm_user",
      JSON.stringify({ ...u, id, username, email, photoDataUrl })
    );
  }

  return { id, username, email, photoDataUrl };
}

export async function fbCreateGroup({ name, description = "", invited = [], bannerDataUrl = "" }) {
  const user = safeUserFromLocal();
  const id = "g_" + Date.now();
  const code = makeCode();

  const groupDoc = {
    id,
    code,
    name,
    description,
    bannerDataUrl,
    members: [{
      id: user.id,
      username: user.username,
      email: user.email,
      role: "owner",
      photoDataUrl: user.photoDataUrl || "",
      joinedAt: Date.now()
    }],
    invited,
    workItems: [],
    workLogs: [],
    completedTaskIds: [],
    createdBy: user.id,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    createdAtServer: serverTimestamp(),
    updatedAtServer: serverTimestamp()
  };

  await setDoc(doc(db, "groups", id), groupDoc);
  return groupDoc;
}

export async function fbJoinGroup({ code, displayName = "" }) {
  const user = safeUserFromLocal();

  const q = query(collection(db, "groups"), where("code", "==", code));
  const snap = await getDocs(q);

  if (snap.empty) throw new Error("Group code not found");

  const ref = snap.docs[0];
  const data = ref.data();

  const members = Array.isArray(data.members) ? [...data.members] : [];
  const existingIndex = members.findIndex(
    (m) => (m.id && m.id === user.id) || (m.email && m.email === user.email)
  );

  const memberObj = {
    id: user.id,
    username: displayName || user.username || "Guest",
    email: user.email || "",
    photoDataUrl: user.photoDataUrl || "",
    role: existingIndex >= 0 ? (members[existingIndex].role || "member") : "member",
    joinedAt: existingIndex >= 0 ? (members[existingIndex].joinedAt || Date.now()) : Date.now()
  };

  if (existingIndex >= 0) members[existingIndex] = memberObj;
  else members.push(memberObj);

  await updateDoc(doc(db, "groups", data.id), {
    members,
    updatedAt: Date.now(),
    updatedAtServer: serverTimestamp()
  });

  return { ...data, members };
}

export async function fbGetGroupById(groupId) {
  const snap = await getDoc(doc(db, "groups", groupId));
  if (!snap.exists()) return null;
  return snap.data();
}

export async function fbGetMyGroups() {
  const user = safeUserFromLocal();
  const snap = await getDocs(collection(db, "groups"));
  const all = snap.docs.map(d => d.data());

  // ✅ 只返回：我创建的 或 我在 members 里
  return all
    .filter(g => {
      if (g.createdBy === user.id) return true;
      const members = Array.isArray(g.members) ? g.members : [];
      return members.some(m => (m.id && m.id === user.id) || (m.email && m.email === user.email));
    })
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export async function fbToggleTaskComplete(groupId, taskId) {
  const snap = await getDoc(doc(db, "groups", groupId));
  if (!snap.exists()) throw new Error("Group not found");
  const g = snap.data();

  const list = Array.isArray(g.completedTaskIds) ? [...g.completedTaskIds] : [];
  const id = String(taskId || "");
  const idx = list.indexOf(id);
  if (idx >= 0) list.splice(idx, 1);
  else list.push(id);

  await updateDoc(doc(db, "groups", groupId), {
    completedTaskIds: list,
    updatedAt: Date.now(),
    updatedAtServer: serverTimestamp()
  });

  return { ...g, completedTaskIds: list };
}

export async function fbAppendWorkLog(groupId, logInput) {
  const snap = await getDoc(doc(db, "groups", groupId));
  if (!snap.exists()) throw new Error("Group not found");
  const g = snap.data();

  const user = safeUserFromLocal();
  const workItems = Array.isArray(g.workItems) ? [...g.workItems] : [];
  const workLogs = Array.isArray(g.workLogs) ? [...g.workLogs] : [];

  let taskId = logInput.taskId || "";
  let taskName = (logInput.taskName || "").trim();

  if (!taskId && taskName) {
    taskId = "t_" + Date.now();
    workItems.unshift({ id: taskId, name: taskName, createdAt: Date.now() });
  } else if (taskId) {
    const found = workItems.find(x => x.id === taskId);
    taskName = found ? found.name : "Task";
  }

  const newLog = {
    id: "log_" + Date.now(),
    taskId,
    taskName: taskName || "Task",
    stars: Number(logInput.stars || 0),
    minutes: Number(logInput.minutes || 0),
    photoDataUrl: logInput.photoDataUrl || "",
    description: (logInput.description || "").trim(),
    memberId: user.id,
    memberName: user.username || "Guest",
    memberEmail: user.email || "",
    memberPhotoDataUrl: user.photoDataUrl || "",
    createdAt: Date.now()
  };

  workLogs.unshift(newLog);

  await updateDoc(doc(db, "groups", groupId), {
    workItems,
    workLogs,
    updatedAt: Date.now(),
    updatedAtServer: serverTimestamp()
  });

  return { ...g, workItems, workLogs };
}

/** ✅ 删除 group：dashboard.js 里的 delete 按钮就靠它 */
export async function fbDeleteGroup(groupId) {
  if (!groupId) throw new Error("Missing groupId");
  await deleteDoc(doc(db, "groups", groupId));
  return true;
}