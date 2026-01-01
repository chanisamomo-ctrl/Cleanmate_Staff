// js/app.js
console.log("Cleanmate Staff: app.js loaded");

// helper: วันที่รูปแบบ YYYY-MM-DD
function todayYMD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
