import { requireAuth, logout, blockIfInstitutionInactive } from "./authGuard.js";
import {
  getUserProfile,
  syncDosenKelasCodes,
  getDosenByKelas,
  getStudentsByKelas,
  ensureConversation,
  getConversationMeta,
  getConversationId,
  sendChatMessage,
  listenChatMessages,
  markConversationRead,
  listenUnreadConversations
} from "./firestore.js";
import { escapeHtml } from "./utils.js";

const root = document.getElementById("root");
document.getElementById("logoutBtn").addEventListener("click", logout);

let CURRENT_USER = null;
let PROFILE = null;
let CONTACTS = [];
let ACTIVE_CONTACT = null;
let ACTIVE_CONV_ID = null;
let UNSUBSCRIBE = null;
let UNREAD_CONV_IDS = new Set();

requireAuth(async (user) => {
  CURRENT_USER = user;
  PROFILE = await getUserProfile(user.uid);
  if (await blockIfInstitutionInactive(root, PROFILE)) return;
  await syncDosenKelasCodes(PROFILE);

  document.getElementById("userGreeting").textContent = `${PROFILE.name} · ${PROFILE.role === "dosen" ? "Dosen" : "Mahasiswa"}`;

  const belumSetup = PROFILE.role === "dosen"
    ? !PROFILE.kelasList || PROFILE.kelasList.length === 0
    : !PROFILE.kelas;

  if (belumSetup) {
    root.innerHTML = `
      <div class="card">
        <p class="empty">Selesaikan setup kode kelas dulu di dashboard sebelum bisa mulai chat.</p>
        <a href="dashboard.html" class="btn btn-primary" style="text-decoration:none;">Ke Dashboard</a>
      </div>
    `;
    return;
  }

  if (PROFILE.role === "mahasiswa") {
    CONTACTS = await getDosenByKelas(PROFILE.kelas, PROFILE.institusiId);
  } else {
    // Gabungkan mahasiswa dari semua mata kuliah/kelas dosen (maks 3), tanpa duplikat.
    const lists = await Promise.all(PROFILE.kelasList.map((k) => getStudentsByKelas(k.kodeKelas, PROFILE.institusiId)));
    const seen = new Map();
    lists.flat().forEach((s) => seen.set(s.uid, s));
    CONTACTS = [...seen.values()];
  }

  await renderLayout();

  listenUnreadConversations(CURRENT_USER.uid, (count, unreadConvIds) => {
    UNREAD_CONV_IDS = new Set(unreadConvIds);
    updateUnreadDots();
  });
});

async function renderLayout() {
  const previews = await Promise.all(
    CONTACTS.map((c) => getConversationMeta(getConversationId(CURRENT_USER.uid, c.uid)))
  );

  const sidebarHead = PROFILE.role === "mahasiswa"
    ? "Dosen Kelasmu"
    : `Mahasiswa · ${PROFILE.kelasList.map((k) => escapeHtml(k.mataKuliah)).join(", ")}`;

  root.innerHTML = `
    <div class="chat-layout">
      <div class="chat-sidebar" id="chatSidebar">
        <div class="chat-sidebar-head">${sidebarHead}</div>
        ${CONTACTS.length === 0
          ? `<p class="empty" style="padding:16px;">${PROFILE.role === "mahasiswa" ? "Belum ada dosen terdaftar di kelasmu." : "Belum ada mahasiswa di kelasmu."}</p>`
          : CONTACTS.map((c, i) => `
            <button type="button" class="contact-item" data-uid="${c.uid}">
              <div class="contact-name">${escapeHtml(c.name)}<span class="contact-unread-dot" id="dot-${c.uid}" style="display:none;"></span></div>
              <div class="contact-preview">${previews[i] && previews[i].lastMessage ? escapeHtml(previews[i].lastMessage) : "Belum ada pesan"}</div>
            </button>
          `).join("")}
      </div>
      <div class="chat-main" id="chatMain">
        <div class="chat-placeholder">Pilih ${PROFILE.role === "mahasiswa" ? "dosen" : "mahasiswa"} di samping untuk mulai chat.</div>
      </div>
    </div>
  `;

  document.querySelectorAll(".contact-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const contact = CONTACTS.find((c) => c.uid === btn.dataset.uid);
      document.querySelectorAll(".contact-item").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      openConversation(contact);
    });
  });

  updateUnreadDots();
}

function updateUnreadDots() {
  CONTACTS.forEach((c) => {
    const dot = document.getElementById(`dot-${c.uid}`);
    if (!dot) return;
    const convId = getConversationId(CURRENT_USER.uid, c.uid);
    dot.style.display = UNREAD_CONV_IDS.has(convId) ? "inline-block" : "none";
  });
}

async function openConversation(contact) {
  ACTIVE_CONTACT = contact;
  if (UNSUBSCRIBE) UNSUBSCRIBE();

  ACTIVE_CONV_ID = await ensureConversation(
    CURRENT_USER.uid, PROFILE.name, PROFILE.role,
    contact.uid, contact.name, contact.role,
    PROFILE.role === "mahasiswa" ? PROFILE.kelas : contact.kelas
  );

  const chatMain = document.getElementById("chatMain");
  chatMain.innerHTML = `
    <div class="chat-header">${escapeHtml(contact.name)}</div>
    <div class="chat-messages" id="chatMessages"><p class="empty">Memuat pesan…</p></div>
    <div class="chat-input-row">
      <textarea id="chatInput" placeholder="Tulis pesan…"></textarea>
      <button class="btn btn-primary" id="sendBtn">Kirim</button>
    </div>
  `;

  document.getElementById("sendBtn").addEventListener("click", sendCurrentMessage);
  document.getElementById("chatInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendCurrentMessage();
    }
  });

  await markConversationRead(ACTIVE_CONV_ID, CURRENT_USER.uid);
  UNSUBSCRIBE = listenChatMessages(ACTIVE_CONV_ID, renderMessages);
}

function renderMessages(messages) {
  const box = document.getElementById("chatMessages");
  if (!box) return;

  box.innerHTML = messages.length === 0
    ? `<p class="empty">Belum ada pesan. Mulai percakapan!</p>`
    : messages.map((m) => {
        const mine = m.senderId === CURRENT_USER.uid;
        const time = m.createdAt && m.createdAt.toDate
          ? m.createdAt.toDate().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
          : "…";
        return `
          <div class="msg-bubble ${mine ? "me" : "them"}">
            ${escapeHtml(m.text)}
            <span class="msg-time">${time}</span>
          </div>
        `;
      }).join("");

  box.scrollTop = box.scrollHeight;

  if (ACTIVE_CONV_ID) markConversationRead(ACTIVE_CONV_ID, CURRENT_USER.uid);
}

async function sendCurrentMessage() {
  const input = document.getElementById("chatInput");
  const text = input.value.trim();
  if (!text || !ACTIVE_CONV_ID) return;
  input.value = "";
  await sendChatMessage(ACTIVE_CONV_ID, CURRENT_USER.uid, text);
}
