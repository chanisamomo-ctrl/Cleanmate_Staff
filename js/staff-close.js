// js/staff-close.js (Firestore compat)
const db = window.db;

// ---------- DOM ----------
const branchEl = document.getElementById("branch");
const dateEl = document.getElementById("date");
const summaryEl = document.getElementById("summary");
const txListEl = document.getElementById("txList");

const closedByEl = document.getElementById("closedBy");
const noteEl = document.getElementById("note");
const closeBtn = document.getElementById("closeBtn");
const resultEl = document.getElementById("result");

const toggleAmendBtn = document.getElementById("toggleAmendBtn");
const amendBox = document.getElementById("amendBox");
const amendTotalNetEl = document.getElementById("amendTotalNet");
const amendCashEl = document.getElementById("amendCash");
const amendTransferEl = document.getElementById("amendTransfer");
const amendUnpaidEl = document.getElementById("amendUnpaid");
const amendReasonEl = document.getElementById("amendReason");
const amendBtn = document.getElementById("amendBtn");
const amendResultEl = document.getElementById("amendResult");

// ---------- Helpers ----------
function ymdToday() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dayRangeTimestamps(businessDateYMD) {
  // ใช้ timezone เครื่อง (ไทย) เป็นหลัก
  const start = new Date(`${businessDateYMD}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return {
    startTs: firebase.firestore.Timestamp.fromDate(start),
    endTs: firebase.firestore.Timestamp.fromDate(end),
  };
}

function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function money(v) {
  return n(v).toLocaleString("th-TH", { maximumFractionDigits: 0 });
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function closeDocId(branchId, businessDateYMD) {
  return `${branchId}__${businessDateYMD}`;
}

// ---------- Core: Load transactions & aggregate ----------
async function loadTxAndAggregate(branchId, businessDateYMD) {
  const { startTs, endTs } = dayRangeTimestamps(businessDateYMD);

  // ✅ ใช้ branchKey ก่อน ถ้าไม่มีค่อย fallback เป็น branchId
  // (จากรูปเก่า daily_closes มีทั้ง branchId/branchKey แต่ transactions มักใช้ branchKey)
  let q = db.collection("transactions")
    .where("createdAt", ">=", startTs)
    .where("createdAt", "<", endTs);

  // ลองใช้ branchKey ก่อน
  // ถ้าคุณมั่นใจว่า transactions ใช้ branchId ให้เปลี่ยนเป็น where("branchId","==",branchId)
  q = q.where("branchKey", "==", branchId);

  // (orderBy createdAt ไม่จำเป็น แต่ช่วยให้ list สวย)
  q = q.orderBy("createdAt", "asc");

  const snap = await q.get();
  const txs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  let totalBills = 0;
  let totalNet = 0;
  let cashTotal = 0;
  let transferTotal = 0;
  let unpaidTotal = 0;

  txs.forEach(t => {
    const net = n(t.netAmount);            // ✅ 450 ต้องอยู่ตรงนี้ตามรูปที่ 3
    const status = String(t.paymentStatus || "").toLowerCase(); // paid/unpaid
    const method = String(t.paymentMethod || "").toLowerCase(); // cash/transfer

    totalBills += 1;
    totalNet += net;

    if (status === "paid") {
      if (method === "cash") cashTotal += net;
      else if (method === "transfer") transferTotal += net;
    } else {
      unpaidTotal += net;
    }
  });

  return {
    txs,
    totals: { totalBills, totalNet, cashTotal, transferTotal, unpaidTotal }
  };
}

// ---------- UI Render ----------
function renderSummary(totals) {
  summaryEl.innerHTML = `
    <b>สรุปยอดวันนี้</b><br/>
    บิลทั้งหมด: ${money(totals.totalBills)} รายการ<br/>
    ยอดสุทธิ (Net): ${money(totals.totalNet)} บาท<br/>
    เงินสด: ${money(totals.cashTotal)} บาท • โอน: ${money(totals.transferTotal)} บาท • ค้างชำระ: ${money(totals.unpaidTotal)} บาท
  `;
}

function renderTxList(txs) {
  if (!txs.length) {
    txListEl.innerHTML = `<span class="muted">ไม่มีรายการของวันนี้</span>`;
    return;
  }

  const rows = txs.map(t => {
    const when = t.createdAt?.toDate ? t.createdAt.toDate().toLocaleString("th-TH") : "-";
    return `
      <tr>
        <td>${esc(when)}</td>
        <td>${esc(t.customerName || "-")}</td>
        <td>${esc(t.paymentMethod || "-")} / ${esc(t.paymentStatus || "-")}</td>
        <td style="text-align:right;">${money(t.netAmount)}</td>
      </tr>
    `;
  }).join("");

  txListEl.innerHTML = `
    <div style="overflow:auto;">
      <table class="table">
        <thead>
          <tr>
            <th>เวลา</th>
            <th>ลูกค้า</th>
            <th>ชำระเงิน</th>
            <th style="text-align:right;">Net</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function setResult(el, msg, ok = true) {
  el.style.color = ok ? "#0a7a2f" : "#b00020";
  el.textContent = msg;
}

// ---------- Load page state ----------
async function refreshPage() {
  const branchId = branchEl.value;
  const businessDate = dateEl.value;

  setResult(resultEl, "", true);
  summaryEl.textContent = "กำลังโหลด...";
  txListEl.textContent = "กำลังโหลดรายการ...";

  // 1) load tx + totals
  try {
    const { txs, totals } = await loadTxAndAggregate(branchId, businessDate);
    renderSummary(totals);
    renderTxList(txs);

    // prefill amend inputs
    amendTotalNetEl.value = totals.totalNet;
    amendCashEl.value = totals.cashTotal;
    amendTransferEl.value = totals.transferTotal;
    amendUnpaidEl.value = totals.unpaidTotal;
  } catch (e) {
    console.error(e);
    summaryEl.innerHTML = `<span style="color:#b00020;">โหลดสรุปไม่สำเร็จ: ${esc(e.me
