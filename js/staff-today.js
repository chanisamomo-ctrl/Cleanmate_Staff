// js/staff-today.js
document.addEventListener("DOMContentLoaded", () => {
  const list = document.getElementById("list");
  const summary = document.getElementById("summary");

  const branchSelect = document.getElementById("branchFilter");
  branchSelect.addEventListener("change", () => load());

  function renderItem(doc) {
    const d = doc.data();
    const div = document.createElement("div");
    div.className = "card";

    const statusBadge = d.paymentStatus === "unpaid"
      ? `<span class="badge">ค้างชำระ</span>`
      : d.paymentStatus === "cancelled"
        ? `<span class="badge">ยกเลิก</span>`
        : "";

    div.innerHTML = `
      <div><b>บิล:</b> ${d.billNo || "-"} ${statusBadge}</div>
      <div class="small">
        สาขา: ${d.branchId || "-"} • ลูกค้า: ${d.customerName || "-"} (${d.customerPhone || "-"})
      </div>
      <div class="small">
        บริการ: ${d.serviceType || "-"} • ชิ้น: ${d.itemCount ?? "-"} • สุทธิ: ${d.netAmount ?? "-"} บาท
      </div>
    `;
    return div;
  }

  function load() {
    list.innerHTML = "";
    summary.textContent = "กำลังโหลด...";

    const businessDate = todayYMD();
    let q = db.collection("transactions")
      .where("businessDate", "==", businessDate)
      .orderBy("createdAt", "desc");

    const branch = branchSelect.value;
    if (branch !== "ALL") {
      q = q.where("branchId", "==", branch);
    }

    // realtime
    q.onSnapshot((snap) => {
      list.innerHTML = "";
      let totalNet = 0;
      let count = 0;

      snap.forEach((doc) => {
        const d = doc.data();
        count += 1;
        totalNet += Number(d.netAmount || 0);
        list.appendChild(renderItem(doc));
      });

      summary.textContent = `วันนี้ (${businessDate}) • จำนวนบิล: ${count} • ยอดสุทธิรวม: ${totalNet.toLocaleString()} บาท`;
    }, (err) => {
      console.error(err);
      summary.textContent = "❌ โหลดข้อมูลไม่สำเร็จ (เช็ค Firestore Rules / Index)";
    });
  }

  load();
});
