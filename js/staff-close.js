// js/staff-close.js (Firestore compat)
const db = window.db;

const branchEl = document.getElementById("branch");
const dateEl = document.getElementById("date");
const summaryEl = document.getElementById("summary");
const txListEl = document.getElementById("txList");
const totalNetEl = document.getElementById("totalNet");

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

function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
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
    endTs: firebase.firestore.Timestamp.fromDate(end),
  };
}

function setMsg(el, msg, ok = true) {
  if (!el) return;
  el.style.color = ok ? "#0a7a2f" : "#b00020";
  el.textContent = msg || "";
}

function renderSummary(t) {
  summaryEl.innerHTML = `
    <b>สรุปยอดวันนี้</b><br/>
    บิลทั้งหมด: <b>${t.totalBills}</b> รายการ<br/>
    ยอดสุทธิ (Net): <b>${money(t.totalNet)}</b> บาท<br/>
    เงินสด: <b>${money(t.cashTotal)}</b> บาท • โอน: <b>${money(t.transferTotal)}</b> บาท • ค้างชำระ: <b>${money(t.unpaidTotal)}</b> บาท
  `;
}

function renderTxList(txs) {
  if (!txs.length) {
    txListEl.innerHTML = `<span class="muted">ไม่มีรายการของวันนี้</span>`;
    return;
  }

  const rows = txs
    .map((t) => {
      const when = t.createdAt?.toDate ? t.createdAt.toDate().toLocaleString("th-TH") : "-";
      const pay = `${t.paymentMethod || "-"} / ${t.paymentStatus || "-"}`;
      return `
        <tr>
          <td>${esc(when)}</td>
          <td>${esc(t.billNo || "-")}</td>
          <td>${esc(t.customerName || "-")}</td>
          <td>${esc(pay)}</td>
          <td style="text-align:right;">${money(t.netAmount)}</td>
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

// ✅ ฟังก์ชันนี้ “มีแค่อันเดียว” (ห้ามซ้ำ)
async function loadTxAndAggregate(branchId, businessDateYMD) {
  const { startTs, endTs } = dayRange(businessDateYMD);

  // รองรับข้อมูลเก่า: บางรายการอาจใช้ branchKey แทน branchId
  const q1 = db.collection("transactions")
    .where("createdAt", ">=", startTs)
    .where("createdAt", "<", endTs)
    .where("branchId", "==", branchId)
    .orderBy("createdAt", "asc")
    .get();

  const q2 = db.collection("transactions")
    .where("createdAt", ">=", startTs)
    .where("createdAt", "<", endTs)
    .where("branchKey", "==", branchId)
    .orderBy("createdAt", "asc")
    .get();

  const [snap1, snap2] = await Promise.all([q1, q2]);

  const map = new Map();
  snap1.docs.forEach(d => map.set(d.id, { id: d.id, ...d.data() }));
  snap2.docs.forEach(d => map.set(d.id, { id: d.id, ...d.data() }));

  const txs = Array.from(map.values());

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
    } else {
      unpaidTotal += net;
    }
  });

  return { txs, totals: { totalBills, totalNet, cashTotal, transferTotal, unpaidTotal } };
}

async function refresh() {
  const branchId = branchEl.value;
  const businessDate = dateEl.value;

  summaryEl.textContent = "กำลังโหลด...";
  txListEl.textContent = "กำลังโหลดรายการ...";
  setMsg(resultEl, "");

  // 1) โหลดรายการ + สรุปยอด
  try {
    const { txs, totals } = await loadTxAndAggregate(branchId, businessDate);
    renderSummary(totals);
    renderTxList(txs);

    // ✅ แสดง “ยอดสุทธิของวันนั้น” (readonly)
    if (totalNetEl) totalNetEl.value = totals.totalNet;

    // เติมค่ากล่องแก้ไขยอด
    amendTotalNetEl.value = totals.totalNet;
    amendCashEl.value = totals.cashTotal;
    amendTransferEl.value = totals.transferTotal;
    amendUnpaidEl.value = totals.unpaidTotal;
  } catch (e) {
    console.error(e);
    summaryEl.innerHTML = `<span style="color:#b00020;">โหลดสรุปไม่สำเร็จ: ${esc(e.message)}</span>`;
    txListEl.innerHTML = `<span style="color:#b00020;">โหลดรายการไม่สำเร็จ: ${esc(e.message)}</span>`;
  }

  // 2) เช็คว่าปิดยอดแล้วหรือยัง
  try {
    const docId = closeDocId(branchId, businessDate);
    const ref = db.collection("daily_closes").doc(docId);
    const snap = await ref.get();

    if (snap.exists) {
      closeBtn.disabled = true;
      toggleAmendBtn.style.display = "inline-block";
      setMsg(resultEl, "วันนี้ปิดยอดแล้ว ✅ หากต้องการแก้ไขให้กด “ขอแก้ไขยอด”", true);

      const d = snap.data() || {};
      if (!closedByEl.value) closedByEl.value = d.closedBy || "";
      if (!noteEl.value) noteEl.value = d.note || "";
      if (totalNetEl && !totalNetEl.value) totalNetEl.value = n(d.totalNet);
    } else {
      closeBtn.disabled = false;
      toggleAmendBtn.style.display = "none";
      amendBox.style.display = "none";
    }
  } catch (e) {
    console.error(e);
  }
}

async function closeDay() {
  const branchId = branchEl.value;
  const businessDate = dateEl.value;
  const closedBy = closedByEl.value.trim();
  const noteText = noteEl.value.trim();

  if (!closedBy) return setMsg(resultEl, "กรุณาใส่ชื่อผู้ปิดยอดก่อน", false);

  closeBtn.disabled = true;
  setMsg(resultEl, "กำลังปิดยอด...", true);

  try {
    const { totals } = await loadTxAndAggregate(branchId, businessDate);
    const docId = closeDocId(branchId, businessDate);

    await db.collection("daily_closes").doc(docId).set(
      {
        branchId,
        businessDate,

        totalBills: totals.totalBills,
        totalNet: totals.totalNet,
        cashTotal: totals.cashTotal,
        transferTotal: totals.transferTotal,
        unpaidTotal: totals.unpaidTotal,

        // ✅ note เป็น “ข้อความ” เท่านั้น และไม่บังคับ
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
    setMsg(resultEl, `ปิดยอดไม่สำเร็จ: ${e.message}`, false);
  }
}

async function saveAmendment() {
  const branchId = branchEl.value;
  const businessDate = dateEl.value;
  const docId = closeDocId(branchId, businessDate);

  const reason = amendReasonEl.value.trim();
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

    // ✅ เก็บประวัติใน subcollection
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

    // ✅ อัปเดตยอดล่าสุดใน daily_closes
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

    setMsg(amendResultEl, "บันทึกการแก้ไขสำเร็จ ✅ (เก็บประวัติแล้ว)", true);

    // อัปเดตหน้าจอ
    renderSummary({
      totalBills: n(prev.totalBills),
      totalNet: newTotalNet,
      cashTotal: newCash,
      transferTotal: newTransfer,
      unpaidTotal: newUnpaid,
    });
    if (totalNetEl) totalNetEl.value = newTotalNet;
  } catch (e) {
    console.error(e);
    setMsg(amendResultEl, `บันทึกการแก้ไขไม่สำเร็จ: ${e.message}`, false);
  } finally {
    amendBtn.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  dateEl.value = todayYMD();
  refresh();

  branchEl.addEventListener("change", refresh);
  closeBtn.addEventListener("click", closeDay);

  toggleAmendBtn.addEventListener("click", () => {
    amendBox.style.display = amendBox.style.display === "none" ? "block" : "none";
  });

  amendBtn.addEventListener("click", saveAmendment);
});
