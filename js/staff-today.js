// js/staff-today.js (Firestore compat)
const db = window.db;

document.addEventListener("DOMContentLoaded", () => {
  const listEl = document.getElementById("list");
  const summaryEl = document.getElementById("summary");
  const branchFilter = document.getElementById("branchFilter");
  const payFilter = document.getElementById("payFilter");

  let unsubscribe = null;

  function badge(text) {
    return `<span style="display:inline-block;padding:2px 8px;border:1px solid #ddd;border-radius:999px;font-size:12px;">${text}</span>`;
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function money(v) {
    return Number(v || 0).toLocaleString("th-TH", { maximumFractionDigits: 0 });
  }

  function toThaiPayMethod(m) {
    return m === "cash" ? "เงินสด" : m === "transfer" ? "โอน" : "-";
  }

  function toThaiService(s) {
    return s === "dry" ? "ซักแห้ง" : s === "wash" ? "ซักน้ำ" : (s || "-");
  }

  function renderRow(d) {
    const status =
      d.paymentStatus === "unpaid" ? badge("ค้างชำระ") :
      d.paymentStatus === "cancelled" ? badge("ยกเลิก") :
      badge("ชำระแล้ว");

    const payMethod = toThaiPayMethod(d.paymentMethod);
    const service = toThaiService(d.serviceType);
    const net = money(d.netAmount);

    const when = d.createdAt?.toDate
      ? d.createdAt.toDate().toLocaleString("th-TH")
      : (d.businessDate || "");

    const branch = d.branchId || d.branchKey || "-";

    return `
      <div class="card" style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
          <div>
            <div><b>บิล:</b> ${esc(d.billNo || "-")} ${status}</div>
            <div class="small">สาขา: ${esc(branch)} • ลูกค้า: ${esc(d.customerName || "-")} (${esc(d.customerPhone || "-")})</div>
            <div class="small">บริการ: ${esc(service)} • ชิ้น: ${esc(d.itemCount ?? "-")} • วิธีชำระ: ${esc(payMethod)}</div>
          </div>
          <div style="text-align:right;">
            <div><b>สุทธิ:</b> ${net} บาท</div>
            <div class="small">${esc(when)}</div>
          </div>
        </div>
      </div>
    `;
  }

  function dayRangeTimestamps(dateObj = new Date()) {
    const start = new Date(dateObj);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    return {
      startTs: firebase.firestore.Timestamp.fromDate(start),
      endTs: firebase.firestore.Timestamp.fromDate(end),
      ymd: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`
    };
  }

  function startRealtime() {
    // ยกเลิก listener เก่า (กันซ้อน)
    if (unsubscribe) unsubscribe();

    listEl.innerHTML = "";
    summaryEl.textContent = "กำลังโหลด...";

    const { startTs, endTs, ymd } = dayRangeTimestamps(new Date());

    // ✅ query หลัก: ใช้ createdAt ของ "วันนี้"
    // (เสถียรกว่า businessDate และสอดคล้องกับปิดยอด)
    let q = db.collection("transactions")
      .where("createdAt", ">=", startTs)
      .where("createdAt", "<", endTs)
      .orderBy("createdAt", "desc");

    unsubscribe = q.onSnapshot((snap) => {
      const branch = branchFilter?.value || "ALL";
      const pay = payFilter?.value || "ALL";

      let count = 0;
      let totalNet = 0;
      let paidNet = 0;
      let unpaidNet = 0;

      let html = "";

      snap.forEach((doc) => {
        const d = doc.data();

        const docBranch = d.branchId || d.branchKey || "";

        // filter ฝั่ง client (ง่ายสุด ไม่ต้องทำ index เพิ่ม)
        if (branch !== "ALL" && docBranch !== branch) return;
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
        `วันที่: <b>${esc(ymd)}</b> • จำนวนบิล: <b>${count}</b><br/>
         ยอดสุทธิรวม: <b>${money(totalNet)}</b> บาท • ชำระแล้ว: <b>${money(paidNet)}</b> • ค้างชำระ: <b>${money(unpaidNet)}</b>`;
    }, (err) => {
      console.error(err);
      summaryEl.textContent = "❌ โหลดข้อมูลไม่สำเร็จ (เช็ค Firestore Rules/Index)";
    });
  }

  // เปลี่ยน filter แล้ว reload realtime
  branchFilter?.addEventListener("change", startRealtime);
  payFilter?.addEventListener("change", startRealtime);

  startRealtime();
});
