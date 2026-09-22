// ============================================================
// SOCIETY — app.js (versi DEMO, tanpa database/login)
// Semua data aspirasi disimpan di localStorage browser ini saja.
// Cocok untuk demo/presentasi. Untuk versi asli yang datanya
// tersambung ke semua siswa, pakai versi Firebase.
// ============================================================

const STORAGE_KEY = "society_demo_aspirasi";
const VOTE_KEY = "society_demo_votes";

const KATEGORI_LABEL = {
  "ide-acara": "Ide Acara",
  "evaluasi": "Evaluasi",
  "akademis": "Struggle Akademis"
};

// ------------------------------------------------------------
// Penyimpanan lokal
// ------------------------------------------------------------
function getAspirasi() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}
function saveAspirasi(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}
function getVotedMap() {
  try { return JSON.parse(localStorage.getItem(VOTE_KEY) || "{}"); }
  catch { return {}; }
}
function setVoted(id, type) {
  const map = getVotedMap();
  map[id] = type;
  localStorage.setItem(VOTE_KEY, JSON.stringify(map));
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function formatTanggal(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

// Beberapa contoh aspirasi supaya papan tidak kosong saat demo pertama kali.
function seedIfEmpty() {
  if (getAspirasi().length > 0) return;
  saveAspirasi([
    {
      id: crypto.randomUUID(),
      kategori: "ide-acara",
      isi: "Adain lomba futsal antar kelas pas class meeting semester ini, dong!",
      createdAt: new Date().toISOString(),
      upvotes: 8,
      downvotes: 1
    },
    {
      id: crypto.randomUUID(),
      kategori: "akademis",
      isi: "Jadwal try out sering bentrok sama jadwal ekskul, bisa dievaluasi lagi?",
      createdAt: new Date().toISOString(),
      upvotes: 5,
      downvotes: 0
    }
  ]);
}
seedIfEmpty();

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

textarea.addEventListener("input", () => {
  charCount.textContent = textarea.value.length;
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const kategori = form.querySelector("input[name='kategori']:checked")?.value;
  const isi = textarea.value.trim();
  if (!kategori || !isi) return;

  const list = getAspirasi();
  list.unshift({
    id: crypto.randomUUID(),
    kategori,
    isi,
    createdAt: new Date().toISOString(),
    upvotes: 0,
    downvotes: 0
  });
  saveAspirasi(list);

  form.reset();
  charCount.textContent = "0";
  formStatus.textContent = "Terkirim! Lihat aspirasimu di tab Papan Aspirasi.";
  formStatus.className = "form-status ok";
  renderPapan();
});

// ------------------------------------------------------------
// Papan Aspirasi (list + vote)
// ------------------------------------------------------------
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
  let items = getAspirasi();
  if (currentFilter !== "semua") {
    items = items.filter(a => a.kategori === currentFilter);
  }
  if (currentSort === "terpopuler") {
    items.sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes));
  } else {
    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  if (items.length === 0) {
    papanList.innerHTML = `<p class="empty-state">Belum ada aspirasi pada kategori ini.</p>`;
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

papanList.addEventListener("click", (e) => {
  const card = e.target.closest(".aspirasi-card");
  if (!card) return;
  const id = card.dataset.id;

  let type = null;
  if (e.target.closest(".vote-up")) type = "up";
  if (e.target.closest(".vote-down")) type = "down";
  if (!type) return;

  const votedMap = getVotedMap();
  const already = votedMap[id];
  if (already === type) return; // sudah vote yang sama

  const list = getAspirasi();
  const item = list.find(a => a.id === id);
  if (!item) return;

  if (type === "up") {
    item.upvotes += 1;
    if (already === "down") item.downvotes -= 1;
  } else {
    item.downvotes += 1;
    if (already === "up") item.upvotes -= 1;
  }
  saveAspirasi(list);
  setVoted(id, type);
  renderPapan();
});

renderPapan();
