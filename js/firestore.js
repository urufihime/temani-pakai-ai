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
  runTransaction,
  Timestamp,
  increment,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

/* ============================================================
   PROFIL PENGGUNA (koleksi "users", 1 dokumen per akun)
   ============================================================ */

export async function createUserProfile(uid, { name, email, role, institusiId }) {
  await setDoc(doc(db, "users", uid), {
    name,
    email,
    role,               // "mahasiswa" | "dosen" | "admin"
    institusiId: institusiId || null, // kode institusi (SaaS multi-tenant)
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

export async function getStudentsByKelas(kelas, institusiId) {
  const clauses = [
    where("role", "==", "mahasiswa"),
    where("kelas", "==", kelas)
  ];
  if (institusiId) clauses.push(where("institusiId", "==", institusiId));
  const q = query(collection(db, "users"), ...clauses);
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
// Dosen bisa punya sampai 3 mata kuliah/kelas, disimpan di kelasCodes (array).
export async function getDosenByKelas(kelas, institusiId) {
  const clauses = [
    where("role", "==", "dosen"),
    where("kelasCodes", "array-contains", kelas)
  ];
  if (institusiId) clauses.push(where("institusiId", "==", institusiId));
  const q = query(collection(db, "users"), ...clauses);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

// Pastikan kelasCodes (dipakai Firestore Rules) selalu sama dengan kelasList.
// Kalau tidak sinkron, rules menolak dosen membaca data mahasiswa kelas yang
// ada di kelasList tapi tidak ada di kelasCodes. Aman dipanggil berulang.
export async function syncDosenKelasCodes(profile) {
  if (!profile || profile.role !== "dosen" || !Array.isArray(profile.kelasList)) return;
  const wanted = profile.kelasList.slice(0, 3).map((k) => k.kodeKelas);
  const current = Array.isArray(profile.kelasCodes) ? profile.kelasCodes : [];
  const same = wanted.length === current.length && wanted.every((c, i) => c === current[i]);
  if (same) return;
  try {
    await updateDoc(doc(db, "users", profile.uid), { kelasCodes: wanted });
    profile.kelasCodes = wanted;
  } catch (err) {
    console.warn("Gagal sinkron kelasCodes:", err);
  }
}

// Simpan daftar mata kuliah/kelas dosen (maksimal 3). kelasList: [{kodeKelas, mataKuliah}]
export async function updateDosenKelasList(uid, kelasList) {
  const trimmed = (kelasList || []).slice(0, 3);
  await updateDoc(doc(db, "users", uid), {
    kelasList: trimmed,
    kelasCodes: trimmed.map((k) => k.kodeKelas)
  });
}

// ID percakapan deterministik: gabungan 2 uid yang diurutkan,
// supaya mahasiswa & dosen selalu bertemu di dokumen yang sama.
export function getConversationId(uidA, uidB) {
  return [uidA, uidB].sort().join("_");
}

export async function ensureConversation(uidA, nameA, roleA, uidB, nameB, roleB, kelas) {
  const convId = getConversationId(uidA, uidB);
  const ref = doc(db, "conversations", convId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      participants: [uidA, uidB],
      participantNames: { [uidA]: nameA, [uidB]: nameB },
      studentId: roleA === "mahasiswa" ? uidA : uidB,
      dosenId: roleA === "dosen" ? uidA : uidB,
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
  const cleanText = String(text || "").trim().slice(0, 4000);
  if (!cleanText) return;
  await addDoc(collection(db, "conversations", convId, "messages"), {
    senderId,
    text: cleanText,
    createdAt: serverTimestamp()
  });
  await updateDoc(doc(db, "conversations", convId), {
    lastMessage: cleanText,
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
  }, (err) => {
    // Jangan sampai badge chat yang gagal memuat mengganggu halaman utama.
    console.warn("Listener chat belum bisa dibaca:", err.code || err);
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

/* ============================================================
   INSTITUSI — untuk model SaaS multi-institusi.
   Dokumen ID = kode institusi itu sendiri (unik otomatis).
   ============================================================ */

export async function createInstitution(kodeInstitusi, { nama, status, expiresAt, catatan }) {
  if (!kodeInstitusi) throw new Error("Kode institusi tidak boleh kosong.");
  await setDoc(doc(db, "institutions", kodeInstitusi), {
    nama,
    status: status || "aktif", // "aktif" | "nonaktif"
    expiresAt: expiresAt || null, // yyyy-mm-dd atau null = tanpa batas waktu
    catatan: catatan || "",
    createdAt: serverTimestamp()
  });
}

export async function getInstitution(kodeInstitusi) {
  if (!kodeInstitusi) return null;
  const snap = await getDoc(doc(db, "institutions", kodeInstitusi));
  return snap.exists() ? { id: kodeInstitusi, ...snap.data() } : null;
}

export async function getAllInstitutions() {
  const snap = await getDocs(collection(db, "institutions"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function updateInstitution(kodeInstitusi, fields) {
  await updateDoc(doc(db, "institutions", kodeInstitusi), fields);
}

export async function deleteInstitution(kodeInstitusi) {
  await deleteDoc(doc(db, "institutions", kodeInstitusi));
}

// Berapa banyak user (mahasiswa+dosen) terdaftar di satu institusi.
export async function countUsersInInstitution(kodeInstitusi) {
  const q = query(collection(db, "users"), where("institusiId", "==", kodeInstitusi));
  const snap = await getDocs(q);
  return snap.size;
}

/* ============================================================
   PROGRAM DEMO DOSEN — satu kode, banyak dosen, ruang terpisah.
   ============================================================ */

export async function createDemoProgram(code, data) {
  await setDoc(doc(db, "demoPrograms", code), {
    name: data.name,
    status: "aktif",
    maxLecturers: Number(data.maxLecturers),
    registeredCount: 0,
    registrationEndsAt: Timestamp.fromDate(new Date(`${data.registrationEndsAt}T23:59:59.999`)),
    accessEndsAt: Timestamp.fromDate(new Date(`${data.accessEndsAt}T23:59:59.999`)),
    createdAt: serverTimestamp()
  });
}

export async function getDemoProgram(code) {
  if (!code) return null;
  const snap = await getDoc(doc(db, "demoPrograms", code));
  return snap.exists() ? { id: code, ...snap.data() } : null;
}

export async function getAllDemoPrograms() {
  const snap = await getDocs(collection(db, "demoPrograms"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function updateDemoProgram(code, fields) {
  const clean = { ...fields };
  if (typeof clean.registrationEndsAt === "string") {
    clean.registrationEndsAt = Timestamp.fromDate(new Date(`${clean.registrationEndsAt}T23:59:59.999`));
  }
  if (typeof clean.accessEndsAt === "string") {
    clean.accessEndsAt = Timestamp.fromDate(new Date(`${clean.accessEndsAt}T23:59:59.999`));
  }
  await updateDoc(doc(db, "demoPrograms", code), clean);
}

export async function deleteDemoProgram(code) {
  await deleteDoc(doc(db, "demoPrograms", code));
}

export async function claimDemoProgram(uid, { name, email, demoCode, institutionName }) {
  const programRef = doc(db, "demoPrograms", demoCode);
  const userRef = doc(db, "users", uid);
  const institutionId = `DEMO-${uid.slice(0, 10).toUpperCase()}`;
  const institutionRef = doc(db, "institutions", institutionId);

  await runTransaction(db, async (transaction) => {
    const programSnap = await transaction.get(programRef);
    if (!programSnap.exists()) throw new Error("Kode demo tidak ditemukan.");
    const program = programSnap.data();
    if (program.status !== "aktif") throw new Error("Program demo tidak aktif.");
    if (program.registrationEndsAt.toDate() < new Date()) throw new Error("Pendaftaran program demo sudah berakhir.");
    if (program.registeredCount >= program.maxLecturers) throw new Error("Kuota program demo sudah penuh.");

    transaction.set(institutionRef, {
      nama: institutionName,
      status: "aktif",
      type: "demo",
      ownerDosenId: uid,
      demoProgramId: demoCode,
      accessEndsAt: program.accessEndsAt,
      expiresAt: null,
      catatan: "Ruang demo otomatis",
      createdAt: serverTimestamp()
    });
    transaction.set(userRef, {
      name,
      email: email.trim().toLowerCase(),
      role: "dosen",
      institusiId: institutionId,
      demoProgramId: demoCode,
      accessEndsAt: program.accessEndsAt,
      kelas: null,
      kelasList: [],
      kelasCodes: [],
      assessmentDone: false,
      assessmentScore: 0,
      assessmentLevel: "",
      assessmentDate: null,
      createdAt: serverTimestamp()
    });
    transaction.update(programRef, { registeredCount: increment(1) });
  });

  return institutionId;
}
