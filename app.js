// ============================================================
// SOCIETY — app.js (versi TERHUBUNG ANTAR DEVICE)
// Backend: Firebase Firestore. Tidak ada login/admin — semua orang
// bisa mengirim aspirasi & vote, dan semua aspirasi langsung
// tersinkron real-time ke semua device yang membuka website ini.
// Isi firebaseConfig di bawah sesuai project Firebase kamu.
// Lihat README.md untuk panduan setup.
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, addDoc, onSnapshot, doc, updateDoc,
  serverTimestamp, query, orderBy, increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// >>> GANTI dengan config project Firebase kamu (Project settings > SDK setup) <<<
const firebaseConfig = {
  apiKey: "AIzaSyBrNW_pw1Bfxzw-0I_zDD4mPwcg3XLriGs",
  authDomain: "society-osis.firebaseapp.com",
  projectId: "society-osis",
  storageBucket: "society-osis.firebasestorage.app",
  messagingSenderId: "964398698679",
  appId: "1:964398698679:web:e5428682b672cf5ee33d32",
  measurementId: "G-XQSYCDMVCR"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const aspirasiRef = collection(db, "aspirasi");

const KATEGORI_LABEL = {
  "ide-acara": "Ide Acara",
  "evaluasi": "Evaluasi",
  "akademis": "Struggle Akademis"
};

// ------------------------------------------------------------
// Vote tracking per-browser (supaya 1 device tidak vote dobel)
// ------------------------------------------------------------
function getVotedMap() {
  try { return JSON.parse(localStorage.getItem("society_votes") || "{}"); }
  catch { return {}; }
}
function setVoted(id, type) {
  const map = getVotedMap();
  map[id] = type;
  localStorage.setItem("society_votes", JSON.stringify(map));
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
function formatTanggal(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

// ------------------------------------------------------------
// Tab navigation
// ------------------------------------------------------------
const tabs = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".panel");
tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    tabs.forEach(t => { t.classList.remove("is-active"); t.setAttribute("aria-selected", "false"); });
    panels.forEach(p => p.classList.remove("is-active"));
    tab.classList.add("is-active");
    tab.setAttribute("aria-selected", "true");
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add("is-active");
  });
});

// ------------------------------------------------------------
// Form: Ajukan Aspirasi
// ------------------------------------------------------------
const form = document.getElementById("form-aspirasi");
const textarea = document.getElementById("isi-aspirasi");
const charCount = document.getElementById("char-count");
const formStatus = document.getElementById("form-status");
const btnSubmit = form.querySelector("button[type='submit']");

textarea.addEventListener("input", () => {
  charCount.textContent = textarea.value.length;
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const kategori = form.querySelector("input[name='kategori']:checked")?.value;
  const isi = textarea.value.trim();
  if (!kategori || !isi) return;

  btnSubmit.disabled = true;
  formStatus.textContent = "Mengirim…";
  formStatus.className = "form-status";

  try {
    await addDoc(aspirasiRef, {
      kategori,
      isi,
      createdAt: serverTimestamp(),
      upvotes: 0,
      downvotes: 0
    });
    form.reset();
    charCount.textContent = "0";
    formStatus.textContent = "Terkirim! Aspirasimu langsung muncul di tab Papan Aspirasi untuk semua orang.";
    formStatus.className = "form-status ok";
  } catch (err) {
    console.error(err);
    formStatus.textContent = "Gagal mengirim. Periksa koneksi internet dan coba lagi.";
    formStatus.className = "form-status err";
  } finally {
    btnSubmit.disabled = false;
  }
});

// ------------------------------------------------------------
// Papan Aspirasi (list + vote, realtime dari semua device)
// ------------------------------------------------------------
let allAspirasi = [];
let currentFilter = "semua";
let currentSort = "terbaru";
const papanList = document.getElementById("papan-list");

document.getElementById("filter-kategori").addEventListener("click", (e) => {
  const btn = e.target.closest(".chip");
  if (!btn) return;
  document.querySelectorAll("#filter-kategori .chip").forEach(c => c.classList.remove("is-active"));
  btn.classList.add("is-active");
  currentFilter = btn.dataset.filter;
  renderPapan();
});

document.getElementById("sort-select").addEventListener("change", (e) => {
  currentSort = e.target.value;
  renderPapan();
});

function renderPapan() {
  let items = [...allAspirasi];
  if (currentFilter !== "semua") {
    items = items.filter(a => a.kategori === currentFilter);
  }
  if (currentSort === "terpopuler") {
    items.sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes));
  } else {
    items.sort((a, b) => (b._createdMs || 0) - (a._createdMs || 0));
  }

  if (items.length === 0) {
    papanList.innerHTML = `<p class="empty-state">Belum ada aspirasi pada kategori ini. Jadilah yang pertama mengirim di tab "Ajukan Aspirasi".</p>`;
    return;
  }

  const votedMap = getVotedMap();
  papanList.innerHTML = items.map(a => {
    const score = a.upvotes - a.downvotes;
    const voted = votedMap[a.id];
    return `
      <article class="aspirasi-card" data-id="${a.id}">
        <div class="aspirasi-card__top">
          <span class="tag">${KATEGORI_LABEL[a.kategori] || a.kategori}</span>
        </div>
        <p class="aspirasi-card__isi">${escapeHtml(a.isi)}</p>
        <div class="aspirasi-card__foot">
          <div class="vote-group">
            <button class="vote-btn vote-up ${voted === 'up' ? 'is-selected--up' : ''}" aria-label="Dukung aspirasi ini">▲</button>
            <span class="vote-score">${score}</span>
            <button class="vote-btn vote-down ${voted === 'down' ? 'is-selected--down' : ''}" aria-label="Tidak setuju">▼</button>
          </div>
          <span class="aspirasi-card__date">${formatTanggal(a.createdAt)}</span>
        </div>
      </article>
    `;
  }).join("");
}

papanList.addEventListener("click", async (e) => {
  const card = e.target.closest(".aspirasi-card");
  if (!card) return;
  const id = card.dataset.id;

  let field = null, type = null;
  if (e.target.closest(".vote-up")) { field = "upvotes"; type = "up"; }
  if (e.target.closest(".vote-down")) { field = "downvotes"; type = "down"; }
  if (!field) return;

  const votedMap = getVotedMap();
  const already = votedMap[id];
  if (already === type) return; // sudah vote yang sama, abaikan

  try {
    const updates = { [field]: increment(1) };
    if (already === "up" && type === "down") updates.upvotes = increment(-1);
    if (already === "down" && type === "up") updates.downvotes = increment(-1);
    await updateDoc(doc(db, "aspirasi", id), updates);
    setVoted(id, type);
  } catch (err) {
    console.error(err);
  }
});

// ------------------------------------------------------------
// Realtime listener — inilah yang membuat semua device tersinkron
// ------------------------------------------------------------
const qAspirasi = query(aspirasiRef, orderBy("createdAt", "desc"));
onSnapshot(qAspirasi, (snap) => {
  allAspirasi = snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      upvotes: data.upvotes || 0,
      downvotes: data.downvotes || 0,
      _createdMs: data.createdAt?.toMillis ? data.createdAt.toMillis() : 0
    };
  });
  renderPapan();
}, (err) => {
  console.error(err);
  papanList.innerHTML = `<p class="empty-state">Gagal memuat data. Pastikan firebaseConfig di app.js sudah diisi dengan benar dan rules Firestore sudah dipasang.</p>`;
});
