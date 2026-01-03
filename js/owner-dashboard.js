// js/owner-dashboard.js (Firestore compat)
const db = window.db;

const branchEl = document.getElementById("branch");
const fromEl = document.getElementById("fromDate");
const toEl = document.getElementById("toDate");
const loadBtn = document.getElementById("loadBtn");
const exportBtn = document.getElementById("exportBtn");

const kpiEl = document.getElementById("kpi");
const listEl = document.getElementById("list");
const amendmentsEl = document.getElementById("amendments");

let lastRows = [];

function setDefaultDates() {
  const today = todayYMD();
  if (!fromEl.value) fromEl.value = today;
  if (!toEl.value) toEl.value = today;
}

function ymdToDate(ymd) {
  return new Date(`${ymd}T00:00:00`);
}

function renderDailyCloseRows(rows) {
  if (!rows.length) {
    kpiEl.textContent = "—";
    listEl.innerHTML = `<div class="small muted">ไม่พบข้อมูล</div>`;
    lastRows = [];
    return;
  }

  const sumDays = rows.length;
  const sumBills = rows.reduce((a, r) => a + Number(r.totalBills || 0), 0);
  const sumNet = rows.reduce((a, r) => a + Number(r.totalNet || 0), 0);
  const sumCash = rows.reduce((a, r) => a + Number(r.cashTotal || 0), 0);
  const sumTransfer = rows.reduce((a, r) => a + Number(r.transferTotal || 0), 0);
  const sumUnpaid = rows.reduce((a, r) => a + Number(r.unpaidTotal || 0), 0);

  kpiEl.textContent = `รวม ${sumDays} วัน · บิล ${sumBills} · Net ${money(sumNet)} · Cash ${money(sumCash)} · Transfer ${money(sumTransfer)} · Unpaid ${money(sumUnpaid)}`;

  const rowsHtml = rows.map(r => `
    <tr>
      <td>${esc(r.businessDate || "-")}</td>
      <td>${esc(r.branchId || "-")}</td>
      <td style="text-align:right;">${Number(r.totalBills || 0)}</td>
      <td style="text-align:right;">${money(r.totalNet)}</td>
      <td style="text-align:right;">${money(r.cashTotal)}</td>
      <td style="text-align:right;">${money(r.transferTotal)}</td>
      <td style="text-align:right;">${money(r.unpaidTotal)}</td>
      <td>${esc(r.note || "")}</td>
      <td>${esc(r.closedBy || "")}</td>
    </tr>
  `).join("");

  listEl.innerHTML = `
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
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `;

  lastRows = rows;
}

async function loadDailyCloses() {
  const branch = branchEl.value;
  const from = fromEl.value;
  const to = toEl.value;

  if (!from || !to) {
    listEl.innerHTML = `<div class="small" style="color:#b00020;">กรุณาเลือกช่วงวันที่</div>`;
    return;
  }

  listEl.textContent = "กำลังโหลด...";
  kpiEl.textContent = "—";

  const fromDate = from;
  const toDate = to;

  let q = db.collection("daily_closes")
    .where("businessDate", ">=", fromDate)
    .where("businessDate", "<=", toDate)
    .orderBy("businessDate", "asc");

  if (branch) {
    q = q.where("branchId", "==", branch);
  }

  const snap = await q.get();
  const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderDailyCloseRows(rows);
}

async function loadAmendmentsLatest50() {
  amendmentsEl.textContent = "กำลังโหลด...";

  try {
    // ✅ ใช้ collectionGroup + sort ล่าสุด 50
    // ถ้าจะ filter สาขา/วันที่ด้วย ต้องทำ composite index เพิ่ม
    let q = db.collectionGroup("amendments")
      .orderBy("amendedAt", "desc")
      .limit(50);

    const snap = await q.get();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (!items.length) {
      amendmentsEl.innerHTML = `<div class="small muted">ยังไม่มีประวัติการแก้ไข</div>`;
      return;
    }

    const html = items.map(a => `
      <div class="card" style="margin-bottom:8px;">
        <div class="small">
          <b>${esc(a.businessDate || "-")}</b> · ${esc(a.branchId || "-")}
          <div class="muted">เหตุผล: ${esc(a.reason || "-")}</div>
          <div>เดิม Net: <b>${money(a.prev_totalNet)}</b> → ใหม่ Net: <b>${money(a.new_totalNet)}</b></div>
        </div>
      </div>
    `).join("");

    amendmentsEl.innerHTML = html;
  } catch (e) {
    // ถ้ายังติด index จะเห็นลิงก์ create index ใน error
    amendmentsEl.innerHTML = `<div class="small" style="color:#b00020;">โหลดประวัติการแก้ไขไม่สำเร็จ: ${esc(e.message)}</div>`;
  }
}

function exportCSV() {
  if (!lastRows.length) return;

  const header = ["businessDate","branchId","totalBills","totalNet","cashTotal","transferTotal","unpaidTotal","note","closedBy"];
  const lines = [header.join(",")];

  for (const r of lastRows) {
    const row = [
      r.businessDate || "",
      r.branchId || "",
      Number(r.totalBills || 0),
      Number(r.totalNet || 0),
      Number(r.cashTotal || 0),
      Number(r.transferTotal || 0),
      Number(r.unpaidTotal || 0),
      (r.note || "").replaceAll('"','""'),
      (r.closedBy || "").replaceAll('"','""'),
    ];
    lines.push(row.map(v => `"${v}"`).join(","));
  }

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `daily_closes_${fromEl.value}_${toEl.value}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

document.addEventListener("DOMContentLoaded", async () => {
  setDefaultDates();
  listEl.textContent = "กด 'โหลดข้อมูล' เพื่อเริ่ม";
  amendmentsEl.textContent = "กำลังโหลด...";

  loadBtn.addEventListener("click", async () => {
    await loadDailyCloses();
  });

  exportBtn.addEventListener("click", exportCSV);

  await loadAmendmentsLatest50();
});
