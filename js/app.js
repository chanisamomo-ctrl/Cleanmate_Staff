// js/app.js - helpers only (NO firebase init, NO db declare)

function todayYMD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function money(v) {
  const n = Number(v || 0);
  return n.toLocaleString("th-TH", { maximumFractionDigits: 0 });
}

// ===============================
// helper: YYYY-MM-DD (local time)
// ===============================
function todayYMD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ===============================
// helper: start/end Timestamp ของวันนั้น (สำหรับ createdAt range)
// ===============================
function dayRangeTimestamps(ymd) {
  // ymd: "YYYY-MM-DD"
  const [y, m, d] = (ymd || "").split("-").map(Number);
  const start = new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
  const end = new Date(y, (m || 1) - 1, d || 1, 23, 59, 59, 999);
  return {
    startTs: firebase.firestore.Timestamp.fromDate(start),
    endTs: firebase.firestore.Timestamp.fromDate(end),
  };
}
