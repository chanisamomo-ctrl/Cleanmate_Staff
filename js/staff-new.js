// js/staff-new.js
function todayYMD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("saveBtn");
  const result = document.getElementById("result");

  btn.addEventListener("click", async () => {
    try {
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

      if (!data.billNo || !data.customerPhone) {
        result.textContent = "❌ กรุณากรอกเลขบิลและเบอร์โทร";
        return;
      }

      btn.disabled = true;
      result.textContent = "กำลังบันทึก...";

      await db.collection("transactions").add(data);

      result.textContent = "✅ บันทึกเรียบร้อยแล้ว";
      btn.disabled = false;

      // (ไม่บังคับ) เคลียร์บางช่อง
      // document.getElementById("billNo").value = "";
    } catch (err) {
      console.error(err);
      result.textContent = "❌ เกิดข้อผิดพลาด กรุณาลองใหม่";
      btn.disabled = false;
    }
  });
});
