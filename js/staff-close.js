// js/staff-close.js (branchKey version)
// ปิดยอดรายวันแยกสาขา + สร้างเอกสาร daily_closes: <branchKey>__<YYYY-MM-DD>
// เมื่อปิดยอดแล้ว Firestore Rules จะล็อกไม่ให้สร้างบิลย้อนหลังวัน/สาขานั้น

document.addEventListener("DOMContentLoaded", () => {
  const branchEl = document.getElementById("branch");
  const dateEl = document.getElementById("date");
  const summaryEl = document.getElementById("summary");
  const closeBtn = document.getElementById("closeBtn");
  const resultEl = document.getElementById("result");
  const closedByEl = document.getElementById("closedBy");
  const noteEl = document.getElementById("note");

  // ใช้ helper จาก app.js
  const businessDate = todayYMD();
  dateEl.value = businessDate;

  let unsubscribeTx = null;
  let unsubscribeCloseDoc = null;
  let lastComputed = null;

  function toBranchKey(branchId) {
    return String(branchId || "").replace(/\s+/g, "_");
  }

  function closeDocId(branchKey, date) {
    return `${branchKey}__${date}`;
  }

  function setClosedUI(isClosed) {
    if (isClosed) {
      closeBtn.disabled = true;
      closeBtn.textContent = "✅ ปิดยอดแล้ว (ล็อกแล้ว)";
    } else {
      closeBtn.disabled = false;
      closeBtn.textContent = "🔒 ปิดยอดวันนี้";
    }
  }

  function startRealtimeSummary() {
    // ยกเลิก listener เก่า
    if (unsubscribeTx) unsubscribeTx();
    if (unsubscribeCloseDoc) unsubscribeCloseDoc();

    summaryEl.textContent = "กำลังโหลด...";
    resultEl.textContent = "";

    const branchId = branchEl.value;
    const branchKey = toBranchKey(branchId);
    const docId = closeDocId(branchKey, businessDate);

    // 1) ฟังเอกสารปิดยอด เพื่อ disable ปุ่มทันทีถ้าปิดแล้ว
    unsubscribeCloseDoc = db.collection("daily_closes").doc(docId).onSnapshot((doc) => {
      if (doc.exists) {
        const d = doc.data();
        summaryEl.innerHTML =
          `✅ <b>ปิดยอดแล้ว</b><br/>
           สาขา: <b>${d.branchId || "-"}</b> • วันที่: <b>${d.businessDate || businessDate}</b><br/>
           บิล: <b>${Number(d.totalBills || 0).toLocaleString()}</b> • สุทธิรวม: <b>${Number(d.totalNet || 0).toLocaleString()}</b> บาท<br/>
           เงินสด: <b>${Number(d.cashTotal || 0).toLocaleString()}</b> • โอน: <b>${Number(d.transferTotal || 0).toLocaleString()}</b> • ค้างชำระ: <b>${Number(d.unpaidTotal || 0).toLocaleString()}</b><br/>
           ปิดโดย: <b>${d.closedBy || "-"}</b> • เวลา: <b>${d.closedAt?.toDate ? d.closedAt.toDate().toLocaleString() : "-"}</b>`;

        setClosedUI(true);
      } else {
        // ยังไม่ปิดยอด -> ยังให้กดได้
        setClosedUI(false);
      }
    }, (err) => {
      console.error(err);
      resultEl.textContent = "❌ โหลดสถานะปิดยอดไม่สำเร็จ (เช็ค Rules)";
    });

    // 2) สรุปยอดจาก transactions วันนี้ + สาขานี้ (realtime)
    // ใช้ branchKey เพื่อให้เข้ากับ Rules และลดปัญหาชื่อสาขามีช่องว่าง
    const q = db.collection("transactions")
      .where("businessDate", "==", businessDate)
      .where("branchKey", "==", branchKey);

    unsubscribeTx = q.onSnapshot((snap) => {
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

      lastComputed = {
        branchId,
        branchKey,
        businessDate,
        totalBills,
        totalNet,
        cashTotal,
        transferTotal,
        unpaidTotal
      };

      summaryEl.innerHTML =
        `สาขา: <b>${branchId}</b> • วันที่: <b>${businessDate}</b><br/>
         จำนวนบิล: <b>${totalBills.toLocaleString()}</b><br/>
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
      const branchKey = toBranchKey(branchId);
      const docId = closeDocId(branchKey, businessDate);

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
      setClosedUI(true);
    } catch (err) {
      console.error(err);
      resultEl.textContent = `❌ ปิดยอดไม่สำเร็จ: ${err.message || err}`;
      // เปิดให้ลองใหม่ได้
      setClosedUI(false);
    }
  });

  // เปลี่ยนสาขาแล้ว reload summary
  branchEl.addEventListener("change", startRealtimeSummary);

  startRealtimeSummary();
});
