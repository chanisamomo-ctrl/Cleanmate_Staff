// js/staff-new.js

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
    console.error(
