// js/owner-dashboard.js  (Firestore compat)
const db = firebase.firestore();

const branchEl = document.getElementById("branch");
const fromEl = document.getElementById("fromDate");
const toEl = document.getElementById("toDate");
const loadBtn = document.getElementById("loadBtn");
const exportBtn = document.getElementById("exportBtn");

const kpiEl = document.getElementById("kpi");
const listEl = document.getElementById("list");
const amendmentsEl = document.getElementById("amendments");

let lastRows = []; // cache for export

function ymdToday() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function setDefaultDates() {
  const today = ymdToday();
  if (!fromEl.value) fromEl.value = today;
  if (!toEl.value) toEl.value = today;
}

function fmtMoney(n) {
  const x = Number(n || 0);
  return x.toLocaleString("th-TH", { maximumFractionDigits: 0 });
}

function safeText(s) {
  return String(s ?? "").replace(/[<>]/g, "");
}

function renderDailyCloseRows(rows) {
  if (!rows.length) {
    listEl.innerHTML = `<div class="small muted">ไม่พบข้อมูล</div>`;
    kpiEl.textContent = "—";
    return;
  }

  // KPI รวม
  const sumBills = rows.reduce((a, r) => a + Number(r.totalBills || 0), 0);
  const sumNet = rows.reduce((a, r) => a + Number(r.totalNet || 0), 0);
  const sumCash = rows.reduce((a, r) => a + Number(r.cashTotal || 0), 0);
  const sumTransfer = rows.reduce((a, r) => a + Number(r.transferTotal || 0), 0);
  const sumUnpaid = rows.reduce((a, r) => a + Number(r.unpaidTotal || 0), 0);

  kpiEl.innerHTML =
    `รวม ${rows.length} วัน • บิล ${fmtMoney(sumBills)} • Net ${fmtMoney(sumNet)} • Cash ${fmtMoney(sumCash)} • Transfer ${fmtMoney(sumTransfer)} • Unpaid ${fmtMoney(sumUnpaid)}`;

  // ตาราง
  const html = `
    <div style="overflow:auto;">
      <table class="table">
        <thead>
          <tr>
            <th>วันที่</th>
            <th>สาขา</th>
            <th style="text-align:right;">บิล</th>
            <th style="text-align:right;">Net</th>
            <th style="text-align:right;">Cash</th>
            <th style="text-align:right;">Transfer</th>
            <th style="text-align:right;">Unpaid</th>
            <th>Note</th>
            <th>Closed By</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td>${safeText(r.businessDate)}</td>
              <td>${safeText(r.branchId || r.branchKey || "-")}</td>
              <td style="text-align:right;">${fmtMoney(r.totalBills)}</td>
              <td style="text-align:right;">${fmtMoney(r.totalNet)}</td>
              <td style="text-align:right;">${fmtMoney(r.cashTotal)}</td>
              <td style="text-align:right;">${fmtMoney(r.transferTotal)}</td>
              <td style="text-align:right;">${fmtMoney(r.unpaidTotal)}</td>
              <td>${safeText(r.note)}</td>
              <td>${safeText(r.closedBy)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
  listEl.innerHTML = html;
}

async function loadDailyCloses() {
  listEl.textContent = "กำลังโหลด...";
  kpiEl.textContent = "—";

  const branch = branchEl.value; // "" = ทั้งหมด
  const fromDate = fromEl.value;
  const toDate = toEl.value;

  if (!fromDate || !toDate) {
    listEl.innerHTML = `<div class="small muted">กรุณาเลือกช่วงวันที่</div>`;
    return;
  }

  try {
    // ✅ ใช้ field ให้ตรง index ที่คุณมี: branchId + businessDate (ASC)
    let q = db.collection("daily_closes")
      .where("businessDate", ">=", fromDate)
      .where("businessDate", "<=", toDate);

    if (branch) {
      q = q.where("branchId", "==", branch);
    }

    // ✅ ให้ตรงกับ index ที่เป็น businessDate ↑ (ASC)
    q = q.orderBy("businessDate", "asc");

    const snap = await q.get();
    const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    lastRows = rows;
    renderDailyCloseRows(rows);
  } catch (err) {
    console.error(err);
    listEl.innerHTML = `<div class="small" style="color:#b00020;">โหลดข้อมูลไม่สำเร็จ: ${safeText(err.message)}</div>`;
  }
}

async function loadAmendments() {
  amendmentsEl.textContent = "กำลังโหลด...";
  try {
    // ถ้าคุณเก็บ amendments เป็น collection ที่ชื่อ "amendments" อยู่ที่ root
    // ใช้ collection("amendments") ได้เลย
    // แต่จาก index ของคุณเป็น "Collection group" -> มักใช้ collectionGroup
    const snap = await db.collectionGroup("amendments")
      .orderBy("amendedAt", "desc")
      .limit(50)
      .get();

    const rows = snap.docs.map(d => d.data());

    if (!rows.length) {
      amendmentsEl.textContent = "ไม่พบประวัติการแก้ไข";
      return;
    }

    amendmentsEl.innerHTML = rows.map(r => {
      const when = r.amendedAt?.toDate ? r.amendedAt.toDate().toLocaleString("th-TH") : (r.amendedAt || "-");
      return `• ${safeText(when)} — ${safeText(r.branchId || "-")} ${safeText(r.businessDate || "-")} — ${safeText(r.reason || r.note || "")}`;
    }).join("<br/>");
  } catch (err) {
    console.error(err);
    amendmentsEl.innerHTML = `<span style="color:#b00020;">โหลดประวัติการแก้ไขไม่สำเร็จ: ${safeText(err.message)}</span>`;
  }
}

function exportCSV() {
  if (!lastRows.length) return;

  const headers = [
    "businessDate","branchId","totalBills","totalNet","cashTotal","transferTotal","unpaidTotal","note","closedBy"
  ];

  const lines = [
    headers.join(","),
    ...lastRows.map(r => headers.map(h => {
      const v = r[h] ?? "";
      const s = String(v).replace(/"/g, '""');
      return `"${s}"`;
    }).join(","))
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `daily_closes_${fromEl.value}_${toEl.value}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

document.addEventListener("DOMContentLoaded", () => {
  setDefaultDates();
  loadDailyCloses();
  loadAmendments();

  loadBtn.addEventListener("click", () => {
    loadDailyCloses();
    loadAmendments();
  });

  exportBtn.addEventListener("click", exportCSV);
});
