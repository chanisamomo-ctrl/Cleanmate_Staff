// js/staff-close.js (Firestore compat)
// ต้องมี <script src="js/firebase.js"></script> และ <script src="js/app.js"></script> มาก่อนหน้านี้
// firebase.js ต้องทำ window.db = firebase.firestore();

const db = window.db;

// -------------------------------
// Elements
// -------------------------------
const branchEl = document.getElementById("branch");
const dateEl = document.getElementById("date");

const summaryEl = document.getElementById("summary");
const txListEl = document.getElementById("txList");

const closedByEl = document.getElementById("closedBy");
const totalNetEl = document.getElementById("totalNet"); // ช่องยอดสุทธิ "กรอกได้"
const noteEl = document.getElementById("note"); // หมายเหตุ (ไม่บังคับ)

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

// -------------------------------
// Utils
// -------------------------------
function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function setMsg(el, msg, ok = true) {
  if (!el) return;
  el.style.color = ok ? "#0a7a2f" : "#b00020";
  el.textContent = msg || "";
}

function closeDocId(branchId, ymd) {
  return `${branchId}__${ymd}`;
}

// ช่วงวัน: [ymd 00:00, ymd+1 00:00)
function dayRangeTimestamps(ymd) {
  // ใช้ local time ของเครื่อง
  const start = new Date(`${ymd}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return {
    startTs: firebase.firestore.Timestamp.fromDate(start),
    endTs: firebase.firestore.Timestamp.fromDate(end),
  };
}

// -------------------------------
// Render
// -------------------------------
function renderSummary(t) {
  // สรุปยอด
  summaryEl.innerHTML = `
    <b>สรุปยอดวันนี้</b><br/>
    บิลทั้งหมด: <b>${money(t.totalBills)}</b> รายการ<br/>
    ยอดสุทธิ (Net): <b>${money(t.totalNet)}</b> บาท<br/>
    เงินสด: <b>${money(t.cashTotal)}</b> • โอน: <b>${money(t.transferTotal)}</b> • ค้างชำระ: <b>${money(t.unpaidTotal)}</b>
  `;

  // เติมค่าเริ่มต้นให้ช่อง "ยอดสุทธิ" แต่ถ้าผู้ใช้แก้เองแล้ว จะไม่เขียนทับ
  if (totalNetEl && totalNetEl.dataset.manual !== "1") {
    totalNetEl.value = t.totalNet;
  }
}

function renderTxList(txs) {
  if (!txs.length) {
    txListEl.innerHTML = `<span class="muted">ไม่มีรายการของวันนี้</span>`;
    return;
  }

  const rows = txs
    .map((t) => {
      const when = t.createdAt?.toDate ? t.createdAt.toDate().toLocaleString("th-TH") : "-";
      const status = String(t.paymentStatus || "-");
      const method = String(t.paymentMethod || "-");
      const net = money(n(t.netAmount));

      return `
        <tr>
          <td>${esc(when)}</td>
          <td>${esc(t.billNo || "-")}</td>
          <td>${esc(t.customerName || "-")}</td>
          <td>${esc(method)} / ${esc(status)}</td>
          <td style="text-align:right;">${net}</td>
        </tr>
      `;
    })
    .join("");

  txListEl.innerHTML = `
    <div style="overflow:auto;">
      <table class="table">
        <thead>
          <tr>
            <th>เวลา</th>
            <th>บิล</th>
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

// -------------------------------
// Data: load tx + aggregate
// -------------------------------
async function loadTxAndAggregate(branchId, businessDateYMD) {
  const { startTs, endTs } = dayRangeTimestamps(businessDateYMD);

  // query มาตรฐาน: ใช้ branchId + createdAt range
  // (ต้องมี index: branchId ASC, createdAt ASC, __name__ ASC)
  const q = db
    .collection("transactions")
    .where("branchId", "==", branchId)
    .where("createdAt", ">=", startTs)
    .where("createdAt", "<", endTs)
    .orderBy("createdAt", "asc");

  const snap = await q.get();
  const txs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  let totalBills = 0;
  let totalNet = 0;
  let cashTotal = 0;
  let transferTotal = 0;
  let unpaidTotal = 0;

  txs.forEach((t) => {
    const net = n(t.netAmount);
    totalBills += 1;
    totalNet += net;

    const status = String(t.paymentStatus || "").toLowerCase();
    const method = String(t.paymentMethod || "").toLowerCase();

    if (status === "paid") {
      if (method === "cash") cashTotal += net;
      else if (method === "transfer") transferTotal += net;
    } else if (status === "unpaid") {
      unpaidTotal += net;
    } else {
      // เผื่อข้อมูลเก่าไม่ตรง paid/unpaid
      unpaidTotal += 0;
    }
  });

  return {
    txs,
    totals: { totalBills, totalNet, cashTotal, transferTotal, unpaidTotal },
  };
}

// -------------------------------
// Main refresh
// -------------------------------
async function refresh() {
  const branchId = branchEl.value;
  const businessDate = dateEl.value;

  summaryEl.textContent = "กำลังโหลด...";
  txListEl.textContent = "กำลังโหลดรายการ...";
  setMsg(resultEl, "");

  // 1) load tx
  try {
    const { txs, totals } = await loadTxAndAggregate(branchId, businessDate);
    renderSummary(totals);
    renderTxList(txs);

    // เติมค่าเริ่มต้นให้กล่อง amend ด้วยค่าที่คำนวณได้
    amendTotalNetEl.value = totals.totalNet;
    amendCashEl.value = totals.cashTotal;
    amendTransferEl.value = totals.transferTotal;
    amendUnpaidEl.value = totals.unpaidTotal;
  } catch (e) {
    console.error(e);
    summaryEl.innerHTML = `<span style="color:#b00020;">โหลดสรุปไม่สำเร็จ: ${esc(e.message || String(e))}</span>`;
    txListEl.innerHTML = `<span style="color:#b00020;">โหลดรายการไม่สำเร็จ: ${esc(e.message || String(e))}</span>`;
  }

  // 2) check closed?
  try {
    const docId = closeDocId(branchId, businessDate);
    const ref = db.collection("daily_closes").doc(docId);
    const snap = await ref.get();

    if (snap.exists) {
      const d = snap.data() || {};
      closeBtn.disabled = true;
      toggleAmendBtn.style.display = "inline-block";
      setMsg(resultEl, "วันนี้ปิดยอดแล้ว ✅ หากต้องการแก้ไขให้กด “ขอแก้ไขยอด”", true);

      if (!closedByEl.value) closedByEl.value = d.closedBy || "";
      if (!noteEl.value) noteEl.value = d.note || "";

      // ถ้าผู้ใช้ยังไม่แก้ totalNet เอง ให้โชว์จากที่ปิดยอดไว้
      if (totalNetEl && totalNetEl.dataset.manual !== "1") {
        totalNetEl.value = n(d.totalNet);
      }
    } else {
      closeBtn.disabled = false;
      toggleAmendBtn.style.display = "none";
      amendBox.style.display = "none";
    }
  } catch (e) {
    console.error(e);
  }
}

// -------------------------------
// Close day
// -------------------------------
async function closeDay() {
  const branchId = branchEl.value;
  const businessDate = dateEl.value;

  const closedBy = (closedByEl.value || "").trim();
  const noteText = (noteEl.value || "").trim();

  if (!closedBy) return setMsg(resultEl, "กรุณาใส่ชื่อผู้ปิดยอดก่อน", false);

  closeBtn.disabled = true;
  setMsg(resultEl, "กำลังปิดยอด...", true);

  try {
    const { totals } = await loadTxAndAggregate(branchId, businessDate);

    // ✅ manual override ยอดสุทธิ (ถ้ากรอก)
    const manualNet = n(totalNetEl?.value);
    if (manualNet > 0) {
      totals.totalNet = manualNet;
    }

    const docId = closeDocId(branchId, businessDate);

    await db
      .collection("daily_closes")
      .doc(docId)
      .set(
        {
          branchId,
          businessDate,

          totalBills: totals.totalBills,
          totalNet: totals.totalNet,
          cashTotal: totals.cashTotal,
          transferTotal: totals.transferTotal,
          unpaidTotal: totals.unpaidTotal,

          // ✅ หมายเหตุ: ข้อความเท่านั้น (ไม่บังคับ)
          note: noteText || "",

          closedBy,
          closedAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    setMsg(resultEl, "ปิดยอดสำเร็จ ✅", true);
    toggleAmendBtn.style.display = "inline-block";
  } catch (e) {
    console.error(e);
    closeBtn.disabled = false;
    setMsg(resultEl, `ปิดยอดไม่สำเร็จ: ${e.message || String(e)}`, false);
  }
}

// -------------------------------
// Amendments
// -------------------------------
async function saveAmendment() {
  const branchId = branchEl.value;
  const businessDate = dateEl.value;
  const docId = closeDocId(branchId, businessDate);

  const reason = (amendReasonEl.value || "").trim();
  if (!reason) return setMsg(amendResultEl, "กรุณากรอกเหตุผลในการแก้ไข", false);

  const newTotalNet = n(amendTotalNetEl.value);
  const newCash = n(amendCashEl.value);
  const newTransfer = n(amendTransferEl.value);
  const newUnpaid = n(amendUnpaidEl.value);

  amendBtn.disabled = true;
  setMsg(amendResultEl, "กำลังบันทึกการแก้ไข...", true);

  try {
    const ref = db.collection("daily_closes").doc(docId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error("ยังไม่พบเอกสารปิดยอด (ต้องปิดยอดก่อน)");

    const prev = snap.data() || {};

    // เก็บประวัติ
    await ref.collection("amendments").add({
      branchId,
      businessDate,
      amendedAt: firebase.firestore.FieldValue.serverTimestamp(),
      reason,

      prev_totalNet: n(prev.totalNet),
      prev_cashTotal: n(prev.cashTotal),
      prev_transferTotal: n(prev.transferTotal),
      prev_unpaidTotal: n(prev.unpaidTotal),
      prev_note: prev.note || "",
      prev_closedBy: prev.closedBy || "",

      new_totalNet: newTotalNet,
      new_cashTotal: newCash,
      new_transferTotal: newTransfer,
      new_unpaidTotal: newUnpaid,
    });

    // อัปเดตยอดล่าสุด
    await ref.set(
      {
        totalNet: newTotalNet,
        cashTotal: newCash,
        transferTotal: newTransfer,
        unpaidTotal: newUnpaid,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // ให้ช่องกรอกยอดสุทธิด้านบนแสดงเป็นยอดใหม่ (แต่ไม่บังคับให้ user แก้ manual)
    if (totalNetEl) {
      totalNetEl.value = newTotalNet;
      totalNetEl.dataset.manual = "1";
    }

    setMsg(amendResultEl, "บันทึกการแก้ไขสำเร็จ ✅ (เก็บประวัติแล้ว)", true);
    renderSummary({
      totalBills: n(prev.totalBills),
      totalNet: newTotalNet,
      cashTotal: newCash,
      transferTotal: newTransfer,
      unpaidTotal: newUnpaid,
    });
  } catch (e) {
    console.error(e);
    setMsg(amendResultEl, `บันทึกการแก้ไขไม่สำเร็จ: ${e.message || String(e)}`, false);
  } finally {
    amendBtn.disabled = false;
  }
}

// -------------------------------
// Init
// -------------------------------
document.addEventListener("DOMContentLoaded", () => {
  // ตั้งค่าวันนี้
  dateEl.value = todayYMD();

  // ให้กรอกยอดสุทธิได้ (manual override)
  if (totalNetEl) {
    totalNetEl.addEventListener("input", () => {
      totalNetEl.dataset.manual = "1";
    });
  }

  refresh();

  branchEl.addEventListener("change", () => {
    // เปลี่ยนสาขา = รีเซ็ต manual flag เพื่อให้ระบบเติมค่าใหม่ได้
    if (totalNetEl) totalNetEl.dataset.manual = "0";
    refresh();
  });

  closeBtn.addEventListener("click", closeDay);

  toggleAmendBtn.addEventListener("click", () => {
    amendBox.style.display = amendBox.style.display === "none" ? "block" : "none";
  });

  amendBtn.addEventListener("click", saveAmendment);
});
