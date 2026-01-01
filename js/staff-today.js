// js/staff-today.js
document.addEventListener("DOMContentLoaded", () => {
  const listEl = document.getElementById("list");
  const summaryEl = document.getElementById("summary");
  const branchFilter = document.getElementById("branchFilter");
  const payFilter = document.getElementById("payFilter");

  let unsubscribe = null;

  function badge(text) {
    return `<span style="display:inline-block;padding:2px 8px;border:1px solid #ddd;border-radius:999px;font-size:12px;">${text}</span>`;
  }

  function renderRow(d) {
    const status =
      d.paymentStatus === "unpaid" ? badge("ค้างชำระ") :
      d.paymentStatus === "cancelled" ? badge("ยกเลิก") :
      badge("ชำระแล้ว");

    const payMethod =
      d.paymentMethod === "cash" ? "เงินสด" :
      d.paymentMethod === "transfer" ? "โอน" :
      "-";

    const service =
      d.serviceType === "dry" ? "ซักแห้ง" :
      d.serviceType === "wash" ? "ซักน้ำ" :
      d.serviceType || "-";

    const net = Number(d.netAmount || 0).toLocaleString();

    return `
      <div class="card" style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
          <div>
            <div><b>บิล:</b> ${d.billNo || "-"} ${status}</div>
            <div class="small">สาขา: ${d.branchId || "-"} • ลูกค้า: ${d.customerName || "-"} (${d.customerPhone || "-"})</div>
            <div class="small">บริการ: ${service} • ชิ้น: ${d.itemCount ?? "-"} • วิธีชำระ: ${payMethod}</div>
          </div>
          <div style="text-align:right;">
            <div><b>สุทธิ:</b> ${net} บาท</div>
            <div class="small">${d.businessDate || ""}</div>
          </div>
        </div>
      </div>
    `;
  }

  function startRealtime() {
    // ยกเลิก listener เก่า (กันซ้อน)
    if (unsubscribe) unsubscribe();

    listEl.innerHTML = "";
    summaryEl.textContent = "กำลังโหลด...";

    const date = todayYMD(); // มาจาก js/app.js (ถ้าไม่มี ให้เพิ่มใน app.js)

    // query หลัก: วันนี้เท่านั้น
    let q = db.collection("transactions").where("businessDate", "==", date);

    // realtime
    unsubscribe = q.onSnapshot((snap) => {
      const branch = branchFilter.value;
      const pay = payFilter.value;

      let count = 0;
      let totalNet = 0;
      let paidNet = 0;
      let unpaidNet = 0;

      let html = "";

      snap.forEach((doc) => {
        const d = doc.data();

        // filter ฝั่ง client (ง่ายสุด ไม่ต้องทำ index)
        if (branch !== "ALL" && d.branchId !== branch) return;
        if (pay !== "ALL" && d.paymentStatus !== pay) return;

        count += 1;

        const net = Number(d.netAmount || 0);
        totalNet += net;

        if (d.paymentStatus === "paid") paidNet += net;
        if (d.paymentStatus === "unpaid") unpaidNet += net;

        html += renderRow(d);
      });

      listEl.innerHTML = html || `<div class="small">ยังไม่มีรายการวันนี้</div>`;

      summaryEl.innerHTML =
        `วันที่: <b>${date}</b> • จำนวนบิล: <b>${count}</b><br/>
         ยอดสุทธิรวม: <b>${totalNet.toLocaleString()}</b> บาท • ชำระแล้ว: <b>${paidNet.toLocaleString()}</b> • ค้างชำระ: <b>${unpaidNet.toLocaleString()}</b>`;
    }, (err) => {
      console.error(err);
      summaryEl.textContent = "❌ โหลดข้อมูลไม่สำเร็จ (เช็ค Firestore Rules/Index)";
    });
  }

  // เปลี่ยน filter แล้ว reload realtime
  branchFilter.addEventListener("change", startRealtime);
  payFilter.addEventListener("change", startRealtime);

  startRealtime();
});
