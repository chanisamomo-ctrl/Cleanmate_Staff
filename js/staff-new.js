// js/staff-new.js (Firestore compat)
// ✅ ห้ามประกาศ firebase.initializeApp ที่นี่
// ✅ ใช้ db จาก window ที่ set ไว้ใน js/firebase.js เท่านั้น
const db = window.db;

// ===============================
// helper: วันที่รูปแบบ YYYY-MM-DD (ตามเวลาท้องถิ่นเครื่อง)
// ===============================
function todayYMD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toBranchKey(branchId) {
  return String(branchId || "").replace(/\s+/g, "_");
}

function numVal(id, fallback = 0) {
  const v = document.getElementById(id)?.value;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function strVal(id) {
  return (document.getElementById(id)?.value || "").trim();
}

function pickVal(ids, fallback = "") {
  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el) continue;
    const v = String(el.value ?? "").trim();
    if (v !== "") return v;
  }
  return fallback;
}

function setMsg(el, msg, ok = true) {
  if (!el) return;
  el.style.color = ok ? "#0a7a2f" : "#b00020";
  el.textContent = msg;
}

function normalizePaymentMethod(v) {
  const s = String(v || "").toLowerCase();
  if (s.includes("cash") || s.includes("สด")) return "cash";
  if (s.includes("transfer") || s.includes("โอน")) return "transfer";
  return s || "cash";
}

function normalizePaymentStatus(v) {
  const s = String(v || "").toLowerCase();
  if (s.includes("paid") || s.includes("ชำระ")) return "paid";
  if (s.includes("unpaid") || s.includes("ค้าง")) return "unpaid";
  return s || "paid";
}

// ===============================
// main logic: เพิ่มบิล
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  const saveBtn = document.getElementById("saveBtn");
  const resultEl = document.getElementById("result");

  if (!saveBtn) {
    console.error("❌ ไม่พบปุ่มบันทึก (saveBtn)");
    return;
  }
  if (!resultEl) {
    console.error("❌ ไม่พบ element แสดงผล (result)");
  }

  saveBtn.addEventListener("click", async () => {
    try {
      setMsg(resultEl, "กำลังบันทึก...", true);
      saveBtn.disabled = true;

      // -----------------------------
      // ดึงค่าจากฟอร์ม (รองรับหลายชื่อ id เพื่อความเข้ากันได้)
      // -----------------------------
      const branchId = pickVal(["branch", "branchId", "branchSelect"], "");
      if (!branchId) {
        setMsg(resultEl, "กรุณาเลือกสาขาก่อนบันทึก", false);
        saveBtn.disabled = false;
        return;
      }

      // customer info
      const customerName = pickVal(["customerName", "custName", "name"], "");
      const customerPhone = pickVal(["customerPhone", "custPhone", "phone"], "");

      // money
      const grossAmount = numVal("grossAmount", numVal("gross", 0));
      const discountAmount = numVal("discountAmount", numVal("discount", 0));

      // ✅ netAmount = ลูกค้าจ่ายจริงหลังหักส่วนลด
      const netAmount = Math.max(0, grossAmount - discountAmount);

      // counts & types
      const itemCount = numVal("itemCount", numVal("items", 0));
      const serviceType = pickVal(["serviceType", "service"], "dry");

      // payment
      const paymentMethod = normalizePaymentMethod(
        pickVal(["paymentMethod", "payMethod"], "cash")
      );
      const paymentStatus = normalizePaymentStatus(
        pickVal(["paymentStatus", "payStatus"], "paid")
      );

      // optional fields (ถ้ามีในฟอร์ม)
      const note = pickVal(["note", "remark"], "");
      const useCoupon = (pickVal(["useCoupon"], "false") || "false") === "true";
      const couponUsedCount = numVal("couponUsedCount", 0);
      const couponAddedCount = numVal("couponAddedCount", 0);

      // validation ขั้นต่ำ
      if (grossAmount <= 0 && netAmount <= 0) {
        setMsg(resultEl, "กรุณากรอกยอดเงิน (grossAmount) ก่อนบันทึก", false);
        saveBtn.disabled = false;
        return;
      }

      // -----------------------------
      // สร้างเอกสาร transaction
      // -----------------------------
      const docData = {
        // ✅ มาตรฐานเดียวกับ close / dashboard
        branchId,                    // ใช้หลักในการ query
        branchKey: toBranchKey(branchId), // เผื่อโค้ด/ข้อมูลเก่า

        businessDate: todayYMD(),    // มีไว้ดูง่าย (ปิดยอดจริงใช้ createdAt)
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),

        customerName,
        customerPhone,

        serviceType,
        itemCount,

        grossAmount,
        discountAmount,
        netAmount,                   // ✅ ตัวนี้สำคัญ: 450 ต้องอยู่ตรงนี้

        paymentMethod,               // "cash" | "transfer"
        paymentStatus,               // "paid" | "unpaid"

        // coupon fields (optional)
        useCoupon,
        couponUsedCount,
        couponAddedCount,

        // note รายการบิล (ถ้ามี)
        note
      };

      const ref = await db.collection("transactions").add(docData);

      setMsg(resultEl, `บันทึกสำเร็จ ✅ (ID: ${ref.id})`, true);

      // -----------------------------
      // (option) reset form บางช่อง
      // -----------------------------
      // ถ้าอยากรีเซ็ตทั้งหมด ให้คุณเพิ่ม id ของ input ตามต้องการ
      // เช่น document.getElementById("grossAmount").value = "";
      // ที่นี่จะรีเซ็ตยอดและลูกค้าแบบพื้นฐาน
      const resetIds = [
        "customerName","custName","name",
        "customerPhone","custPhone","phone",
        "grossAmount","gross",
        "discountAmount","discount",
        "itemCount","items",
        "note","remark"
      ];
      resetIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
      });

    } catch (e) {
      console.error(e);
      setMsg(resultEl, `บันทึกไม่สำเร็จ: ${e.message}`, false);
    } finally {
      saveBtn.disabled = false;
    }
  });
});
