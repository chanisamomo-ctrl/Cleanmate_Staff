// js/staff-close.js
document.addEventListener("DOMContentLoaded", () => {
  const branchEl = document.getElementById("branch");
  const dateEl = document.getElementById("date");
  const summaryEl = document.getElementById("summary");
  const closeBtn = document.getElementById("closeBtn");
  const resultEl = document.getElementById("result");
  const closedByEl = document.getElementById("closedBy");
  const noteEl = document.getElementById("note");

  const txListEl = document.getElementById("txList");

  const toggleAmendBtn = document.getElementById("toggleAmendBtn");
  const amendBox = document.getElementById("amendBox");
  const amendBtn = document.getElementById("amendBtn");
  const amendResultEl = document.getElementById("amendResult");

  const amendTotalNetEl = document.getElementById("amendTotalNet");
  const amendCashEl = document.getElementById("amendCash");
  const amendTransferEl = document.getElementById("amendTransfer");
  const amendUnpaidEl = document.getElementById("amendUnpaid");
  const amendReasonEl = document.getElementById("amendReason");

  // helper จาก app.js (ต้องมี todayYMD)
  const businessDate = todayYMD();
  dateEl.value = businessDate;

  let unsubscribeTx = null;
  let lastComputed = null;
  let lastCloseDoc = null;

  function branchKey(branchId) {
    return (branchId || "").replace(/\s+/g, "_");
  }

  function closeDocId(branchId, date) {
    return `${branchKey(branchId)}__${date}`;
  }

  function money(n) {
    return Number(n || 0).toLocaleString();
  }

  function renderTxList(items) {
    if (!items.length) {
      txListEl.innerHTML = `<div class="muted">ยังไม่มีรายการของวันนี้</div>`;
      return;
    }

    txListEl.innerHTML = items.map((d) => {
      const bill = d.billNo || "-";
      const status = d.paymentStatus === "paid" ? "ชำระแล้ว" : (d.paymentStatus === "unpaid" ? "ค้างชำระ" : "ยกเลิก");
      const method = d.paymentMethod === "cash" ? "เงินสด" : (d.paymentMethod === "transfer" ? "โอน" : "-");
      const svc = d.serviceType === "dry" ? "ซักแห้ง" : (d.serviceType === "wash" ? "ซักน้ำ" : "-");
      const name = d.customerName || "-";
      const phone = d.customerPhone || "-";
      const net = money(d.netAmount || 0);

      return `
        <div class="card" style="margin:8px 0;">
          <div class="row" style="align-items:center;">
            <div>
              <b>บิล:</b> ${bill} <span class="badge">${status}</span><br/>
              <span class="muted">ลูกค้า:</span> ${name} (${phone})<br/>
              <span class="muted">บริการ:</span> ${svc} • <span class="muted">ชิ้น:</span> ${Number(d.itemCount||0)} • <span class="muted">วิธีชำระ:</span> ${method}
            </div>
            <div style="text-align:right;">
              <b>สุทธิ: ${net} บาท</b><br/>
              <span class="muted">${d.businessDate || "-"}</span>
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  function setAmendInputsFromCloseDoc(docData) {
    // เอาค่าปัจจุบันมาใส่ช่องแก้ไข (ให้แก้เฉพาะยอด)
    amendTotalNetEl.value = Number(docData?.totalNet || 0);
    amendCashEl.value = Number(docData?.cashTotal || 0);
    amendTransferEl.value = Number(docData?.transferTotal || 0);
    amendUnpaidEl.value = Number(docData?.unpaidTotal || 0);
    amendReasonEl.value = "";
  }

  function startRealtime() {
    if (unsubscribeTx) unsubscribeTx();
    lastComputed = null;
    lastCloseDoc = null;

    summaryEl.textContent = "กำลังโหลด...";
    txListEl.textContent = "กำลังโหลดรายการ...";
    resultEl.textContent = "";
    amendResultEl.textContent = "";
    amendBox.style.display = "none";
    toggleAmendBtn.style.display = "none";

    const branchId = branchEl.value;
    const docId = closeDocId(branchId, businessDate);

    // 1) โหลด close doc (ถ้ามี)
    db.collection("daily_closes").doc(docId).onSnapshot((doc) => {
      if (doc.exists) {
        const d = doc.data();
        lastCloseDoc = d;

        summaryEl.innerHTML =
          `✅ <b>ปิดยอดแล้ว</b><br/>
           สาขา: <b>${d.branchId}</b> • วันที่: <b>${d.businessDate}</b><br/>
           บิล: <b>${d.totalBills}</b> • สุทธิรวม: <b>${money(d.totalNet)}</b> บาท<br/>
           เงินสด: <b>${money(d.cashTotal)}</b> • โอน: <b>${money(d.transferTotal)}</b> • ค้างชำระ: <b>${money(d.unpaidTotal)}</b><br/>
           ปิดโดย: <b>${d.closedBy || "-"}</b> • เวลา: <b>${d.closedAt?.toDate ? d.closedAt.toDate().toLocaleString() : "-"}</b>
           ${d.amendedAt?.toDate ? `<br/>✏️ แก้ไขล่าสุด: <b>${d.amendedAt.toDate().toLocaleString()}</b> โดย <b>${d.amendedBy || "-"}</b>` : ""}`;

        closeBtn.disabled = true;
        closeBtn.textContent = "✅ ปิดยอดแล้ว (ล็อกแล้ว)";

        // เปิดปุ่มขอแก้ไขยอด
        toggleAmendBtn.style.display = "inline-block";
        setAmendInputsFromCloseDoc(d);
      } else {
        summaryEl.innerHTML =
          `สาขา: <b>${branchId}</b> • วันที่: <b>${businessDate}</b><br/>กำลังคำนวณจากรายการ...`;

        closeBtn.disabled = false;
        closeBtn.textContent = "🔒 ปิดยอดวันนี้";
        toggleAmendBtn.style.display = "none";
        amendBox.style.display = "none";
      }
    });

    // 2) โหลดรายการ transactions ของวันนี้ + สาขานี้ แบบ realtime (เพื่อให้ยอด “ตรงกับรายการวันนี้”)
    const q = db.collection("transactions")
      .where("businessDate", "==", businessDate)
      .where("branchId", "==", branchId);

    unsubscribeTx = q.onSnapshot((snap) => {
      const items = [];
      let totalBills = 0;
      let totalNet = 0;
      let cashTotal = 0;
      let transferTotal = 0;
      let unpaidTotal = 0;

      snap.forEach((doc) => {
        const d = doc.data();
        items.push(d);

        // ถ้าบิลถูกยกเลิก จะไม่นับเข้ายอด
        if (d.paymentStatus === "cancelled") return;

        totalBills += 1;
        const net = Number(d.netAmount || 0);
        totalNet += net;

        if (d.paymentStatus === "paid") {
          if (d.paymentMethod === "cash") cashTotal += net;
          if (d.paymentMethod === "transfer") transferTotal += net;
        } else if (d.paymentStatus === "unpaid") {
          unpaidTotal += net;
        }
      });

      // เรียงรายการตามเลขบิล (ถ้าต้องการ)
      items.sort((a, b) => String(a.billNo || "").localeCompare(String(b.billNo || "")));

      lastComputed = { branchId, businessDate, totalBills, totalNet, cashTotal, transferTotal, unpaidTotal };
      renderTxList(items);

      // ถ้ายังไม่ปิดยอด ให้โชว์ summary จาก computed
      if (!lastCloseDoc) {
        summaryEl.innerHTML =
          `สาขา: <b>${branchId}</b> • วันที่: <b>${businessDate}</b><br/>
           จำนวนบิล: <b>${totalBills}</b><br/>
           ยอดสุทธิรวม: <b>${money(totalNet)}</b> บาท<br/>
           เงินสด: <b>${money(cashTotal)}</b> • โอน: <b>${money(transferTotal)}</b> • ค้างชำระ: <b>${money(unpaidTotal)}</b>`;
      }
    }, (err) => {
      console.error(err);
      summaryEl.textContent = "❌ โหลดข้อมูลไม่สำเร็จ (เช็ค Rules/Index)";
      txListEl.textContent = "❌ โหลดรายการไม่สำเร็จ";
    });
  }

  // ปิดยอด
  closeBtn.addEventListener("click", async () => {
    try {
      if (!lastComputed) {
        resultEl.textContent = "❌ ยังโหลดสรุปยอดไม่พร้อม กรุณารอสักครู่";
        return;
      }

      const branchId = branchEl.value;
      const docId = closeDocId(branchId, businessDate);

      closeBtn.disabled = true;
      resultEl.textContent = "⏳ กำลังปิดยอด...";

      await db.runTransaction(async (tx) => {
        const ref = db.collection("daily_closes").doc(docId);
        const snap = await tx.get(ref);
        if (snap.exists) throw new Error("วันนี้สาขานี้ปิดยอดแล้ว");

        tx.set(ref, {
          ...lastComputed,
          branchKey: branchKey(branchId),
          closedBy: (closedByEl.value || "").trim() || null,
          note: (noteEl.value || "").trim() || null,
          closedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      });

      resultEl.textContent = "✅ ปิดยอดเรียบร้อยแล้ว (ล็อกแล้ว)";
      closeBtn.textContent = "✅ ปิดยอดแล้ว (ล็อกแล้ว)";
    } catch (err) {
      console.error(err);
      resultEl.textContent = `❌ ปิดยอดไม่สำเร็จ: ${err.message || err}`;
      closeBtn.disabled = false;
    }
  });

  // toggle กล่องแก้ไขยอด
  toggleAmendBtn.addEventListener("click", () => {
    amendBox.style.display = (amendBox.style.display === "none") ? "block" : "none";
    amendResultEl.textContent = "";
  });

  // แก้ไขยอด (เก็บประวัติ + บังคับเหตุผล)
  amendBtn.addEventListener("click", async () => {
    try {
      const branchId = branchEl.value;
      const docId = closeDocId(branchId, businessDate);
      const reason = (amendReasonEl.value || "").trim();

      if (!reason) {
        amendResultEl.textContent = "❌ กรุณากรอกเหตุผลในการแก้ไข";
        return;
      }

      amendBtn.disabled = true;
      amendResultEl.textContent = "⏳ กำลังบันทึกการแก้ไข...";

      await db.runTransaction(async (tx) => {
        const closeRef = db.collection("daily_closes").doc(docId);
        const snap = await tx.get(closeRef);

        if (!snap.exists) throw new Error("ยังไม่ได้ปิดยอดของวันนี้ จึงแก้ไขไม่ได้");

        const before = snap.data();

        // ค่าที่แก้ไข
        const after = {
          totalNet: Number(amendTotalNetEl.value || 0),
          cashTotal: Number(amendCashEl.value || 0),
          transferTotal: Number(amendTransferEl.value || 0),
          unpaidTotal: Number(amendUnpaidEl.value || 0)
        };

        // เก็บประวัติ (before -> after) ใน subcollection
        const amendRef = closeRef.collection("amendments").doc();
        tx.set(amendRef, {
          branchId,
          businessDate,
          reason,
          amendedBy: (closedByEl.value || "").trim() || null,
          amendedNote: (noteEl.value || "").trim() || null,
          before: {
            totalBills: Number(before.totalBills || 0),
            totalNet: Number(before.totalNet || 0),
            cashTotal: Number(before.cashTotal || 0),
            transferTotal: Number(before.transferTotal || 0),
            unpaidTotal: Number(before.unpaidTotal || 0),
            closedBy: before.closedBy || null,
            closedAt: before.closedAt || null
          },
          after,
          amendedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // อัปเดตยอดล่าสุดบน daily_closes (เพื่อให้หน้าอื่นอ่าน “ยอดล่าสุด” ได้เลย)
        tx.update(closeRef, {
          ...after,
          amendedAt: firebase.firestore.FieldValue.serverTimestamp(),
          amendedBy: (closedByEl.value || "").trim() || null,
          amendedReason: reason
        });
      });

      amendResultEl.textContent = "✅ บันทึกการแก้ไขแล้ว (เก็บประวัติเรียบร้อย)";
      amendReasonEl.value = "";
    } catch (err) {
      console.error(err);
      amendResultEl.textContent = `❌ แก้ไขไม่สำเร็จ: ${err.message || err}`;
    } finally {
      amendBtn.disabled = false;
    }
  });

  // เปลี่ยนสาขา
  branchEl.addEventListener("change", startRealtime);

  startRealtime();
});
