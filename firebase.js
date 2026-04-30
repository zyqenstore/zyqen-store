import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBgIB_UesxOrYdyQ-EZvUXJbpN1tLY64Dw",
  authDomain: "zyqenstore-075.firebaseapp.com",
  projectId: "zyqenstore-075",
  storageBucket: "zyqenstore-075.firebasestorage.app",
  messagingSenderId: "938047925617",
  appId: "1:938047925617:web:634a8a94072b0276009ad0"
};

const app = initializeApp(firebaseConfig);

const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };

