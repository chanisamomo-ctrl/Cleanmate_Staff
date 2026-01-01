// ===============================
// helper: วันที่รูปแบบ YYYY-MM-DD
// ===============================
function todayYMD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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

  saveBtn.addEventListener("click", async () => {
    try {
      // ดึงค่าจากฟอร์ม
      const data = {
        branchId: document.getElementById("branch").value,
        billNo: document.getElementById("billNo").value.trim(),
        customerName: document.getElementById("customerName").value.trim(),
        customerPhone: document.getElementById("customerPhone").value.trim(),
        serviceType: document.getElementById("serviceType").value,
        itemCount: Number(document.getElementById("itemCount").value || 0),

        useCoupon: document.getElementById("useCoupon").checked,
        couponUsedCount: Number(document.getElementById("couponUsedCount").value || 0),
        couponBookSold: Number(document.getElementById("couponBookSold").value || 0),
        couponKeepPlace: document.getElementById("couponKeepPlace").value || null,

        grossAmount: Number(document.getElementById("grossAmount").value || 0),
        discountAmount: Number(document.getElementById("discountAmount").value || 0),
        netAmount: Number(document.getElementById("netAmount").value || 0),

        paymentStatus: document.getElementById("paymentStatus").value,
        paymentMethod: document.getElementById("paymentMethod").value || null,

        businessDate: todayYMD(),
        createdAt: new Date()
      };

      // ตรวจข้อมูลจำเป็น
      if (!data.billNo || !data.customerPhone) {
        resultEl.textContent = "❌ กรุณากรอกเลขบิล และเบอร์โทร";
        return;
      }

      // ป้องกันกดซ้ำ
      saveBtn.disabled = true;
      resultEl.textContent = "⏳ กำลังบันทึกข้อมูล...";

      // บันทึก Firestore
      await db.collection("transactions").add(data);

      resultEl.textContent = "✅ บันทึกบิลเรียบร้อยแล้ว";
      saveBtn.disabled = false;

      // (ไม่บังคับ) reset บางช่อง
      // document.getElementById("billNo").value = "";
      // document.getElementById("customerName").value = "";
      // document.getElementById("customerPhone").value = "";

    } catch (err) {
      console.error(err);
      resultEl.textContent = "❌ เกิดข้อผิดพลาด กรุณาลองใหม่";
      saveBtn.disabled = false;
    }
  });
});
