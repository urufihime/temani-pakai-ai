import { requireAuth, logout } from "./authGuard.js";
import {
  getUserProfile,
  getDosenByKelas,
  getStudentsByKelas,
  ensureConversation,
  getConversationMeta,
  getConversationId,
  sendChatMessage,
  listenChatMessages
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

requireAuth(async (user) => {
  CURRENT_USER = user;
  PROFILE = await getUserProfile(user.uid);
  document.getElementById("userGreeting").textContent = `${PROFILE.name} · ${PROFILE.role === "dosen" ? "Dosen" : "Mahasiswa"}`;

  if (!PROFILE.kelas) {
    root.innerHTML = `
      <div class="card">
        <p class="empty">Selesaikan setup kode kelas dulu di dashboard sebelum bisa mulai chat.</p>
        <a href="dashboard.html" class="btn btn-primary" style="text-decoration:none;">Ke Dashboard</a>
      </div>
    `;
    return;
  }

  CONTACTS = PROFILE.role === "mahasiswa"
    ? await getDosenByKelas(PROFILE.kelas)
    : await getStudentsByKelas(PROFILE.kelas);

  await renderLayout();
});

async function renderLayout() {
  const previews = await Promise.all(
    CONTACTS.map((c) => getConversationMeta(getConversationId(CURRENT_USER.uid, c.uid)))
  );

  root.innerHTML = `
    <div class="chat-layout">
      <div class="chat-sidebar" id="chatSidebar">
        <div class="chat-sidebar-head">${PROFILE.role === "mahasiswa" ? "Dosen Kelasmu" : `Mahasiswa · ${escapeHtml(PROFILE.kelas)}`}</div>
        ${CONTACTS.length === 0
          ? `<p class="empty" style="padding:16px;">${PROFILE.role === "mahasiswa" ? "Belum ada dosen terdaftar di kelasmu." : "Belum ada mahasiswa di kelasmu."}</p>`
          : CONTACTS.map((c, i) => `
            <button type="button" class="contact-item" data-uid="${c.uid}">
              <div class="contact-name">${escapeHtml(c.name)}</div>
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
}

async function openConversation(contact) {
  ACTIVE_CONTACT = contact;
  if (UNSUBSCRIBE) UNSUBSCRIBE();

  ACTIVE_CONV_ID = await ensureConversation(
    CURRENT_USER.uid, PROFILE.name,
    contact.uid, contact.name,
    PROFILE.kelas
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
}

async function sendCurrentMessage() {
  const input = document.getElementById("chatInput");
  const text = input.value.trim();
  if (!text || !ACTIVE_CONV_ID) return;
  input.value = "";
  await sendChatMessage(ACTIVE_CONV_ID, CURRENT_USER.uid, text);
}
