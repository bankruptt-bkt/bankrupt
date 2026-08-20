import { db, auth, provider } from "./firebase-config.js";
import { onAuthStateChanged, signInWithPopup } from "https://www.gstatic.com/firebasejs/9.x.x/firebase-auth.js";
import { doc, setDoc, updateDoc, increment, onSnapshot } from "https://www.gstatic.com/firebasejs/9.x.x/firebase-firestore.js";

// Multipliers & Base Rewards Formula
const STREAK_MULTIPLIERS = { 1: 1.0, 2: 1.1, 3: 1.2, 4: 1.3, 5: 1.4, 6: 1.5, 7: 2.0 };
const BASE_REWARD = 2.5; // Base BKT earned per check-in

// UI Elements
const balanceDisplay = document.querySelector(".balance-val");
const usernameDisplay = document.querySelector(".username");
const claimBtns = document.querySelectorAll(".btn-claim, #claim-streak-btn");
const timerBadge = document.querySelector(".timer-badge");
const streakText = document.querySelector(".streak-header h3");
const nextRewardText = document.querySelector(".streak-footer b");

// Global State Variables
let currentUser = null;
let userStreak = 1;
let lastCheckIn = null;
let timerInterval = null;
let unsubscribeUser = null;

// Rank Upgrade Evaluator Function
async function checkRankUpgrade(userId, currentBalance) {
  let newRank = "rookie";

  if (currentBalance >= 10000) newRank = "bankruptking";
  else if (currentBalance >= 5000) newRank = "tycoon";
  else if (currentBalance >= 2000) newRank = "degenerate";
  else if (currentBalance >= 1000) newRank = "hustler";
  else if (currentBalance >= 200) newRank = "grinder";

  try {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, { rank: newRank });
  } catch (err) {
    console.error("Failed to update rank:", err);
  }
}

// 1. Auth Listener
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    if (usernameDisplay) usernameDisplay.textContent = user.displayName || "Degen";
    listenToUserData(user);
  } else {
    signInWithPopup(auth, provider).catch(err => console.error("Auth Error:", err));
  }
});

// 2. Real-time Firestore Listener
function listenToUserData(user) {
  const userRef = doc(db, "users", user.uid);

  if (unsubscribeUser) unsubscribeUser();

  unsubscribeUser = onSnapshot(userRef, async (userSnap) => {
    if (!userSnap.exists()) {
      const newData = {
        username: user.displayName || "Anonymous",
        email: user.email,
        balance: 0,
        streak: 1,
        rank: "rookie",
        lastCheckIn: null
      };
      await setDoc(userRef, newData);
      userStreak = 1;
      lastCheckIn = null;
      updateUI(0);
    } else {
      const data = userSnap.data();
      userStreak = data.streak || 1;
      lastCheckIn = data.lastCheckIn ? data.lastCheckIn.toDate() : null;
      
      const currentBalance = data.balance || 0;
      updateUI(currentBalance);
      checkClaimStatus();
    }
  });
}

// 3. UI Realtime Updates
function updateUI(balance) {
  if (balanceDisplay) {
    balanceDisplay.innerHTML = `${Number(balance).toFixed(4)} <span class="brand-font">BKT</span>`;
  }

  if (streakText) {
    streakText.textContent = `DAY ${userStreak} STREAK`;
  }

  const currentMultiplier = STREAK_MULTIPLIERS[Math.min(userStreak, 7)] || 1.0;
  const nextReward = BASE_REWARD * currentMultiplier;

  if (nextRewardText) {
    nextRewardText.textContent = `+${nextReward.toFixed(2)} BKT`;
  }

  // Highlight active streak days on home screen UI
  const streakBoxes = document.querySelectorAll(".streak-days .day-box");
  streakBoxes.forEach((box, index) => {
    if (index + 1 <= userStreak) {
      box.classList.add("active");
      box.innerHTML = box.innerHTML.replace("🔒", "✅");
    }
  });
}

// 4. Live Countdown & Claim Status Evaluator
function checkClaimStatus() {
  if (timerInterval) clearInterval(timerInterval);

  if (!lastCheckIn) {
    enableClaimButton();
    return;
  }

  updateLiveTimer();
  timerInterval = setInterval(updateLiveTimer, 1000);
}

function updateLiveTimer() {
  const now = new Date();
  const nextCheckInTime = new Date(lastCheckIn.getTime() + 24 * 60 * 60 * 1000);
  const timeRemaining = nextCheckInTime - now;

  if (timeRemaining <= 0) {
    clearInterval(timerInterval);
    const hoursPassed = (now - lastCheckIn) / (1000 * 60 * 60);
    if (hoursPassed >= 48) userStreak = 1; // Reset streak after missing 48 hrs
    enableClaimButton();
  } else {
    disableClaimButton(timeRemaining);
  }
}

function enableClaimButton() {
  claimBtns.forEach(btn => {
    btn.disabled = false;
    btn.textContent = "CHECK IN & CLAIM";
    btn.style.background = "var(--accent-green, #00ff88)";
    btn.style.color = "#000";
    btn.style.cursor = "pointer";
  });

  if (timerBadge) timerBadge.textContent = "⚡ Ready to claim!";
}

function disableClaimButton(msLeft) {
  claimBtns.forEach(btn => {
    btn.disabled = true;
    btn.textContent = "CHECKED IN";
    btn.style.background = "#1d2a20";
    btn.style.color = "#556655";
    btn.style.cursor = "not-allowed";
  });

  if (timerBadge) {
    const totalSeconds = Math.floor(msLeft / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;

    const pad = (num) => String(num).padStart(2, '0');
    timerBadge.textContent = `⏳ ${pad(h)}h ${pad(m)}m ${pad(s)}s`;
  }
}

// 5. Check-In & Claim Handler
claimBtns.forEach(btn => {
  btn.addEventListener("click", async () => {
    if (!currentUser || btn.disabled) return;

    const multiplier = STREAK_MULTIPLIERS[Math.min(userStreak, 7)] || 1.0;
    const reward = BASE_REWARD * multiplier;
    const userRef = doc(db, "users", currentUser.uid);

    try {
      btn.disabled = true;
      btn.textContent = "CLAIMING...";

      const nextStreak = userStreak + 1;

      await updateDoc(userRef, {
        balance: increment(reward),
        streak: nextStreak,
        lastCheckIn: new Date()
      });

      // Calculate total for rank progression checking
      const updatedBalance = (parseFloat(balanceDisplay?.textContent) || 0) + reward;
      await checkRankUpgrade(currentUser.uid, updatedBalance);

    } catch (err) {
      console.error("Failed to claim reward:", err);
      btn.disabled = false;
    }
  });
});
