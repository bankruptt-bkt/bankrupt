// Instant Direct UI Script
const CHECKIN_INTERVAL_MS = 24 * 60 * 60 * 1000;
let currentUser = null;
let userData = { balance: 50.00, streakDays: 0, lastCheckIn: 0 };

// 1. Force Immediate UI Render on Load
document.addEventListener("DOMContentLoaded", () => {
  renderButtonState();
});

function renderButtonState() {
  const claimBtn = document.getElementById('claim-btn');
  const nameDisplay = document.getElementById('user-display-name');
  
  if (nameDisplay && nameDisplay.innerText === "Loading...") {
    nameDisplay.innerText = "Miner_Guest";
  }

  if (claimBtn) {
    const now = Date.now();
    const nextAvailable = (userData.lastCheckIn || 0) + CHECKIN_INTERVAL_MS;

    if (now >= nextAvailable) {
      claimBtn.innerText = "CHECK IN + CLAIM";
      claimBtn.disabled = false;
      claimBtn.onclick = handleClaim;
      claimBtn.className = "w-full py-3 bg-[#00ff66] text-black font-marker text-lg rounded-xl border border-[#00ff66] shadow-lg shadow-[#00ff66]/30 cursor-pointer hover:bg-[#00e65c] transition-all";
    } else {
      claimBtn.innerText = "CHECKED IN";
      claimBtn.disabled = true;
      claimBtn.className = "w-full py-3 bg-[#1e2721] text-gray-400 font-marker text-lg rounded-xl border border-[#2a382f] cursor-not-allowed";
    }
  }
}

async function handleClaim() {
  const claimBtn = document.getElementById('claim-btn');
  if (claimBtn) {
    claimBtn.innerText = "CLAIMING...";
    claimBtn.disabled = true;
  }

  userData.balance += 5.0;
  userData.streakDays += 1;
  userData.lastCheckIn = Date.now();

  // Update UI instantly
  const balanceEl = document.getElementById('balance-display');
  if (balanceEl) balanceEl.innerText = userData.balance.toFixed(4);

  renderButtonState();

  // Sync to Firebase silently if connected
  if (currentUser && typeof db !== 'undefined') {
    try {
      await db.ref('users/' + currentUser.uid).update(userData);
    } catch (e) {
      console.log("Database sync skipped:", e.message);
    }
  }
}

// 2. Non-blocking Auth Handler
if (typeof auth !== 'undefined') {
  auth.onAuthStateChanged((user) => {
    if (user) {
      currentUser = user;
      const nameDisplay = document.getElementById('user-display-name');
      if (nameDisplay) nameDisplay.innerText = user.displayName || ("Miner_" + user.uid.substring(0, 5));
    } else {
      auth.signInAnonymously().catch(err => console.log("Auth skipped:", err.message));
    }
  });
}
