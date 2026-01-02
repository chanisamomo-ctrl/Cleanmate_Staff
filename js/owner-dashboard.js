// js/owner-dashboard.js
document.addEventListener("DOMContentLoaded", () => {
  // ---------- helpers ----------
  const $ = (id) => document.getElementById(id);

  function money(n) {
    return Number(n || 0).toLocaleString();
  }

  function toYMD(input) {
    // รองรับ:
    // 1) YYYY-MM-DD
    // 2) DD/MM/YYYY
    // 3) ว่าง -> todayYMD()
    const s = (input || "").trim();
    if (!s) return todayYMD();

    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

    // DD/MM/YYYY
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) {
      const dd = m[1], mm = m[2], yyyy = m[3];
      return `${yyyy}-${mm}-${dd}`;
    }

    // ถ้า format แปลก -> ใช้ today กันพัง
    return todayYMD();
  }

  function must(el, name) {
    if (!el) throw new Error(`ไม่พบ element id="${name}" (เช็ค owner-dashboard.html)`);
    return el;
  }

  // ---------- elements (ต้องมี id ตามนี้) ----------
  const branchEl = must($("branch"), "branch");
  const fromEl = must($("fromDate"), "fromDate");
  const toEl = must($("toDate"), "toDate");

  const loadBtn = must($("loadBtn"), "loadBtn");
  const exportBtn = must($("exportBtn"), "exportBtn");

  const summaryTopEl = must($("summaryTop"), "summaryTop");
  const tableBodyEl = must($("tableBody"), "tableBody");
  const revisionsEl = must($("revisions"), "revisions");

  let lastRows = [];

  // ตั้งค่า default ถ้าว่าง
  if (!fromEl.value) fromEl.value = todayYMD();
  if (!toEl.value) toEl.value = todayYMD();

  async function loadData() {
    const branchId = branchEl.value;
    const fromYMD = toYMD(fromEl.value);
    const toYMD2 = toYMD(toEl.value);

    summaryTopEl.textContent = "กำลังโหลดข้อมูล...";
    tableBodyEl.innerHTML = `<tr><td colspan="9">กำลังโหลด...</td></tr>`;
    revisionsEl.innerHTML = `<div class="muted">กำลังโหลด...</div>`;
    lastRows = [];

    try {
      // 1) daily_closes
      let q = db.collection("daily_closes")
        .where("businessDate", ">=", fromYMD)
        .where("businessDate", "<=", toYMD2);

      if (branchId && branchId !== "ทั้งหมด") {
        q = q.where("branchId", "==", branchId);
      }

      const snap = await q.get();

      const rows = [];
      let sumBills = 0, sumNet = 0, sumCash = 0, sumTransfer = 0, sumUnpaid = 0;

      snap.forEach((doc) => {
        const d = doc.data();

        // ✅ ชื่อ field ให้ตรงกับ staff-close.js ของคุณ
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
        });
      });

      rows.sort((a, b) => {
        const c = String(a.businessDate).localeCompare(String(b.businessDate));
        if (c !== 0) return c;
        return String(a.branchId).localeCompare(String(b.branchId));
      });

      lastRows = rows;

      summaryTopEl.innerHTML = `
        สรุปรวม: <b>${rows.length}</b> วัน/รายการ • บิลรวม: <b>${money(sumBills)}</b> • สุทธิ: <b>${money(sumNet)}</b> บาท<br/>
        เงินสด: <b>${money(sumCash)}</b> • โอน: <b>${money(sumTransfer)}</b> • ค้างชำระ: <b>${money(sumUnpaid)}</b>
      `;

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

      // 2) amendments (ประวัติแก้ไข) — subcollection: daily_closes/{doc}/amendments
      let aq = db.collectionGroup("amendments")
        .where("businessDate", ">=", fromYMD)
        .where("businessDate", "<=", toYMD2)
        .orderBy("businessDate")
        .orderBy("amendedAt", "desc")
        .limit(50);

      if (branchId && branchId !== "ทั้งหมด") {
        aq = aq.where("branchId", "==", branchId);
      }

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
      console.error("Owner Dashboard load error:", err);

      // ถ้าเป็นเรื่อง Index จะเห็นข้อความนี้
      const msg = err?.message || String(err);
      summaryTopEl.textContent = `❌ โหลดไม่สำเร็จ: ${msg}`;
      tableBodyEl.innerHTML = `<tr><td colspan="9">❌ โหลดไม่สำเร็จ</td></tr>`;
      revisionsEl.innerHTML = `<div class="muted">❌ โหลดไม่สำเร็จ</div>`;
    }
  }

  function exportCSV() {
    if (!lastRows.length) return;

    const headers = ["businessDate","branchId","totalBills","totalNet","cashTotal","transferTotal","unpaidTotal","closedBy","note"];
    const lines = [headers.join(",")];

    for (const r of lastRows) {
      lines.push([
        r.businessDate,
        r.branchId,
        r.totalBills,
        r.totalNet,
        r.cashTotal,
        r.transferTotal,
        r.unpaidTotal,
        (r.closedBy || "").replaceAll(",", " "),
        (r.note || "").replaceAll(",", " ")
      ].join(","));
    }

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `owner-dashboard_${toYMD(fromEl.value)}_${toYMD(toEl.value)}.csv`;
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
