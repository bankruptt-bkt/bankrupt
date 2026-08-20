// ==========================================
// CONFIGURATION & GLOBAL STATES
// ==========================================
const CHECKIN_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 Hours in ms
let currentUser = null;
let userData = {
  balance: 0.00,
  streakDays: 0,
  lastCheckIn: 0
};
let countdownInterval = null;

// ==========================================
// 1. AUTHENTICATION & SESSION GUARD
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  // Check if Firebase Auth is initialized
  if (typeof auth !== 'undefined') {
    auth.onAuthStateChanged((user) => {
      if (user) {
        currentUser = user;
        updateUserProfileUI(user);
        listenToUserData(user.uid);
      } else {
        // Redirect to login if unauthenticated
        window.location.href = 'login.html';
      }
    });
  } else {
    console.error("Firebase Auth SDK not found.");
  }
});

// Update Menu & Header Profile Information
function updateUserProfileUI(user) {
  const headerName = document.getElementById('user-display-name');
  const menuName = document.getElementById('menu-user-name');
  const menuUid = document.getElementById('menu-user-uid');

  const displayName = user.displayName || ("Miner_" + user.uid.substring(0, 5));

  if (headerName) headerName.innerText = displayName;
  if (menuName) menuName.innerText = displayName;
  if (menuUid) menuUid.innerText = "UID: " + user.uid;
}

// ==========================================
// 2. REAL-TIME FIREBASE DATABASE SYNC
// ==========================================
function listenToUserData(uid) {
  if (typeof db === 'undefined') return;

  const userRef = db.ref('users/' + uid);
  userRef.on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
      userData = {
        balance: data.balance || 0.00,
        streakDays: data.streakDays || 0,
        lastCheckIn: data.lastCheckIn || 0
      };
    } else {
      // Initialize new user record in Realtime Database
      userRef.set(userData);
    }

    renderUI();
  }, (error) => {
    console.error("Database read failed:", error);
  });
}

// ==========================================
// 3. UI RENDER & COUNTDOWN TIMER LOGIC
// ==========================================
function renderUI() {
  // Update Total Balance Display
  const balanceEl = document.getElementById('balance-display');
  if (balanceEl) {
    balanceEl.innerText = userData.balance.toFixed(4);
  }

  // Update Streak Multiplier Title
  const streakTitle = document.getElementById('streak-title');
  if (streakTitle) {
    streakTitle.innerText = userData.streakDays > 0 
      ? `STREAK: DAY ${userData.streakDays}` 
      : "START STREAK";
  }

  // Update Check-in Button State & Countdown Badge
  renderButtonAndTimer();
}

function renderButtonAndTimer() {
  const claimBtn = document.getElementById('claim-btn');
  const badge = document.getElementById('countdown-badge');
  if (!claimBtn) return;

  const now = Date.now();
  const nextAvailable = userData.lastCheckIn + CHECKIN_INTERVAL_MS;
  const timeRemaining = nextAvailable - now;

  if (timeRemaining <= 0) {
    // Claim Available State
    if (countdownInterval) clearInterval(countdownInterval);

    claimBtn.innerText = "CHECK IN + CLAIM";
    claimBtn.disabled = false;
    claimBtn.onclick = handleClaim;
    claimBtn.className = "w-full py-3 bg-[#00ff66] text-black font-marker text-lg rounded-xl border border-[#00ff66] shadow-lg shadow-[#00ff66]/30 cursor-pointer hover:bg-[#00e65c] transition-all";

    if (badge) {
      badge.innerHTML = `<i class="fa-regular fa-clock"></i> Ready`;
      badge.className = "px-2.5 py-1 rounded-full bg-[#0d2216] text-[#00ff66] border border-[#144225] font-mono text-[11px] font-bold flex items-center gap-1";
    }
  } else {
    // Cooldown State
    claimBtn.innerText = "CHECKED IN";
    claimBtn.disabled = true;
    claimBtn.onclick = null;
    claimBtn.className = "w-full py-3 bg-[#1e2721] text-gray-400 font-marker text-lg rounded-xl border border-[#2a382f] cursor-not-allowed";

    // Run active countdown timer
    startCountdown(nextAvailable);
  }
}

