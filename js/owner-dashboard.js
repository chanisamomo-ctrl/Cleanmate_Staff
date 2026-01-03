// js/owner-dashboard.js (Firestore compat)
(() => {
  // ---------- Safe helpers (ไม่พึ่ง app.js) ----------
  function todayYMD() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function money(v) {
    const n = Number(v || 0);
    return n.toLocaleString("th-TH", { maximumFractionDigits: 0 });
  }

  // ---------- DOM ----------
  document.addEventListener("DOMContentLoaded", () => {
    const branchEl = document.getElementById("branch");
    const fromEl = document.getElementById("fromDate");
    const toEl = document.getElementById("toDate");
    const loadBtn = document.getElementById("loadBtn");
    const exportBtn = document.getElementById("exportBtn");

    const kpiEl = document.getElementById("kpi");
    const listEl = document.getElementById("list");
    const amendmentsEl = document.getElementById("amendments");

    // ---------- Guard: db must exist ----------
    const db = window.db;
    if (!db) {
      // ถ้า db ไม่มี ให้โชว์ error บนหน้าเลย (ไม่ค้างเงียบ)
      if (listEl) listEl.innerHTML = `<div class="small" style="color:#b00020;">❌ ไม่พบ window.db — ตรวจสอบว่าโหลด js/firebase.js ก่อน js/owner-dashboard.js และทำ Hard refresh</div>`;
      if (kpiEl) kpiEl.textContent = "—";
      if (amendmentsEl) amendmentsEl.innerHTML = `<div class="small" style="color:#b00020;">❌ ไม่พบ window.db</div>`;
      return;
    }

    let lastRows = [];

    function setDefaultDates() {
      const t = todayYMD();
      if (!fromEl.value) fromEl.value = t;
      if (!toEl.value) toEl.value = t;
    }

    function renderDailyCloseRows(rows) {
      if (!rows.length) {
        kpiEl.textContent = "—";
        listEl.innerHTML = `<div class="small muted">ไม่พบข้อมูล</div>`;
        return;
      }

      const sumBills = rows.reduce((a, r) => a + Number(r.totalBills || 0), 0);
      const sumNet = rows.reduce((a, r) => a + Number(r.totalNet || 0), 0);
      const sumCash = rows.reduce((a, r) => a + Number(r.cashTotal || 0), 0);
      const sumTransfer = rows.reduce((a, r) => a + Number(r.transferTotal || 0), 0);
      const sumUnpaid = rows.reduce((a, r) => a + Number(r.unpaidTotal || 0), 0);

      kpiEl.innerHTML =
        `รวม ${rows.length} วัน • บิล ${money(sumBills)} • Net ${money(sumNet)} • Cash ${money(sumCash)} • Transfer ${money(sumTransfer)} • Unpaid ${money(sumUnpaid)}`;

      listEl.innerHTML = `
        <div style="overflow:auto;">
          <table class="table">
            <thead>
              <tr>
                <th>วันที่</th>
                <th>สาขา</th>
                <th style="text-align:right;">บิล</th>
                <th style="text-align:right;">Net</th>
                <th style="text-align:right;">Cash</th>
                <th style="text-align:right;">Transfer</th>
                <th style="text-align:right;">Unpaid</th>
                <th>Note</th>
                <th>Closed By</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(r => `
                <tr>
                  <td>${esc(r.businessDate || "-")}</td>
                  <td>${esc(r.branchId || r.branchKey || "-")}</td>
                  <td style="text-align:right;">${money(r.totalBills)}</td>
                  <td style="text-align:right;">${money(r.totalNet)}</td>
                  <td style="text-align:right;">${money(r.cashTotal)}</td>
                  <td style="text-align:right;">${money(r.transferTotal)}</td>
                  <td style="text-align:right;">${money(r.unpaidTotal)}</td>
                  <td>${esc(r.note || "")}</td>
                  <td>${esc(r.closedBy || "")}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    }

    async function loadDailyCloses() {
      listEl.textContent = "กำลังโหลด...";
      kpiEl.textContent = "—";

      const branch = branchEl.value; // "" = ทั้งหมด
      const fromDate = fromEl.value;
      const toDate = toEl.value;

      if (!fromDate || !toDate) {
        listEl.innerHTML = `<div class="small muted">กรุณาเลือกช่วงวันที่</div>`;
        return;
      }

      try {
        let q = db.collection("daily_closes")
          .where("businessDate", ">=", fromDate)
          .where("businessDate", "<=", toDate);

        // ✅ รองรับทั้ง branchId และ branchKey (ข้อมูลเก่า)
        if (branch) {
          // Firestore OR ไม่ได้ง่าย ๆ → ใช้ 2 query แล้ว merge
          const q1 = q.where("branchId", "==", branch).orderBy("businessDate", "asc").get();
          const q2 = q.where("branchKey", "==", branch).orderBy("businessDate", "asc").get();

          const [s1, s2] = await Promise.all([q1, q2]);
          const map = new Map();
          s1.docs.forEach(d => map.set(d.id, { id: d.id, ...d.data() }));
          s2.docs.forEach(d => map.set(d.id, { id: d.id, ...d.data() }));
          const rows = Array.from(map.values()).sort((a, b) => String(a.businessDate).localeCompare(String(b.businessDate)));

          lastRows = rows;
          renderDailyCloseRows(rows);
          return;
        }

        // กรณีทั้งหมด
        q = q.orderBy("businessDate", "asc");
        const snap = await q.get();
        const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        lastRows = rows;
        renderDailyCloseRows(rows);
      } catch (e) {
        console.error(e);
        listEl.innerHTML = `<div class="small" style="color:#b00020;">โหลดข้อมูลไม่สำเร็จ: ${esc(e.message)}</div>`;
      }
    }

    async function loadAmendments() {
      amendmentsEl.textContent = "กำลังโหลด...";
      try {
        const snap = await db.collectionGroup("amendments")
          .orderBy("amendedAt", "desc")
          .limit(50)
          .get();

        const rows = snap.docs.map(d => d.data());
        if (!rows.length) {
          amendmentsEl.textContent = "ไม่พบประวัติการแก้ไข";
          return;
        }

        amendmentsEl.innerHTML = rows.map(r => {
          const when = r.amendedAt?.toDate ? r.amendedAt.toDate().toLocaleString("th-TH") : "-";
          return `• ${esc(when)} — ${esc(r.branchId || "-")} ${esc(r.businessDate || "-")} — ${esc(r.reason || "-")}`;
        }).join("<br/>");
      } catch (e) {
        console.error(e);
        amendmentsEl.innerHTML = `<span style="color:#b00020;">โหลดประวัติการแก้ไขไม่สำเร็จ: ${esc(e.message)}</span>`;
      }
    }

    function exportCSV() {
      if (!lastRows.length) return;

      const headers = ["businessDate","branchId","branchKey","totalBills","totalNet","cashTotal","transferTotal","unpaidTotal","note","closedBy"];
      const lines = [
        headers.join(","),
        ...lastRows.map(r => headers.map(h => {
          const v = r[h] ?? "";
          const s = String(v).replace(/"/g, '""');
          return `"${s}"`;
        }).join(","))
      ];

      const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `daily_closes_${fromEl.value}_${toEl.value}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }

    // ---------- Start ----------
    setDefaultDates();
    loadDailyCloses();
    loadAmendments();

    loadBtn.addEventListener("click", () => {
      loadDailyCloses();
      loadAmendments();
    });

    exportBtn.addEventListener("click", exportCSV);
  });
})();
