// js/owner-dashboard.js
document.addEventListener("DOMContentLoaded", () => {
  const branchEl = document.getElementById("branch");
  const fromEl = document.getElementById("fromDate");
  const toEl = document.getElementById("toDate");
  const loadBtn = document.getElementById("loadBtn");
  const exportBtn = document.getElementById("exportBtn");
  const kpiEl = document.getElementById("kpi");
  const listEl = document.getElementById("list");
  const amEl = document.getElementById("amendments");

  function ymd(d) {
    const x = new Date(d);
    const y = x.getFullYear();
    const m = String(x.getMonth() + 1).padStart(2, "0");
    const day = String(x.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function money(n) {
    return Number(n || 0).toLocaleString();
  }

  // ตั้งค่า default: วันนี้ และย้อนหลัง 7 วัน
  const today = new Date();
  toEl.value = ymd(today);
  const from = new Date();
  from.setDate(today.getDate() - 7);
  fromEl.value = ymd(from);

  let lastRows = []; // เก็บไว้ export

  function branchKey(branchId) {
    return (branchId || "").replace(/\s+/g, "_");
  }

  function renderRows(rows) {
    if (!rows.length) {
      listEl.innerHTML = `<div class="muted">ไม่พบข้อมูลในช่วงวันที่เลือก</div>`;
      kpiEl.textContent = "—";
      return;
    }

    // KPI รวม
    const totalDays = rows.length;
    const totalBills = rows.reduce((s, r) => s + Number(r.totalBills || 0), 0);
    const totalNet = rows.reduce((s, r) => s + Number(r.totalNet || 0), 0);
    const cash = rows.reduce((s, r) => s + Number(r.cashTotal || 0), 0);
    const transfer = rows.reduce((s, r) => s + Number(r.transferTotal || 0), 0);
    const unpaid = rows.reduce((s, r) => s + Number(r.unpaidTotal || 0), 0);

    kpiEl.innerHTML = `
      <b>สรุปรวม:</b> ${totalDays} วัน • บิล ${money(totalBills)} • สุทธิ ${money(totalNet)} บาท
      <br/><span class="muted">เงินสด:</span> ${money(cash)} • <span class="muted">โอน:</span> ${money(transfer)} • <span class="muted">ค้างชำระ:</span> ${money(unpaid)}
    `;

    // ตาราง
    listEl.innerHTML = `
      <div style="overflow:auto;">
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
            ${rows.map(r => {
              const amended = r.amendedAt?.toDate ? r.amendedAt.toDate().toLocaleString() : "";
              return `
                <tr>
                  <td style="padding:8px; border-bottom:1px solid #f3f3f3;">${r.businessDate || "-"}</td>
                  <td style="padding:8px; border-bottom:1px solid #f3f3f3;">${r.branchId || "-"}</td>
                  <td style="padding:8px; border-bottom:1px solid #f3f3f3; text-align:right;">${money(r.totalBills)}</td>
                  <td style="padding:8px; border-bottom:1px solid #f3f3f3; text-align:right;"><b>${money(r.totalNet)}</b></td>
                  <td style="padding:8px; border-bottom:1px solid #f3f3f3; text-align:right;">${money(r.cashTotal)}</td>
                  <td style="padding:8px; border-bottom:1px solid #f3f3f3; text-align:right;">${money(r.transferTotal)}</td>
                  <td style="padding:8px; border-bottom:1px solid #f3f3f3; text-align:right;">${money(r.unpaidTotal)}</td>
                  <td style="padding:8px; border-bottom:1px solid #f3f3f3;">${r.closedBy || "-"}</td>
                  <td style="padding:8px; border-bottom:1px solid #f3f3f3;">${r.note || "-"}</td>
                  <td style="padding:8px; border-bottom:1px solid #f3f3f3;">${amended ? `✏️ ${amended}` : "-"}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function toCSV(rows) {
    const header = [
      "businessDate","branchId","totalBills","totalNet","cashTotal","transferTotal","unpaidTotal",
      "closedBy","closedAt","note","amendedAt","amendedBy","amendedReason"
    ];

    const lines = [header.join(",")];

    rows.forEach(r => {
      const closedAt = r.closedAt?.toDate ? ymd(r.closedAt.toDate()) + " " + r.closedAt.toDate().toLocaleTimeString() : "";
      const amendedAt = r.amendedAt?.toDate ? ymd(r.amendedAt.toDate()) + " " + r.amendedAt.toDate().toLocaleTimeString() : "";
      const row = [
        r.businessDate || "",
        (r.branchId || "").replaceAll(",", " "),
        r.totalBills ?? "",
        r.totalNet ?? "",
        r.cashTotal ?? "",
        r.transferTotal ?? "",
        r.unpaidTotal ?? "",
        (r.closedBy || "").replaceAll(",", " "),
        closedAt.replaceAll(",", " "),
        (r.note || "").replaceAll(",", " "),
        amendedAt.replaceAll(",", " "),
        (r.amendedBy || "").replaceAll(",", " "),
        (r.amendedReason || "").replaceAll(",", " ")
      ];
      lines.push(row.join(","));
    });

    return lines.join("\n");
  }

  function downloadCSV(text, filename) {
    const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function loadCloses() {
    listEl.textContent = "กำลังโหลด...";
    amEl.textContent = "กำลังโหลด...";
    kpiEl.textContent = "—";
    lastRows = [];

    const branchId = branchEl.value;
    const fromDate = fromEl.value;
    const toDate = toEl.value;

    // Firestore range on string YYYY-MM-DD ทำได้
    let q = db.collection("daily_closes")
      .where("businessDate", ">=", fromDate)
      .where("businessDate", "<=", toDate);

    // filter สาขา (ใช้ branchKey)
    if (branchId) {
      q = q.where("branchKey", "==", branchKey(branchId));
    }

    // ถ้า orderBy ชนกับ where หลายตัว อาจต้องสร้าง index
    // เราจะใช้ orderBy businessDate เพื่อเรียง
    q = q.orderBy("businessDate", "desc").limit(200);

    try {
      const snap = await q.get();
      const rows = [];
      snap.forEach(doc => rows.push({ id: doc.id, ...doc.data() }));
      lastRows = rows;
      renderRows(rows);
      await loadLatestAmendments(branchId);
    } catch (err) {
      console.error(err);
      listEl.innerHTML = `<div class="muted">❌ โหลดข้อมูลไม่สำเร็จ (อาจต้องสร้าง Index ใน Firestore)</div>`;
      amEl.innerHTML = `<div class="muted">—</div>`;
    }
  }

  async function loadLatestAmendments(branchId) {
    // ดึงจาก group query ไม่ง่ายบน compat แบบนี้
    // วิธีง่าย: แสดง amendment จาก 2 สาขาแบบวนอ่าน daily_closes ที่โหลดมาแล้ว
    // แต่เพื่อให้เร็ว: โหลดเฉพาะ 50 รายการ จาก daily_closes ที่มี amendedAt ล่าสุด (ถ้ามี field นี้)
    try {
      let q = db.collection("daily_closes").where("amendedAt", "!=", null).orderBy("amendedAt", "desc").limit(50);
      if (branchId) q = q.where("branchKey", "==", branchKey(branchId));

      const snap = await q.get();
      const rows = [];
      snap.forEach(doc => rows.push({ id: doc.id, ...doc.data() }));

      if (!rows.length) {
        amEl.innerHTML = `<div class="muted">ยังไม่มีการแก้ไขปิดยอด</div>`;
        return;
      }

      amEl.innerHTML = rows.map(r => {
        const t = r.amendedAt?.toDate ? r.amendedAt.toDate().toLocaleString() : "-";
        return `
          <div class="card" style="margin:8px 0;">
            <b>${r.businessDate}</b> • <b>${r.branchId}</b><br/>
            ✏️ แก้โดย: <b>${r.amendedBy || "-"}</b> • เวลา: <b>${t}</b><br/>
            เหตุผล: <b>${r.amendedReason || "-"}</b>
          </div>
        `;
      }).join("");
    } catch (err) {
      console.error(err);
      amEl.innerHTML = `<div class="muted">❌ โหลดประวัติแก้ไขไม่สำเร็จ (อาจต้องทำ Index)</div>`;
    }
  }

  loadBtn.addEventListener("click", loadCloses);

  exportBtn.addEventListener("click", () => {
    if (!lastRows.length) {
      alert("ยังไม่มีข้อมูลให้ Export");
      return;
    }
    const filename = `cleanmate_daily_closes_${fromEl.value}_to_${toEl.value}${branchEl.value ? "_" + branchEl.value.replace(/\s+/g,"_") : ""}.csv`;
    downloadCSV(toCSV(lastRows), filename);
  });

  // โหลดครั้งแรก
  loadCloses();
});
