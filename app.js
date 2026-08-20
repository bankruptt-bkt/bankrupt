import { db, auth, provider } from "./firebase-config.js";
import { onAuthStateChanged, signInWithPopup } from "https://www.gstatic.com/firebasejs/9.x.x/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/9.x.x/firebase-firestore.js";

// Multipliers & Base Rewards
const STREAK_MULTIPLIERS = { 1: 1.0, 2: 1.1, 3: 1.2, 4: 1.3, 5: 1.4, 6: 1.5, 7: 2.0 };
const BASE_REWARD = 2.5; // Base BKT earned per check-in

// UI Elements
const balanceDisplay = document.querySelector(".balance-val");
const usernameDisplay = document.querySelector(".username");
const claimBtn = document.querySelector(".btn-claim");
const timerBadge = document.querySelector(".timer-badge");
const streakText = document.querySelector(".streak-header h3");

// Global State Variables
let currentUser = null;
let userStreak = 1;
let lastCheckIn = null;

// Rank Upgrade Checker Function
async function checkRankUpgrade(userId, currentBalance) {
  let newRank = "rookie";

  if (currentBalance >= 10000) newRank = "bankruptking";
  else if (currentBalance >= 5000) newRank = "tycoon";
  else if (currentBalance >= 2000) newRank = "degenerate";
  else if (currentBalance >= 1000) newRank = "hustler";
  else if (currentBalance >= 200) newRank = "grinder";

  try {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
      rank: newRank
    });
  } catch (err) {
    console.error("Failed to update rank:", err);
  }
}

// 1. Auth Listener
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    if (usernameDisplay) usernameDisplay.textContent = `@${user.displayName || "Anonymous"}`;
    await initializeUserData(user);
  } else {
    signInWithPopup(auth, provider).catch(err => console.error("Auth Error:", err));
  }
});

// 2. Fetch User Data & Handle Timers
async function initializeUserData(user) {
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

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
  } else {
    const data = userSnap.data();
    userStreak = data.streak || 1;
    lastCheckIn = data.lastCheckIn ? data.lastCheckIn.toDate() : null;
    if (balanceDisplay) balanceDisplay.textContent = `${(data.balance || 0).toFixed(4)} BKT`;
  }

  updateStreakDisplay();
  checkClaimStatus();
}

// 3. UI Display Update
function updateStreakDisplay() {
  if (streakText) {
    streakText.textContent = `DAY ${userStreak} STREAK`;
  }
}

// 4. Timer Logic & Claim Availability
function checkClaimStatus() {
  if (!lastCheckIn) {
    enableClaimButton();
    return;
  }

  const now = new Date();
  const hoursPassed = (now - lastCheckIn) / (1000 * 60 * 60);

  if (hoursPassed >= 24) {
    // Reset streak if missed for over 48 hours
    if (hoursPassed >= 48) userStreak = 1; 
    enableClaimButton();
  } else {
    disableClaimButton(24 - hoursPassed);
  }
}

function enableClaimButton() {
  if (claimBtn) {
    claimBtn.disabled = false;
    claimBtn.textContent = "CHECK IN & CLAIM";
    claimBtn.style.background = "var(--accent-green)";
    claimBtn.style.color = "#000";
    claimBtn.style.cursor = "pointer";
  }
  if (timerBadge) timerBadge.textContent = "Ready to claim!";
}

function disableClaimButton(hoursLeft) {
  if (claimBtn) {
    claimBtn.disabled = true;
    claimBtn.textContent = "CHECKED IN";
    claimBtn.style.background = "#1d2a20";
    claimBtn.style.color = "#556655";
    claimBtn.style.cursor = "not-allowed";
  }
  
  if (timerBadge) {
    const h = Math.floor(hoursLeft);
    const m = Math.floor((hoursLeft - h) * 60);
    timerBadge.textContent = `${h}h ${m}m remaining`;
  }
}

// 5. Claim Action Event
if (claimBtn) {
  claimBtn.addEventListener("click", async () => {
    if (!currentUser || claimBtn.disabled) return;

    const multiplier = STREAK_MULTIPLIERS[Math.min(userStreak, 7)] || 1.0;
    const reward = BASE_REWARD * multiplier;
    
    const userRef = doc(db, "users", currentUser.uid);

    try {
      await updateDoc(userRef, {
        balance: increment(reward),
        streak: increment(1),
        lastCheckIn: new Date()
      });

      userStreak += 1;
      lastCheckIn = new Date();
      
      const currentVal = parseFloat(balanceDisplay?.textContent) || 0;
      const updatedBalance = currentVal + reward;

      if (balanceDisplay) balanceDisplay.textContent = `${updatedBalance.toFixed(4)} BKT`;

      // Check and update user rank based on new balance
      await checkRankUpgrade(currentUser.uid, updatedBalance);

      updateStreakDisplay();
      disableClaimButton(24);
    } catch (err) {
      console.error("Failed to claim reward:", err);
    }
  });
}
