// 1. Firebase Credentials
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();

// 2. Tokenomics & Local Engine Variables
const HASHRATE_PER_SEC = 0.0001; // Base continuous rate
let nextClaimTime = Date.now() + (11 * 3600000) + (1 * 60000) + (40 * 1000); // Demo 11h 1m 40s countdown

let userState = {
  balance: 82.3725,
  streak: 1,
  lastUpdate: Date.now()
};

// 3. Mathematical Mining Loop
function tickMining() {
  const now = Date.now();
  const elapsedSeconds = (now - userState.lastUpdate) / 1000;
  
  userState.balance += elapsedSeconds * HASHRATE_PER_SEC;
  userState.lastUpdate = now;

  // Render to UI
  document.getElementById('balance-display').innerText = userState.balance.toFixed(4);
  document.getElementById('stat-balance').innerText = userState.balance.toFixed(2);

  // Update Countdown
  updateCountdown();
}

function updateCountdown() {
  const now = Date.now();
  const diff = nextClaimTime - now;

  if (diff <= 0) {
    document.getElementById('countdown-badge').innerHTML = ` Ready`;
    const btn = document.getElementById('claim-btn');
    btn.innerText = "CHECK IN + CLAIM";
    btn.className = "w-full py-3 bg-[#00ff66] text-black font-marker text-lg rounded-xl shadow-lg";
    return;
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const secs = Math.floor((diff % (1000 * 60)) / 1000);

  document.getElementById('countdown-badge').innerHTML = `<i class="fa-regular fa-clock"></i> ${hours}h ${mins}m ${secs}s`;
}

// Tick execution every 100 milliseconds
setInterval(tickMining, 100);

// 4. Firebase Persistence
auth.signInAnonymously().then(cred => {
  if (!cred.user) return;
  const userRef = db.ref('users/' + cred.user.uid);

  userRef.on('value', snapshot => {
    const data = snapshot.val();
    if (data) {
      userState = data;
    } else {
      userRef.set(userState);
    }
  });
});
