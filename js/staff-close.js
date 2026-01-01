// js/staff-close.js
// - Summary & list computed from: transactions where businessDate == today AND branchId == selected
// - Close doc id: <branchKey>__<YYYY-MM-DD>

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

  function escapeHtml(s) {
    return String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function renderList(items) {
    if (!items.length) {
      txListEl.innerHTML = `<div class="muted">ยังไม่มีรายการของวันนี้</div>`;
      return;
    }

    txListEl.innerHTML = items.map((x) => {
      const status = x.paymentStatus === "paid" ? "ชำระแล้ว"
        : (x.paymentStatus === "unpaid" ? "ค้างชำระ" : "ยกเลิก");
      const method = x.paymentMethod === "cash" ? "เงินสด"
        : (x.paymentMethod === "transfer" ? "เงินโอน" : "-");
      const service = x.serviceType === "dry" ? "ซักแห้ง"
        : (x.serviceType === "wash" ? "ซักน้ำ" : "-");

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

    summaryEl.textContent = "กำลังโหลด...";
    txListEl.textContent = "กำลังโหลดรายการ...";
    resultEl.textContent = "";

    const branchId = branchEl.value;
    const branchKey = toBranchKey(branchId);
    const closeId = closeDocId(branchKey, businessDate);

    // 1) เช็คว่า “ปิดยอดแล้วหรือยัง”
    unsubscribeCloseDoc = db.collection("daily_closes").doc(closeId).onSnapshot((doc) => {
      if (doc.exists) {
        const d = doc.data();
        summaryEl.innerHTML =
          `✅ <b>ปิดยอดแล้ว</b><br/>
           สาขา: <b>${d.branchId || "-"}</b> • วันที่: <b>${d.businessDate || businessDate}</b><br/>
           บิล: <b>${Number(d.totalBills || 0).toLocaleString()}</b> • สุทธิรวม: <b>${Number(d.totalNet || 0).toLocaleString()}</b> บาท<br/>
           เงินสด: <b>${Number(d.cashTotal || 0).toLocaleString()}</b> • โอน:
