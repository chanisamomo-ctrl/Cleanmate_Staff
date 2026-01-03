// js/firebase.js (compat)

const firebaseConfig = {
  apiKey: "AIzaSyDq5PRGiGNIhJN0FnMw4AatI1svEra4lKY",
  authDomain: "cleanmate-staff.firebaseapp.com",
  projectId: "cleanmate-staff",
  storageBucket: "cleanmate-staff.firebasestorage.app",
  messagingSenderId: "509361348896",
  appId: "1:509361348896:web:8a051e970221cd98a87745",
  measurementId: "G-FH4QY1MQ9H"
};

firebase.initializeApp(firebaseConfig);

// ทำให้ทุกไฟล์เรียกใช้ร่วมกันได้
window.db = firebase.firestore();
window.storage = firebase.storage();
