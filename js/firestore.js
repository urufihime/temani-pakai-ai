import { db } from "./firebase.js";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

/* ============================================================
   PROFIL PENGGUNA (koleksi "users", 1 dokumen per akun)
   ============================================================ */

export async function createUserProfile(uid, { name, email, role }) {
  await setDoc(doc(db, "users", uid), {
    name,
    email,
    role,               // "mahasiswa" | "dosen"
    kelas: null,        // kode kelas mahasiswa, atau kelas yang diampu dosen
    assessmentDone: false,
    assessmentScore: 0,
    assessmentLevel: "",
    assessmentDate: null,
    createdAt: serverTimestamp()
  });
}

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? { uid, ...snap.data() } : null;
}

export async function updateUserKelas(uid, kelas) {
  await updateDoc(doc(db, "users", uid), { kelas });
}

export async function updateUserProfileFields(uid, fields) {
  await updateDoc(doc(db, "users", uid), fields);
}

export async function saveAssessmentResult(uid, { score, level }) {
  await updateDoc(doc(db, "users", uid), {
    assessmentDone: true,
    assessmentScore: score,
    assessmentLevel: level,
    assessmentDate: serverTimestamp()
  });
}

/* ============================================================
   TUGAS (subkoleksi users/{uid}/tasks)
   ============================================================ */

export async function addTask(uid, { course, title, category }) {
  await addDoc(collection(db, "users", uid, "tasks"), {
    course,
    title,
    category,          // "mandiri" | "sebagian" | "sangat"
    date: new Date().toISOString().slice(0, 10),
    createdAt: serverTimestamp()
  });
}

export async function deleteTask(uid, taskId) {
  await deleteDoc(doc(db, "users", uid, "tasks", taskId));
}

