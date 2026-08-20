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

const CHECKIN_INTERVAL_MS = 24 * 60 * 60 * 1000; 
const BASE_REWARD_INITIAL = 5.0; 
const WELCOME_BONUS = 50.00; 

let currentUser = null;
let currentuserData = null;
let countdownTimer = null;

function calculateBaseReward(totalUsers) {
  if (totalUsers <= 1000) return BASE_REWARD_INITIAL;
  if (totalUsers <= 10000) return BASE_REWARD_INITIAL * 0.75;
  if (totalUsers <= 100000) return BASE_REWARD_INITIAL * 0.5;
  if (totalUsers <= 1000000) return BASE_REWARD_INITIAL * 0.25;
  return BASE_REWARD_INITIAL * 0.1;
}

function getStreakMultiplier(streakDays) {
  const multipliers = { 1: 1.0, 2: 1.1, 3: 1.2, 4: 1.3, 5: 1.4, 6: 1.5, 7: 1.6 };
  return streakDays >= 7 ? 1.6 : (multipliers[streakDays] || 1.0);
}

// Global Click Function bound directly to the HTML button
window.claimCheckIn = async function() {
  if (!currentUser || !currentuserData) {
    alert("Authenticating... please try again in 2 seconds.");
    return;
  }

  const now = Date.now();
  const nextAvailableTime = (currentuserData.lastCheckIn || 0) + CHECKIN_INTERVAL_MS;

  if (now < nextAvailableTime) return; 

  const claimBtn = document.getElementById('claim-btn');
  if (claimBtn) {
    claimBtn.disabled = true;
    claimBtn.innerText = "CLAIMING...";
  }

  try {
    const globalSnap = await db.ref('global/totalUsers').once('value');
    const totalUsers = globalSnap.val() || 1;

    let newStreak = currentuserData.streakDays || 0;
    if (now - (currentuserData.lastCheckIn || 0) > CHECKIN_INTERVAL_MS * 2) {
      newStreak = 1; 
    } else {
      newStreak += 1; 
    }

    const baseRate = calculateBaseReward(totalUsers);
    const earned = baseRate * getStreakMultiplier(newStreak);

    await db.ref('users/' + currentUser.uid).update({
      balance: (currentuserData.balance || 0) + earned,
      streakDays: newStreak,
      lastCheckIn: now
    });
  } catch (err) {
    console.error("Check-in Error:", err);
    alert("Error claiming reward: " + err.message);
    if (claimBtn) claimBtn.disabled = false;
  }
};

auth.onAuthStateChanged(async (user) => {
  if (user) {
    currentUser = user;
    initUserData(user);
    listenToTasks();
  } else {
    auth.signInAnonymously().catch(console.error);
  }
});

function initUserData(user) {
  const userRef = db.ref('users/' + user.uid);
  
  userRef.on('value', (snapshot) => {
    let data = snapshot.val();
    
    if (!data) {
      data = {
        uid: user.uid,
        name: user.displayName || 'Miner ' + user.uid.substring(0, 5),
        balance: WELCOME_BONUS,
        streakDays: 0,
        lastCheckIn: 0,
        referralCount: 0,
        maxInvites: 10,
        createdAt: firebase.database.ServerValue.TIMESTAMP
      };
      userRef.set(data);
      db.ref('global/totalUsers').transaction(current => (current || 0) + 1);
    }
    
    currentuserData = data;
    updateUI(data);
  });
}

