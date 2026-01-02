// js/owner-dashboard.js
document.addEventListener("DOMContentLoaded", () => {
  const branchEl = document.getElementById("branch");
  const fromEl = document.getElementById("fromDate");
  const toEl = document.getElementById("toDate");
  const loadBtn = document.getElementById("loadBtn");
  const exportBtn = document.getElementById("exportBtn");

  const kpiEl = document.getElementById("kpi");
  const listEl = document.getElementById("list");
  const amendmentsEl = document.getElementById("amendments");

  // ---------- helpers ----------
  function money(n) {
    return Number(n || 0).toLocaleString();
  }
  function safeText(s) {
    return String(s ?? "");
  }

  // ตั้งค่า default วันที่
  if (!fromEl.value) fromEl.value = todayYMD();
  if (!toEl.value) toEl.value = todayYMD();

  let lastRows = [];

  // ---------- render ----------
  function renderKPI(rows) {
    let sumBills = 0, sumNet = 0, sumCash = 0, sumTransfer = 0, sumUnpaid = 0;

    rows.forEach((r) => {
      sumBills += Number(r.totalBills || 0);
      sumNet += Number(r.totalNet || 0);
      sumCash += Number(r.cashTotal || 0);
      sumTransfer += Number(r.transferTotal || 0);
      sumUnpaid += Number(r.unpaidTotal || 0);
    });

    kpiEl.innerHTML = `
      สรุปรวม: <b>${rows.length}</b> วัน • บิลรวม: <b>${money(sumBills)}</b> • สุทธิ: <b>${money(sumNet)}</b> บาท<br/>
      เงินสด: <b>${money(sumCash)}</b> • โอน: <b>${money(sumTransfer)}</b> • ค้างชำระ: <b>${money(sumUnpaid)}</b>
    `;
  }

  function renderDailyCloses(rows) {
    if (!rows.length) {
      listEl.innerHTML = `<div class="muted">ไม่พบข้อมูลในช่วงวันที่ที่เลือก</div>`;
      return;
    }

    listEl.innerHTML = `
      <table style="width:100%; border-collapse:collapse;">
        <thead>
          <tr>
            <th style="text-align:left; padding:8px; border-bottom:1px solid #eee;">วันที่</th>
            <th style="text-align:left; padding:8px; border-bottom:1px solid #eee;">สาขา</th>
            <th style="text-align:right; padding:8px; border-bottom:1px solid #eee;">บิล</th>
            <th style="text-align:right; padding:8px; border-bottom:1px solid #eee;">สุทธิ</th>
            <th style="text-align:right; padding:8px; border-bottom:1px solid #eee;">เงินสด</th>
            <th style="text-align:right; padding:8px; border-bottom:1px solid #eee;">โอน</th>
            <th style="text-align:right; padding:8px; border-bottom:1px solid #eee;">ค้าง</th>
            <th style="text-align:left; padding:8px; border-bottom:1px solid #eee;">ปิดโดย</th>
            <th style="text-align:left; padding:8px; border-bottom:1px solid #eee;">หมายเหตุ</th>
            <th style="text-align:left; padding:8px; border-bottom:1px solid #eee;">แก้ไขล่าสุด</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r) => {
            const amended = r.amendedAt?.toDate ? r.amendedAt.toDate().toLocaleString() : "-";
            return `
              <tr>
                <td style="padding:8px; border-bottom:1px solid #f3f3f3;">${safeText(r.businessDate)}</td>
                <td style="padding:8px; border-bottom:1px solid #f3f3f3;">${safeText(r.branchId)}</td>
                <td style="padding:8px; border-bottom:1px solid #f3f3f3; text-align:right;">${money(r.totalBills)}</td>
                <td style="padding:8px; border-bottom:1px solid #f3f3f3; text-align:right;">${money(r.totalNet)}</td>
                <td style="padding:8px; border-bottom:1px solid #f3f3f3; text-align:right;">${money(r.cashTotal)}</td>
                <td style="padding:8px; border-bottom:1px solid #f3f3f3; text-align:right;">${money(r.transferTotal)}</td>
                <td style="padding:8px; border-bottom:1px solid #f3f3f3; text-align:right;">${money(r.unpaidTotal)}</td>
                <td style="padding:8px; border-bottom:1px solid #f3f3f3;">${safeText(r.closedBy || "-")}</td>
                <td style="padding:8px; border-bottom:1px solid #f3f3f3;">${safeText(r.note || "-")}</td>
                <td style="padding:8px; border-bottom:1px solid #f3f3f3;">${amended}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    `;
  }

  function renderAmendments(items) {
    if (!items.length) {
      amendmentsEl.innerHTML = `<div class="muted">ยังไม่มีการแก้ไขปิดยอด</div>`;
      return;
    }

    amendmentsEl.innerHTML = items.map((x) => {
      const time = x.amendedAt?.toDate ? x.amendedAt.toDate().toLocaleString() : "-";
      return `
        <div class="card" style="margin:8px 0;">
          <b>${safeText(x.businessDate)}</b> • <b>${safeText(x.branchId)}</b><br/>
          เหตุผล: <b>${safeText(x.reason || "-")}</b><br/>
          ก่อน: สุทธิ ${money(x.before?.totalNet)} | เงินสด ${money(x.before?.cashTotal)} | โอน ${money(x.before?.transferTotal)} | ค้าง ${money(x.before?.unpaidTotal)}<br/>
          หลัง: สุทธิ ${money(x.after?.totalNet)} | เงินสด ${money(x.after?.cashTotal)} | โอน ${money(x.after?.transferTotal)} | ค้าง ${money(x.after?.unpaidTotal)}<br/>
          แก้โดย: ${safeText(x.amendedBy || "-")} • เวลา: ${time}
        </div>
      `;
    }).join("");
  }

  // ---------- load ----------
  async function loadData() {
    const branchId = branchEl.value; // "" = ทั้งหมด
    const fromYMD = fromEl.value || todayYMD();
    const toYMD = toEl.value || todayYMD();

    if (fromYMD > toYMD) {
      kpiEl.textContent = "❌ ช่วงวันที่ไม่ถูกต้อง (จากวันที่ต้องไม่เกินถึงวันที่)";
      listEl.textContent = "";
      amendmentsEl.textContent = "";
      return;
    }

    kpiEl.textContent = "กำลังโหลด...";
    listEl.textContent = "กำลังโหลด...";
    amendmentsEl.textContent = "กำลังโหลด...";

    try {
      // 1) daily_closes
      let q = db.collection("daily_closes")
        .where("businessDate", ">=", fromYMD)
        .where("businessDate", "<=", toYMD)
        .orderBy("businessDate", "asc");

      if (branchId) q = q.where("branchId", "==", branchId);

      const snap = await q.get();
      const rows = [];
      snap.forEach((doc) => rows.push(doc.data()));
      lastRows = rows;

      renderKPI(rows);
      renderDailyCloses(rows);

      // 2) collectionGroup amendments (subcollection จริง)
      let aq = db.collectionGroup("amendments")
        .where("businessDate", ">=", fromYMD)
        .where("businessDate", "<=", toYMD)
        .orderBy("businessDate", "asc")
        .orderBy("amendedAt", "desc")
        .limit(50);

      if (branchId) aq = aq.where("branchId", "==", branchId);

      const aSnap = await aq.get();
      const items = [];
      aSnap.forEach((doc) => items.push(doc.data()));
      renderAmendments(items);

    } catch (err) {
      console.error("Owner Dashboard error:", err);
      const msg = err?.message || String(err);
      kpiEl.innerHTML = `<span style="color:#c00;">❌ โหลดไม่สำเร็จ: ${safeText(msg)}</span>`;
      listEl.innerHTML = `<div class="muted">❌ โหลดข้อมูลไม่สำเร็จ</div>`;
      amendmentsEl.innerHTML = `<div class="muted">❌ โหลดประวัติการแก้ไขไม่สำเร็จ</div>`;
    }
  }

  // ---------- export ----------
  function exportCSV() {
    if (!lastRows.length) return;

    const headers = [
      "businessDate","branchId","totalBills","totalNet","cashTotal","transferTotal","unpaidTotal",
      "closedBy","note","amendedAt","amendedBy","amendedReason",
    ];

    const lines = [headers.join(",")];
    for (const r of lastRows) {
      const amendedAt = r.amendedAt?.toDate ? r.amendedAt.toDate().toISOString() : "";
      lines.push([
        safeText(r.businessDate),
        safeText(r.branchId),
        Number(r.totalBills || 0),
        Number(r.totalNet || 0),
        Number(r.cashTotal || 0),
        Number(r.transferTotal || 0),
        Number(r.unpaidTotal || 0),
        safeText((r.closedBy || "").replaceAll(",", " ")),
        safeText((r.note || "").replaceAll(",", " ")),
        safeText(amendedAt),
        safeText((r.amendedBy || "").replaceAll(",", " ")),
        safeText((r.amendedReason || "").replaceAll(",", " ")),
      ].join(","));
    }

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `owner-dashboard_${fromEl.value || todayYMD()}_${toEl.value || todayYMD()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // ---------- events ----------
  loadBtn.addEventListener("click", loadData);
  exportBtn.addEventListener("click", exportCSV);

  loadData();
});
