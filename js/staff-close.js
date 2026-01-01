// js/staff-close.js
document.addEventListener("DOMContentLoaded", () => {
  const branchEl = document.getElementById("branch");
  const dateEl = document.getElementById("date");
  const summaryEl = document.getElementById("summary");
  const txListEl = document.getElementById("txList");
  const closeBtn = document.getElementById("closeBtn");
  const resultEl = document.getElementById("result");
  const closedByEl = document.getElementById("closedBy");
  const noteEl = document.getElementById("note");

  const businessDate = todayYMD();
  if (dateEl) dateEl.value = businessDate;

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
    if (!closeBtn) return;
    if (isClosed) {
      closeBtn.disabled = true;
      closeBtn.textContent = "✅ ปิดยอดแล้ว (ล็อกแล้ว)";
    } else {
      closeBtn.disabled = false;
      closeBtn.textContent = "🔒 ปิดยอดวันนี้";
    }
  }

  function escapeHtml(s) {
    return String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function renderList(items) {
    if (!txListEl) return;

    if (!items.length) {
      txListEl.innerHTML = `<div class="muted">ยังไม่มีรายการของวันนี้</div>`;
      return;
    }

    txListEl.innerHTML = items.map((x) => {
      const status =
        x.paymentStatus === "paid" ? "ชำระแล้ว" :
        x.paymentStatus === "unpaid" ? "ค้างชำระ" : "ยกเลิก";

      const method =
        x.paymentMethod === "cash" ? "เงินสด" :
        x.paymentMethod === "transfer" ? "เงินโอน" : "-";

      const service =
        x.serviceType === "dry" ? "ซักแห้ง" :
        x.serviceType === "wash" ? "ซักน้ำ" : "-";

      return `
        <div style="border:1px solid #eee; border-radius:12px; padding:10px; margin:8px 0; background:#fff;">
          <div style="display:flex; justify-content:space-between; gap:12px;">
            <div>
              <b>บิล:</b> ${escapeHtml(x.billNo || "-")}
              <span style="margin-left:8px; padding:2px 8px; border-radius:999px; border:1px solid #ddd;">
                ${escapeHtml(status)}
              </span>
              <div class="muted" style="margin-top:4px;">
                ลูกค้า: ${escapeHtml(x.customerName || "-")} (${escapeHtml(x.customerPhone || "-")})
              </div>
              <div class="muted">
                บริการ: ${escapeHtml(service)} • ชิ้น: ${Number(x.itemCount || 0)} • วิธีชำระ: ${escapeHtml(method)}
              </div>
            </div>
            <div style="text-align:right; min-width:120px;">
              <div><b>สุทธิ:</b> ${Number(x.netAmount || 0).toLocaleString()} บาท</div>
              <div class="muted" style="margin-top:4px;">${escapeHtml(x.businessDate || "")}</div>
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  function startRealtime() {
    if (unsubscribeTx) unsubscribeTx();
    if (unsubscribeCloseDoc) unsubscribeCloseDoc();

    if (summaryEl) summaryEl.textContent = "กำลังโหลด...";
    if (txListEl) txListEl.textContent = "กำลังโหลดรายการ...";
    if (resultEl) resultEl.textContent = "";

    const branchId = branchEl ? branchEl.value : "";
    const branchKey = toBranchKey(branchId);
    const closeId = closeDocId(branchKey, businessDate);

    // 1) เช็คว่าปิดยอดแล้วหรือยัง
    unsubscribeCloseDoc = db.collection("daily_closes").doc(closeId).onSnapshot((doc) => {
      if (!summaryEl) return;

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
        setClosedUI(false);
      }
    });

    // 2) ดึงรายการวันนี้ของสาขานั้น (ใช้ branchId ให้ตรงกับข้อมูลเดิม)
    const q = db.collection("transactions")
      .where("businessDate", "==", businessDate)
      .where("branchId", "==", branchId);

    unsubscribeTx = q.onSnapshot((snap) => {
      let totalBills = 0;
      let totalNet = 0;
      let cashTotal = 0;
      let transferTotal = 0;
      let unpaidTotal = 0;

      const items = [];

      snap.forEach((doc) => {
        const d = doc.data();
        items.push({ id: doc.id, ...d });

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

      // เรียงล่าสุดก่อน (ถ้ามี createdAt เป็น Timestamp)
      items.sort((a, b) => {
        const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return tb - ta;
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

      if (summaryEl) {
        summaryEl.innerHTML =
          `สาขา: <b>${branchId}</b> • วันที่: <b>${businessDate}</b><br/>
           จำนวนบิล: <b>${totalBills.toLocaleString()}</b><br/>
           ยอดสุทธิรวม: <b>${totalNet.toLocaleString()}</b> บาท<br/>
           เงินสด: <b>${cashTotal.toLocaleString()}</b> • โอน: <b>${transferTotal.toLocaleString()}</b> • ค้างชำระ: <b>${unpaidTotal.toLocaleString()}</b>`;
      }

      renderList(items);
    }, (err) => {
      console.error(err);
      if (summaryEl) summaryEl.textContent = "❌ โหลดสรุปยอดไม่สำเร็จ (เช็ค Rules/Index)";
      if (txListEl) txListEl.textContent = "❌ โหลดรายการไม่สำเร็จ";
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", async () => {
      try {
        if (!lastComputed) {
          if (resultEl) resultEl.textContent = "❌ ยังโหลดสรุปยอดไม่พร้อม กรุณารอสักครู่";
          return;
        }

        const branchId = branchEl ? branchEl.value : "";
        const branchKey = toBranchKey(branchId);
        const closeId = closeDocId(branchKey, businessDate);

        closeBtn.disabled = true;
        if (resultEl) resultEl.textContent = "⏳ กำลังปิดยอด...";

        await db.runTransaction(async (tx) => {
          const ref = db.collection("daily_closes").doc(closeId);
          const snap = await tx.get(ref);
          if (snap.exists) throw new Error("วันนี้สาขานี้ปิดยอดแล้ว");

          tx.set(ref, {
            ...lastComputed,
            closedBy: (closedByEl?.value || "").trim() || null,
            note: (noteEl?.value || "").trim() || null,
            closedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        });

        if (resultEl) resultEl.textContent = "✅ ปิดยอดเรียบร้อยแล้ว (ล็อกแล้ว)";
        setClosedUI(true);
      } catch (err) {
        console.error(err);
        if (resultEl) resultEl.textContent = `❌ ปิดยอดไม่สำเร็จ: ${err.message || err}`;
        setClosedUI(false);
      }
    });
  }

  if (branchEl) branchEl.addEventListener("change", startRealtime);
  startRealtime();
});
