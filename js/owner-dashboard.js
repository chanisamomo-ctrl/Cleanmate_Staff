// js/owner-dashboard.js
document.addEventListener("DOMContentLoaded", () => {
  const branchEl = document.getElementById("branch");
  const fromEl = document.getElementById("fromDate");
  const toEl = document.getElementById("toDate");

  const loadBtn = document.getElementById("loadBtn");
  const exportBtn = document.getElementById("exportBtn");

  const summaryTopEl = document.getElementById("summaryTop");     // สรุปรวมด้านบน
  const tableBodyEl = document.getElementById("tableBody");       // tbody ของตาราง
  const revisionsEl = document.getElementById("revisions");       // โซนประวัติการแก้ไข

  let lastRows = []; // เก็บไว้ใช้ export

  function money(n) {
    return Number(n || 0).toLocaleString();
  }

  function ymdOrToday(v) {
    // input type="date" จะได้ YYYY-MM-DD อยู่แล้ว
    return (v && String(v).trim()) ? String(v).trim() : todayYMD();
  }

  // ตั้งค่า default ช่วงวัน
  fromEl.value = fromEl.value || todayYMD();
  toEl.value = toEl.value || todayYMD();

  async function loadData() {
    const branchId = branchEl.value; // "ทั้งหมด" หรือ "Chamchuri" ...
    const fromYMD = ymdOrToday(fromEl.value);
    const toYMD = ymdOrToday(toEl.value);

    summaryTopEl.textContent = "กำลังโหลดข้อมูล...";
    tableBodyEl.innerHTML = `<tr><td colspan="9">กำลังโหลด...</td></tr>`;
    revisionsEl.innerHTML = `<div class="muted">กำลังโหลด...</div>`;
    lastRows = [];

    try {
      // -----------------------------
      // 1) Query daily_closes ตามช่วงวัน
      // businessDate เป็น string YYYY-MM-DD -> range แบบ lexicographic ใช้ได้
      // -----------------------------
      let q = db.collection("daily_closes")
        .where("businessDate", ">=", fromYMD)
        .where("businessDate", "<=", toYMD);

      // ถ้าเลือกสาขาเฉพาะ ให้ filter เพิ่ม
      if (branchId && branchId !== "ทั้งหมด") {
        q = q.where("branchId", "==", branchId);
      }

      const snap = await q.get();

      const rows = [];
      let sumBills = 0;
      let sumNet = 0;
      let sumCash = 0;
      let sumTransfer = 0;
      let sumUnpaid = 0;

      snap.forEach((doc) => {
        const d = doc.data();

        // ✅ ชื่อ field ต้องตรงกับที่ staff-close บันทึก
        const totalBills = Number(d.totalBills || 0);
        const totalNet = Number(d.totalNet || 0);
        const cashTotal = Number(d.cashTotal || 0);
        const transferTotal = Number(d.transferTotal || 0);
        const unpaidTotal = Number(d.unpaidTotal || 0);

        sumBills += totalBills;
        sumNet += totalNet;
        sumCash += cashTotal;
        sumTransfer += transferTotal;
        sumUnpaid += unpaidTotal;

        rows.push({
          businessDate: d.businessDate || "",
          branchId: d.branchId || "",
          totalBills,
          totalNet,
          cashTotal,
          transferTotal,
          unpaidTotal,
          closedBy: d.closedBy || "",
          note: d.note || "",
          amendedAt: d.amendedAt?.toDate ? d.amendedAt.toDate().toLocaleString() : ""
        });
      });

      // เรียงวันก่อน แล้วสาขา
      rows.sort((a, b) => {
        const c = String(a.businessDate).localeCompare(String(b.businessDate));
        if (c !== 0) return c;
        return String(a.branchId).localeCompare(String(b.branchId));
      });

      lastRows = rows;

      // render summary
      summaryTopEl.innerHTML = `
        สรุปรวม: <b>${rows.length}</b> วัน/รายการ • บิลรวม: <b>${money(sumBills)}</b> • สุทธิ: <b>${money(sumNet)}</b> บาท<br/>
        เงินสด: <b>${money(sumCash)}</b> • โอน: <b>${money(sumTransfer)}</b> • ค้างชำระ: <b>${money(sumUnpaid)}</b>
      `;

      // render table
      if (!rows.length) {
        tableBodyEl.innerHTML = `<tr><td colspan="9">ไม่พบข้อมูลในช่วงวันที่ที่เลือก</td></tr>`;
      } else {
        tableBodyEl.innerHTML = rows.map(r => `
          <tr>
            <td>${r.businessDate}</td>
            <td>${r.branchId}</td>
            <td>${r.totalBills}</td>
            <td>${money(r.totalNet)}</td>
            <td>${money(r.cashTotal)}</td>
            <td>${money(r.transferTotal)}</td>
            <td>${money(r.unpaidTotal)}</td>
            <td>${r.closedBy || "-"}</td>
            <td>${r.note || "-"}</td>
          </tr>
        `).join("");
      }

      // -----------------------------
      // 2) โหลดประวัติการแก้ไข (ล่าสุด 50)
      // staff-close.js ของคุณบันทึกใน subcollection: daily_closes/{doc}/amendments
      // ดังนั้นต้องใช้ collectionGroup("amendments")
      // -----------------------------
      let aq = db.collectionGroup("amendments").orderBy("amendedAt", "desc").limit(50);

      // ถ้าเลือกสาขาเฉพาะ ให้กรองเพิ่ม (ถ้าฟิลด์มี branchId)
      if (branchId && branchId !== "ทั้งหมด") {
        aq = aq.where("branchId", "==", branchId);
      }
      // กรองตามช่วงวัน (businessDate เป็น string)
      aq = aq.where("businessDate", ">=", fromYMD).where("businessDate", "<=", toYMD);

      const aSnap = await aq.get();

      if (aSnap.empty) {
        revisionsEl.innerHTML = `<div class="muted">ยังไม่มีการแก้ไขปิดยอด</div>`;
      } else {
        const items = [];
        aSnap.forEach(doc => items.push(doc.data()));

        revisionsEl.innerHTML = items.map(x => `
          <div class="card" style="margin:8px 0;">
            <b>${x.businessDate || "-"}</b> • <b>${x.branchId || "-"}</b><br/>
            เหตุผล: <b>${x.reason || "-"}</b><br/>
            ก่อน: สุทธิ ${money(x.before?.totalNet)} | เงินสด ${money(x.before?.cashTotal)} | โอน ${money(x.before?.transferTotal)} | ค้าง ${money(x.before?.unpaidTotal)}<br/>
            หลัง: สุทธิ ${money(x.after?.totalNet)} | เงินสด ${money(x.after?.cashTotal)} | โอน ${money(x.after?.transferTotal)} | ค้าง ${money(x.after?.unpaidTotal)}<br/>
            แก้โดย: ${x.amendedBy || "-"} • เวลา: ${x.amendedAt?.toDate ? x.amendedAt.toDate().toLocaleString() : "-"}
          </div>
        `).join("");
      }

    } catch (err) {
      console.error(err);
      summaryTopEl.textContent = `❌ โหลดข้อมูลไม่สำเร็จ: ${err.message || err}`;
      tableBodyEl.innerHTML = `<tr><td colspan="9">❌ โหลดไม่สำเร็จ</td></tr>`;
      revisionsEl.innerHTML = `<div class="muted">❌ โหลดไม่สำเร็จ</div>`;
    }
  }

  function exportCSV() {
    if (!lastRows.length) return;

    const headers = ["businessDate","branchId","totalBills","totalNet","cashTotal","transferTotal","unpaidTotal","closedBy","note","amendedAt"];
    const lines = [headers.join(",")];

    for (const r of lastRows) {
      const row = [
        r.businessDate,
        r.branchId,
        r.totalBills,
        r.totalNet,
        r.cashTotal,
        r.transferTotal,
        r.unpaidTotal,
        (r.closedBy || "").replaceAll(",", " "),
        (r.note || "").replaceAll(",", " "),
        (r.amendedAt || "").replaceAll(",", " ")
      ];
      lines.push(row.join(","));
    }

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `owner-dashboard_${fromEl.value}_${toEl.value}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  loadBtn.addEventListener("click", loadData);
  exportBtn.addEventListener("click", exportCSV);

  // โหลดครั้งแรก
  loadData();
});
