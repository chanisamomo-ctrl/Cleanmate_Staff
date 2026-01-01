const firebaseConfig = {
  apiKey: "AIzaSyDq5PRGiGNIhJN0FnMw4AatI1svEra4lKY",
  authDomain: "cleanmate-staff.firebaseapp.com",
  projectId: "cleanmate-staff",
  storageBucket: "cleanmate-staff.firebasestorage.app",
  messagingSenderId: "509361348896",
  appId: "1:509361348896:web:8a051e970221cd98a87745",
  measurementId: "G-FH4QY1MQ9H"
};
// เริ่มต้น Firebase
firebase.initializeApp(firebaseConfig);

// เปิดใช้งานบริการที่เราจะใช้
const db = firebase.firestore();
const storage = firebase.storage();