function startCountdown(nextAvailableTime) {
  if (countdownInterval) clearInterval(countdownInterval);

  const updateTimer = () => {
    const now = Date.now();
    const diff = nextAvailableTime - now;

    const badge = document.getElementById('countdown-badge');

    if (diff <= 0) {
      clearInterval(countdownInterval);
      renderButtonAndTimer();
      return;
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    const formattedTime = `${padZero(hours)}:${padZero(minutes)}:${padZero(seconds)}`;

    if (badge) {
      badge.innerHTML = `<i class="fa-regular fa-clock"></i> ${formattedTime}`;
      badge.className = "px-2.5 py-1 rounded-full bg-gray-800 text-gray-400 border border-gray-700 font-mono text-[11px] font-bold flex items-center gap-1";
    }
  };

  updateTimer();
  countdownInterval = setInterval(updateTimer, 1000);
}

function padZero(num) {
  return num < 10 ? '0' + num : num;
}

// ==========================================
// 4. CHECK-IN ACTION & DATABASE UPDATE
// ==========================================
async function handleClaim() {
  const claimBtn = document.getElementById('claim-btn');
  if (claimBtn) {
    claimBtn.innerText = "CLAIMING...";
    claimBtn.disabled = true;
  }

  // Update optimistic local data
  const rewardAmount = 5.00;
  userData.balance += rewardAmount;
  userData.streakDays += 1;
  userData.lastCheckIn = Date.now();

  // Instantly re-render local UI
  renderUI();

  // Commit updates to Firebase Realtime Database
  if (currentUser && typeof db !== 'undefined') {
    try {
      await db.ref('users/' + currentUser.uid).update({
        balance: userData.balance,
        streakDays: userData.streakDays,
        lastCheckIn: userData.lastCheckIn
      });
    } catch (e) {
      console.error("Failed to commit claim to database:", e.message);
    }
  }
}

// ==========================================
// 5. SIGN OUT HANDLER
// ==========================================
async function handleSignOut(e) {
  if (e) e.preventDefault();

  try {
    if (typeof auth !== 'undefined') {
      await auth.signOut();
    }
    localStorage.clear();
    window.location.href = 'login.html';
  } catch (err) {
    console.error("Sign Out Error:", err);
    alert("Failed to sign out: " + err.message);
  }
}
// ==========================================
// 6. INTERACTIVE DRAG-TO-SLIDE DRAWER LOGIC
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  const drawer = document.getElementById('drawer-sheet');
  const handle = document.getElementById('drawer-handle');
  const overlay = document.getElementById('side-menu-overlay');

  if (!drawer || !handle) return;

  let startY = 0;
  let currentY = 0;
  let isDragging = false;

  // Touch Event Listeners
  handle.addEventListener('touchstart', onDragStart, { passive: true });
  window.addEventListener('touchmove', onDragMove, { passive: false });
  window.addEventListener('touchend', onDragEnd);

  // Mouse Event Listeners for Desktop Testing
  handle.addEventListener('mousedown', onDragStart);
  window.addEventListener('mousemove', onDragMove);
  window.addEventListener('mouseup', onDragEnd);

  function onDragStart(e) {
    if (!drawer.classList.contains('open')) return;
    isDragging = true;
    startY = e.touches ? e.touches[0].clientY : e.clientY;
    drawer.classList.add('dragging');
  }

  function onDragMove(e) {
    if (!isDragging) return;
    
    currentY = e.touches ? e.touches[0].clientY : e.clientY;
    let deltaY = currentY - startY;

    // Resistance when pulling upwards past standard top
    if (deltaY < 0) {
      deltaY = deltaY * 0.2; 
    }

    if (e.cancelable) e.preventDefault();
    drawer.style.transform = `translateY(${deltaY}px)`;
  }

  function onDragEnd() {
    if (!isDragging) return;
    isDragging = false;
    drawer.classList.remove('dragging');

    let deltaY = currentY - startY;

    // Dismiss drawer if pulled down over 120px
    if (deltaY > 120) {
      toggleMenu();
    } else {
      // Snap back to top position
      drawer.style.transform = 'translateY(0)';
    }

    startY = 0;
    currentY = 0;
  }
});
