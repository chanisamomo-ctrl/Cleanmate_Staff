// js/staff-close.js
document.addEventListener("DOMContentLoaded", () => {
  const branchEl = document.getElementById("branch");
  const dateEl = document.getElementById("date");
  const summaryEl = document.getElementById("summary");
  const closeBtn = document.getElementById("closeBtn");
  const resultEl = document.getElementById("result");
  const closedByEl = document.getElementById("closedBy");
  const noteEl = document.getElementById("note");

  // ใช้ helper จาก app.js (ถ้าไม่มี ให้เพิ่มฟังก์ชัน todayYMD ใน app.js)
  const businessDate = todayYMD();
  dateEl.value = businessDate;

  let unsubscribe = null;
  let lastComputed = null; // เก็บ summary ล่าสุดไว้ใช้ตอนกดปิดยอด

  function closeDocId(branchId, date) {
    // ทำให้ id ปลอดภัย (แทน space)
    const b = branchId.replace(/\s+/g, "_");
    return `${b}__${date}`;
  }

  function startRealtimeSummary() {
    if (unsubscribe) unsubscribe();

    summaryEl.textContent = "กำลังโหลด...";
    resultEl.textContent = "";

    const branchId = branchEl.value;
    const docId = closeDocId(branchId, businessDate);

    // 1) เช็คก่อนว่าวันนี้สาขานี้ถูกปิดยอดไปแล้วหรือยัง
    db.collection("daily_closes").doc(docId).onSnapshot((doc) => {
      if (doc.exists) {
        const d = doc.data();
        summaryEl.innerHTML =
          `✅ <b>ปิดยอดแล้ว</b><br/>
           สาขา: <b>${d.branchId}</b> • วันที่: <b>${d.businessDate}</b><br/>
           บิล: <b>${d.totalBills}</b> • สุทธิรวม: <b>${Number(d.totalNet).toLocaleString()}</b> บาท<br/>
           เงินสด: <b>${Number(d.cashTotal).toLocaleString()}</b> • โอน: <b>${Number(d.transferTotal).toLocaleString()}</b> • ค้างชำระ: <b>${Number(d.unpaidTotal).toLocaleString()}</b><br/>
           ปิดโดย: <b>${d.closedBy || "-"}</b> • เวลา: <b>${d.closedAt?.toDate ? d.closedAt.toDate().toLocaleString() : "-"}</b>`;

        closeBtn.disabled = true;
        closeBtn.textContent = "✅ ปิดยอดแล้ว (ล็อกแล้ว)";
      } else {
        closeBtn.disabled = false;
        closeBtn.textContent = "🔒 ปิดยอดวันนี้";
      }
    });

    // 2) สรุปยอดจาก transactions วันนี้ + สาขานี้ (realtime)
    const q = db.collection("transactions")
      .where("businessDate", "==", businessDate)
      .where("branchId", "==", branchId);

    unsubscribe = q.onSnapshot((snap) => {
      let totalBills = 0;
      let totalNet = 0;
      let cashTotal = 0;
      let transferTotal = 0;
      let unpaidTotal = 0;

      snap.forEach((doc) => {
        const d = doc.data();
        totalBills += 1;

        const net = Number(d.netAmount || 0);
        totalNet += net;

        if (d.paymentStatus === "paid") {
          if (d.paymentMethod === "cash") cashTotal += net;
          if (d.paymentMethod === "transfer") transferTotal += net;
        }
        if (d.paymentStatus === "unpaid") {
          unpaidTotal += net;
        }
      });

      lastComputed = { branchId, businessDate, totalBills, totalNet, cashTotal, transferTotal, unpaidTotal };

      summaryEl.innerHTML =
        `สาขา: <b>${branchId}</b> • วันที่: <b>${businessDate}</b><br/>
         จำนวนบิล: <b>${totalBills}</b><br/>
         ยอดสุทธิรวม: <b>${totalNet.toLocaleString()}</b> บาท<br/>
         เงินสด: <b>${cashTotal.toLocaleString()}</b> • โอน: <b>${transferTotal.toLocaleString()}</b> • ค้างชำระ: <b>${unpaidTotal.toLocaleString()}</b>`;
    }, (err) => {
      console.error(err);
      summaryEl.textContent = "❌ โหลดสรุปยอดไม่สำเร็จ (เช็ค Rules/Index)";
    });
  }

  // กดปิดยอด
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

      // ใช้ transaction กันกดซ้ำ
      await db.runTransaction(async (tx) => {
        const ref = db.collection("daily_closes").doc(docId);
        const snap = await tx.get(ref);

        if (snap.exists) {
          throw new Error("วันนี้สาขานี้ปิดยอดแล้ว");
        }

        tx.set(ref, {
          ...lastComputed,
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

  // เปลี่ยนสาขาแล้ว reload summary
  branchEl.addEventListener("change", startRealtimeSummary);

  startRealtimeSummary();
});
