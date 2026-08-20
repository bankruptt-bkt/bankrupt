// Initialize Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBQT7gM7JxE26bFq061VvZauWkEGjyHPWM",
  authDomain: "bankrupt-9068b.firebaseapp.com",
  databaseURL: "https://bankrupt-9068b-default-rtdb.firebaseio.com",
  projectId: "bankrupt-9068b",
  storageBucket: "bankrupt-9068b.firebasestorage.app",
  messagingSenderId: "961644576786",
  appId: "1:961644576786:web:65eff34df07a18067458cb"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const db = firebase.database();
const auth = firebase.auth();

// Global System Parameters (50% of 1 Billion = 500 Million BKT for 2 Years)
const TOTAL_MINING_POOL = 500000000;
const CHECKIN_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 Hours
const BASE_REWARD_INITIAL = 5.0; // Starting daily reward rate

let currentUser = null;
let countdownTimer = null;

// Dynamic Base Rate Calculator (Scales down as global users increase)
function calculateBaseReward(totalUsers) {
  if (totalUsers <= 1000) return BASE_REWARD_INITIAL;
  if (totalUsers <= 10000) return BASE_REWARD_INITIAL * 0.75;
  if (totalUsers <= 100000) return BASE_REWARD_INITIAL * 0.5;
  if (totalUsers <= 1000000) return BASE_REWARD_INITIAL * 0.25;
  return BASE_REWARD_INITIAL * 0.1; // Scales down smoothly for millions
}

// Multiplier mapping up to Day 7
function getStreakMultiplier(streakDays) {
  const multipliers = { 1: 1.0, 2: 1.1, 3: 1.2, 4: 1.3, 5: 1.4, 6: 1.5, 7: 1.6 };
  return streakDays >= 7 ? 1.6 : (multipliers[streakDays] || 1.0);
}

// Authentication Listener
auth.onAuthStateChanged(async (user) => {
  if (user) {
    currentUser = user;
    initUserData(user);
    listenToGlobalStats();
    listenToTasks();
  } else {
    // Fallback/Demo anonymous sign-in for previewing
    auth.signInAnonymously().catch(console.error);
  }
});

// Initialize or fetch user document
function initUserData(user) {
  const userRef = db.ref('users/' + user.uid);
  
  userRef.on('value', (snapshot) => {
    let data = snapshot.val();
    
    if (!data) {
      // Create new user profile with default 10 invite limit
      data = {
        uid: user.uid,
        name: user.displayName || 'Miner ' + user.uid.substring(0, 5),
        balance: 0.0000,
        streakDays: 0,
        lastCheckIn: 0,
        referralCount: 0,
        maxInvites: 10, // Default limit (override manually in DB if needed)
        createdAt: firebase.database.ServerValue.TIMESTAMP
      };
      userRef.set(data);
      db.ref('global/totalUsers').transaction(current => (current || 0) + 1);
    }
    
    updateUI(data);
  });
}

// UI Update Controller
function updateUI(userData) {
  // Update Balance
  const balanceEl = document.getElementById('balance-display');
  if (balanceEl) balanceEl.innerText = (userData.balance || 0).toFixed(4);

  // Update Streak Header
  const streakTitle = document.getElementById('streak-title');
  if (streakTitle) {
    streakTitle.innerText = userData.streakDays > 0 ? `DAY ${userData.streakDays} STREAK` : 'START STREAK';
  }

  // Handle Check-in Timer & Button State
  const now = Date.now();
  const nextAvailableTime = (userData.lastCheckIn || 0) + CHECKIN_INTERVAL_MS;
  const claimBtn = document.getElementById('claim-btn');

  if (now >= nextAvailableTime) {
    // Ready to Claim
    if (claimBtn) {
      claimBtn.innerText = "CHECK IN & CLAIM";
      claimBtn.disabled = false;
      claimBtn.className = "w-full py-3 bg-[#00ff66] text-black font-marker text-lg rounded-xl border border-[#00ff66] shadow-lg shadow-[#00ff66]/20 cursor-pointer transition-all";
      claimBtn.onclick = () => performCheckIn(userData);
    }
    setTimerDisplay("Ready");
  } else {
    // Locked / Counting Down
    if (claimBtn) {
      claimBtn.innerText = "CHECKED IN";
      claimBtn.disabled = true;
      claimBtn.className = "w-full py-3 bg-[#1e2721] text-gray-400 font-marker text-lg rounded-xl border border-[#2a382f]";
    }
    startCountdown(nextAvailableTime);
  }
}

// Perform Check-in Logic
async function performCheckIn(userData) {
  const now = Date.now();
  const globalSnap = await db.ref('global/totalUsers').once('value');
  const totalUsers = globalSnap.val() || 1;

  // Check if streak was broken (missed more than 48h)
  let newStreak = userData.streakDays || 0;
  if (now - userData.lastCheckIn > CHECKIN_INTERVAL_MS * 2) {
    newStreak = 1; // Reset streak
  } else {
    newStreak += 1; // Advance streak
  }

  const baseRate = calculateBaseReward(totalUsers);
  const multiplier = getStreakMultiplier(newStreak);
  const earned = baseRate * multiplier;

  // Update user state in Firebase
  db.ref('users/' + userData.uid).update({
    balance: (userData.balance || 0) + earned,
    streakDays: newStreak,
    lastCheckIn: now
  });
}

// Countdown Timer Handler
function startCountdown(targetTime) {
  if (countdownTimer) clearInterval(countdownTimer);

  function tick() {
    const remaining = targetTime - Date.now();
    if (remaining <= 0) {
      clearInterval(countdownTimer);
      if (currentUser) initUserData(currentUser);
      return;
    }
    
    const h = Math.floor(remaining / (1000 * 60 * 60));
    const m = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((remaining % (1000 * 60)) / 1000);

    setTimerDisplay(`${h}h ${m}m ${s}s`);
  }

  tick();
  countdownTimer = setInterval(tick, 1000);
}

function setTimerDisplay(text) {
  const badge = document.getElementById('countdown-badge');
  if (badge) {
    badge.innerHTML = `<i class="fa-regular fa-clock"></i> ${text}`;
  }
}

// Quick Hub Dynamic Task Listener
function listenToTasks() {
  db.ref('tasks').on('value', (snapshot) => {
    const tasks = snapshot.val();
    const taskStatusEl = document.querySelector('.card-inner p.text-xs.text-\\[\\#00ff66\\]');
    
    if (tasks) {
      const activeCount = Object.keys(tasks).length;
      if (taskStatusEl) taskStatusEl.innerText = `${activeCount} New Tasks Available!`;
    } else {
      if (taskStatusEl) taskStatusEl.innerText = "No tasks right now";
    }
  });
}

function listenToGlobalStats() {
  db.ref('global/totalUsers').on('value', (snap) => {
    console.log("Global Active Miners:", snap.val());
  });
}
