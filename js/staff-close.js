// js/staff-close.js (Firestore compat)
const db = window.db;

// ================= DOM =================
const branchEl = document.getElementById("branch");
const dateEl = document.getElementById("date");
const summaryEl = document.getElementById("summary");
const txListEl = document.getElementById("txList");
const totalNetEl = document.getElementById("totalNet");

const closedByEl = document.getElementById("closedBy");
const noteEl = document.getElementById("note");
const closeBtn = document.getElementById("closeBtn");
const resultEl = document.getElementById("result");

// ================= Utils =================
function todayYMD() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function money(v) {
  return n(v).toLocaleString("th-TH");
}

function esc(s) {
  return String(s || "").replace(/[&<>"']/g, m =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])
  );
}

function closeDocId(branchId, ymd) {
  return `${branchId}__${ymd}`;
}

function dayRange(ymd) {
  const start = new Date(`${ymd}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return {
    startTs: firebase.firestore.Timestamp.fromDate(start),
    endTs: firebase.firestore.Timestamp.fromDate(end)
  };
}

function setMsg(el, msg, ok = true) {
  el.style.color = ok ? "#0a7a2f" : "#b00020";
  el.textContent = msg;
}

// ================= Render =================
function renderSummary(t) {
  totalNetEl.value = t.totalNet;
  summaryEl.innerHTML = `
    <b>สรุปยอดวันนี้</b><br/>
    บิลทั้งหมด: ${t.totalBills} รายการ<br/>
    ยอดสุทธิ (Net): <b>${money(t.totalNet)}</b> บาท<br/>
    เงินสด: ${money(t.cashTotal)} • โอน: ${money(t.transferTotal)} • ค้างชำระ: ${money(t.unpaidTotal)}
  `;
}

function renderTxList(txs) {
  if (!txs.length) {
    txListEl.innerHTML = `<span class="muted">ไม่มีรายการของวันนี้</span>`;
    return;
  }

  txListEl.innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>เวลา</th>
          <th>ลูกค้า</th>
          <th>ชำระเงิน</th>
          <th style="text-align:right;">Net</th>
        </tr>
      </thead>
      <tbody>
        ${txs.map(t => `
          <tr>
            <td>${t.createdAt?.toDate().toLocaleString("th-TH") || "-"}</td>
            <td>${esc(t.customerName)}</td>
            <td>${esc(t.paymentMethod)} / ${esc(t.paymentStatus)}</td>
            <td style="text-align:right;">${money(t.netAmount)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

// ================= Data =================
async function loadTxAndAggregate(branchId, businessDate) {
  const { startTs, endTs } = dayRange(businessDate);

  const snap = await db.collection("transactions")
    .where("branchId", "==", branchId)
    .where("createdAt", ">=", startTs)
    .where("createdAt", "<", endTs)
    .orderBy("createdAt", "asc")
    .get();

  const txs = snap.docs.map(d => d.data());

  let totalBills = 0;
  let totalNet = 0;
  let cashTotal = 0;
  let transferTotal = 0;
  let unpaidTotal = 0;

  txs.forEach(t => {
    const net = n(t.netAmount);
    totalBills++;
    totalNet += net;

    if (t.paymentStatus === "paid") {
      if (t.paymentMethod === "cash") cashTotal += net;
      if (t.paymentMethod === "transfer") transferTotal += net;
    } else {
      unpaidTotal += net;
    }
  });

  return { txs, totals: { totalBills, totalNet, cashTotal, transferTotal, unpaidTotal } };
}

// ================= Actions =================
async function refresh() {
  try {
    setMsg(resultEl, "");
    summaryEl.textContent = "กำลังโหลด...";
    txListEl.textContent = "";

    const { txs, totals } = await loadTxAndAggregate(branchEl.value, dateEl.value);
    renderSummary(totals);
    renderTxList(txs);
  } catch (e) {
    console.error(e);
    setMsg(resultEl, e.message, false);
  }
}

async function closeDay() {
  if (!closedByEl.value.trim()) {
    return setMsg(resultEl, "กรุณาระบุชื่อผู้ปิดยอด", false);
  }

  try {
    closeBtn.disabled = true;
    setMsg(resultEl, "กำลังบันทึก...");

    const { totals } = await loadTxAndAggregate(branchEl.value, dateEl.value);

    await db.collection("daily_closes")
      .doc(closeDocId(branchEl.value, dateEl.value))
      .set({
        branchId: branchEl.value,
        businessDate: dateEl.value,
        ...totals,
        note: noteEl.value.trim(),
        closedBy: closedByEl.value.trim(),
        closedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

    setMsg(resultEl, "ปิดยอดสำเร็จ ✅");
  } catch (e) {
    console.error(e);
    setMsg(resultEl, e.message, false);
    closeBtn.disabled = false;
  }
}

// ================= Init =================
document.addEventListener("DOMContentLoaded", () => {
  dateEl.value = todayYMD();
  refresh();

  branchEl.addEventListener("change", refresh);
  dateEl.addEventListener("change", refresh);
  closeBtn.addEventListener("click", closeDay);
});