async function updateUI(userData) {
  // Update Profile Names
  const nameDisplay = document.getElementById('user-display-name');
  if (nameDisplay) nameDisplay.innerText = userData.name;
  
  const menuName = document.getElementById('menu-user-name');
  if (menuName) menuName.innerText = userData.name;

  const menuUid = document.getElementById('menu-user-uid');
  if (menuUid) menuUid.innerText = "UID: " + userData.uid.substring(0, 8) + "...";

  // Balance
  const balanceEl = document.getElementById('balance-display');
  if (balanceEl) balanceEl.innerText = (userData.balance || 0).toFixed(4);

  // Streak Title
  const streakTitle = document.getElementById('streak-title');
  if (streakTitle) {
    streakTitle.innerText = userData.streakDays > 0 ? `DAY ${userData.streakDays} STREAK` : 'START STREAK';
  }

  // Calculate Next Reward
  const globalSnap = await db.ref('global/totalUsers').once('value');
  const totalUsers = globalSnap.val() || 1;
  const baseRate = calculateBaseReward(totalUsers);
  
  const now = Date.now();
  let nextStreak = userData.streakDays || 0;
  if (now - (userData.lastCheckIn || 0) > CHECKIN_INTERVAL_MS * 2) {
    nextStreak = 1; 
  } else if (now >= (userData.lastCheckIn || 0) + CHECKIN_INTERVAL_MS) {
    nextStreak += 1; 
  }
  if (nextStreak === 0) nextStreak = 1;

  const nextReward = baseRate * getStreakMultiplier(nextStreak);
  
  const rewardLabel = document.querySelector('.card-bg b.text-white');
  if (rewardLabel) {
    rewardLabel.innerText = `+${nextReward.toFixed(2)} BKT`;
  }

  // Timer & Claim Button
  const nextAvailableTime = (userData.lastCheckIn || 0) + CHECKIN_INTERVAL_MS;
  const claimBtn = document.getElementById('claim-btn');

  if (now >= nextAvailableTime) {
    if (claimBtn) {
      claimBtn.innerText = "CHECK IN + CLAIM";
      claimBtn.disabled = false;
      claimBtn.setAttribute('onclick', 'claimCheckIn()');
      claimBtn.className = "w-full py-3 bg-[#00ff66] text-black font-marker text-lg rounded-xl border border-[#00ff66] shadow-lg shadow-[#00ff66]/30 cursor-pointer hover:bg-[#00e65c] transition-all";
    }
    setTimerDisplay("Ready", true);
  } else {
    if (claimBtn) {
      claimBtn.innerText = "CHECKED IN";
      claimBtn.disabled = true;
      claimBtn.removeAttribute('onclick');
      claimBtn.className = "w-full py-3 bg-[#1e2721] text-gray-400 font-marker text-lg rounded-xl border border-[#2a382f] cursor-not-allowed";
    }
    startCountdown(nextAvailableTime);
  }
}

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

    setTimerDisplay(`${h}h ${m}m ${s}s`, false);
  }

  tick();
  countdownTimer = setInterval(tick, 1000);
}

function setTimerDisplay(text, isReady) {
  const badge = document.getElementById('countdown-badge');
  if (badge) {
    if (isReady) {
      badge.className = "px-2.5 py-1 rounded-full bg-[#0d2216] text-[#00ff66] border border-[#144225] font-mono text-[11px] font-bold flex items-center gap-1";
      badge.innerHTML = `<i class="fa-regular fa-clock"></i> ${text}`;
    } else {
      badge.className = "px-2.5 py-1 rounded-full bg-[#18221b] text-gray-300 border border-[#2a382f] font-mono text-[11px] font-bold flex items-center gap-1";
      badge.innerHTML = `<i class="fa-regular fa-clock"></i> ${text}`;
    }
  }
}

function listenToTasks() {
  db.ref('tasks').on('value', (snapshot) => {
    const tasks = snapshot.val();
    const taskStatusEl = document.querySelector('.card-inner p.text-xs.text-\\[\\#00ff66\\]');
    
    if (tasks && taskStatusEl) {
      const activeCount = Object.keys(tasks).length;
      taskStatusEl.innerText = `${activeCount} New Tasks Available!`;
    } else if (taskStatusEl) {
      taskStatusEl.innerText = "No tasks right now";
    }
  });
}