export async function getTasks(uid) {
  const q = query(collection(db, "users", uid, "tasks"), orderBy("date", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/* ============================================================
   ATURAN PRIBADI (subkoleksi users/{uid}/rules) + LOG HARIAN
   (subkoleksi users/{uid}/ruleLogs)
   ============================================================ */

export async function addRule(uid, text) {
  await addDoc(collection(db, "users", uid, "rules"), {
    text,
    createdAt: serverTimestamp()
  });
}

export async function deleteRule(uid, ruleId) {
  await deleteDoc(doc(db, "users", uid, "rules", ruleId));
  const logsSnap = await getDocs(
    query(collection(db, "users", uid, "ruleLogs"), where("ruleId", "==", ruleId))
  );
  await Promise.all(logsSnap.docs.map((d) => deleteDoc(d.ref)));
}

export async function getRules(uid) {
  const snap = await getDocs(collection(db, "users", uid, "rules"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function logRule(uid, ruleId, followed) {
  const today = new Date().toISOString().slice(0, 10);
  const existingSnap = await getDocs(
    query(
      collection(db, "users", uid, "ruleLogs"),
      where("ruleId", "==", ruleId),
      where("date", "==", today)
    )
  );
  if (!existingSnap.empty) {
    await updateDoc(existingSnap.docs[0].ref, { followed });
  } else {
    await addDoc(collection(db, "users", uid, "ruleLogs"), { ruleId, date: today, followed });
  }
}

export async function getRuleLogs(uid) {
  const snap = await getDocs(collection(db, "users", uid, "ruleLogs"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/* ============================================================
   JURNAL (subkoleksi users/{uid}/journal)
   ============================================================ */

export async function addJournalEntry(uid, text) {
  await addDoc(collection(db, "users", uid, "journal"), {
    text,
    date: new Date().toISOString().slice(0, 10),
    createdAt: serverTimestamp()
  });
}

export async function getJournalEntries(uid) {
  const q = query(collection(db, "users", uid, "journal"), orderBy("date", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/* ============================================================
   UNTUK DOSEN: daftar mahasiswa dalam satu kelas + tugas mereka
   ============================================================ */

export async function getStudentsByKelas(kelas) {
  const q = query(
    collection(db, "users"),
    where("role", "==", "mahasiswa"),
    where("kelas", "==", kelas)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

// Dipanggil per mahasiswa saat dosen membuka detail / menghitung risiko.
// N+1 read yang disengaja demi kesederhanaan — cukup untuk kelas berukuran wajar.
export async function getRecentTasks(uid, days = 7) {
  const all = await getTasks(uid);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return all.filter((t) => t.date >= cutoffStr);
}

/* ============================================================
   CHAT — percakapan antara mahasiswa & dosen di kelas yang sama
   ============================================================ */

// Untuk mahasiswa: cari dosen yang mengampu kode kelas tertentu.
export async function getDosenByKelas(kelas) {
  const q = query(
    collection(db, "users"),
    where("role", "==", "dosen"),
    where("kelas", "==", kelas)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

// ID percakapan deterministik: gabungan 2 uid yang diurutkan,
// supaya mahasiswa & dosen selalu bertemu di dokumen yang sama.
export function getConversationId(uidA, uidB) {
  return [uidA, uidB].sort().join("_");
}

export async function ensureConversation(uidA, nameA, uidB, nameB, kelas) {
  const convId = getConversationId(uidA, uidB);
  const ref = doc(db, "conversations", convId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      participants: [uidA, uidB],
      participantNames: { [uidA]: nameA, [uidB]: nameB },
      kelas: kelas || null,
      lastMessage: "",
      lastMessageAt: serverTimestamp(),
      createdAt: serverTimestamp()
    });
  }
  return convId;
}

export async function getConversationMeta(convId) {
  const snap = await getDoc(doc(db, "conversations", convId));
  return snap.exists() ? snap.data() : null;
}

export async function sendChatMessage(convId, senderId, text) {
  await addDoc(collection(db, "conversations", convId, "messages"), {
    senderId,
    text,
    createdAt: serverTimestamp()
  });
  await updateDoc(doc(db, "conversations", convId), {
    lastMessage: text,
    lastSenderId: senderId,
    lastMessageAt: serverTimestamp()
  });
}

// Tandai percakapan sudah dibaca oleh user tertentu (dipanggil saat
// mereka membuka/aktif melihat percakapan itu).
export async function markConversationRead(convId, uid) {
  await updateDoc(doc(db, "conversations", convId), {
    [`lastReadBy.${uid}`]: serverTimestamp()
  });
}

// Listener real-time jumlah percakapan yang punya pesan belum dibaca
// untuk user tertentu. callback(count, unreadConvIds).
export function listenUnreadConversations(uid, callback) {
  const q = query(collection(db, "conversations"), where("participants", "array-contains", uid));
  return onSnapshot(q, (snap) => {
    let count = 0;
    const unreadConvIds = [];
    snap.docs.forEach((d) => {
      const data = d.data();
      if (!data.lastSenderId || data.lastSenderId === uid) return;
      const lastMsgMillis = data.lastMessageAt && data.lastMessageAt.toMillis ? data.lastMessageAt.toMillis() : 0;
      const readTs = data.lastReadBy && data.lastReadBy[uid];
      const readMillis = readTs && readTs.toMillis ? readTs.toMillis() : 0;
      if (lastMsgMillis > readMillis) {
        count++;
        unreadConvIds.push(d.id);
      }
    });
    callback(count, unreadConvIds);
  });
}

// Listener real-time. Mengembalikan fungsi unsubscribe.
export function listenChatMessages(convId, callback) {
  const q = query(collection(db, "conversations", convId, "messages"), orderBy("createdAt", "asc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

/* ============================================================
   TARGET SEMESTER — subkoleksi users/{uid}/targets
   ============================================================ */

export async function addTarget(uid, { course, title, startCategory, endCategory, startDate }) {
  await addDoc(collection(db, "users", uid, "targets"), {
    course,
    title,
    startCategory,   // key CATEGORY_ORDER, titik awal (self-assessment)
    endCategory,     // key CATEGORY_ORDER, target di akhir semester (minggu 14)
    startDate,        // yyyy-mm-dd, dianggap minggu ke-1
    createdAt: serverTimestamp()
  });
}

export async function getTargets(uid) {
  const q = query(collection(db, "users", uid, "targets"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function deleteTarget(uid, targetId) {
  await deleteDoc(doc(db, "users", uid, "targets", targetId));
}

// Isi/ubah capaian manual untuk minggu tertentu (1-19) pada satu target semester.
export async function updateTargetWeeklyActual(uid, targetId, week, categoryKey) {
  await updateDoc(doc(db, "users", uid, "targets", targetId), {
    [`weeklyActuals.${week}`]: categoryKey
  });
}
