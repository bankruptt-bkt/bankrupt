// ==========================================
// PROFILE LOGIC & REALTIME ACHIEVEMENTS
// ==========================================

// Pre defined Badge catalogue linked to GitHub subfolder assets
const MASTER_BADGES = [
  {
    id: "early_bankrupt",
    title: "Early Bankrupt",
    icon: "assets/images/logos/early_bankrupt.jpg",
    condition: (data) => true // Unlocked by default for Genesis Users
  },
  {
    id: "streak_7",
    title: "7 Day Streak",
    icon: "assets/images/logos/streak_7.jpg",
    condition: (data) => (data.longestStreak || data.streakDays || 0) >= 7
  },
  {
    id: "recruiter",
    title: "Recruiter",
    icon: "assets/images/logos/recruiter.jpg",
    condition: (data) => (data.referralsUsed || 0) >= 1
  },
  {
    id: "top_miner",
    title: "Top Miner",
    icon: "assets/images/logos/top_miner.jpg",
    condition: (data) => (data.balance || 0) >= 100.00
  }
];

document.addEventListener("DOMContentLoaded", () => {
  const authInstance = getAuth();
  
  if (authInstance) {
    authInstance.onAuthStateChanged((user) => {
      if (user) {
        listenToProfileRealtimeData(user.uid);
      }
    });
  }
});

// Real-time synchronization
function listenToProfileRealtimeData(uid) {
  const dbInstance = getDb();
  if (!dbInstance) return;

  dbInstance.ref('users/' + uid).on('value', (snapshot) => {
    const data = snapshot.val() || {};
    
    // Update basic stats
    const balance = data.balance || 0.0;
    const streak = data.streakDays || 0;
    const longestStreak = data.longestStreak || streak;
    const referrals = data.referralsUsed || 0;
    const activeLogo = data.activeProfileLogo || "assets/images/logos/early_bankrupt.jpg";

    document.getElementById('profile-display-name').innerText = currentUser.displayName || ("Miner_" + uid.substring(0, 5));
    document.getElementById('profile-uid').innerText = "UID: " + uid;
    
    document.getElementById('stat-balance').innerText = balance.toFixed(2);
    document.getElementById('stat-streak').innerText = streak;
    document.getElementById('stat-longest').innerText = longestStreak;
    document.getElementById('stat-referrals').innerText = referrals;

    // Update main avatar photo
    const avatarImg = document.getElementById('user-avatar');
    if (avatarImg) avatarImg.src = activeLogo;

    // Render unlocked badges in profile
    renderBadges(data);
  });
}

function renderBadges(userData) {
  const container = document.getElementById('badges-container');
  if (!container) return;

  container.innerHTML = "";

  MASTER_BADGES.forEach((badge) => {
    const isUnlocked = badge.condition(userData) || (userData.unlockedBadges && userData.unlockedBadges[badge.id]);

    const badgeCard = document.createElement('div');
    badgeCard.className = `flex flex-col items-center justify-center p-2 rounded-xl bg-[#0a0d0b] border ${isUnlocked ? 'border-[#00ff66]/50' : 'border-[#1a221d] opacity-40'}`;

    badgeCard.innerHTML = `
      <div class="w-12 h-12 rounded-full overflow-hidden border border-[#00ff66]/30 mb-1 flex items-center justify-center bg-[#121814]">
        <img src="${badge.icon}" alt="${badge.title}" class="w-full h-full object-cover" onerror="this.src='https://via.placeholder.com/100/0a0d0b/00ff66?text=👑'">
      </div>
      <span class="text-[10px] font-semibold text-gray-200 text-center leading-tight truncate w-full">${badge.title}</span>
    `;

    container.appendChild(badgeCard);
  });
}

// ==========================================
// BADGE / PROFILE LOGO SELECTOR MODAL
// ==========================================
function openBadgeSelector() {
  const modal = document.getElementById('badge-modal');
  const grid = document.getElementById('badge-selector-grid');
  if (!modal || !grid) return;

  grid.innerHTML = "";

  const dbInstance = getDb();
  if (!currentUser || !dbInstance) return;

  dbInstance.ref('users/' + currentUser.uid).once('value', (snap) => {
    const userData = snap.val() || {};
    const currentActive = userData.activeProfileLogo || "assets/images/logos/early_bankrupt.jpg";

    MASTER_BADGES.forEach((badge) => {
      const isUnlocked = badge.condition(userData) || (userData.unlockedBadges && userData.unlockedBadges[badge.id]);

      const item = document.createElement('div');
      item.className = `p-3 rounded-xl card-inner border flex flex-col items-center text-center space-y-2 ${isUnlocked ? 'border-[#00ff66]/40 cursor-pointer hover:border-[#00ff66]' : 'border-gray-800 opacity-40 cursor-not-allowed'}`;

      item.innerHTML = `
        <div class="w-14 h-14 rounded-full overflow-hidden border border-[#00ff66]/30 bg-[#121814]">
          <img src="${badge.icon}" alt="${badge.title}" class="w-full h-full object-cover" onerror="this.src='https://via.placeholder.com/100/0a0d0b/00ff66?text=👑'">
        </div>
        <span class="text-xs font-bold text-white">${badge.title}</span>
        <button class="w-full py-1 rounded-lg text-[10px] font-bold ${currentActive === badge.icon ? 'bg-[#00ff66] text-black' : 'bg-gray-800 text-gray-300'}">
          ${!isUnlocked ? 'Locked' : (currentActive === badge.icon ? 'Active' : 'Equip')}
        </button>
      `;

      if (isUnlocked) {
        item.onclick = () => selectProfileLogo(badge.icon);
      }

      grid.appendChild(item);
    });

    modal.classList.remove('hidden');
  });
}

function closeBadgeModal() {
  const modal = document.getElementById('badge-modal');
  if (modal) modal.classList.add('hidden');
}

async function selectProfileLogo(logoPath) {
  if (!currentUser) return;
  const dbInstance = getDb();
  
  try {
    await dbInstance.ref('users/' + currentUser.uid).update({
      activeProfileLogo: logoPath
    });
    closeBadgeModal();
  } catch (err) {
    alert("Failed to change logo: " + err.message);
  }
}

// ==========================================
// HISTORY MODALS
// ==========================================
function openHistoryModal(type) {
  const modal = document.getElementById('history-modal');
  const title = document.getElementById('history-modal-title');
  const list = document.getElementById('history-modal-list');

  if (!modal || !list) return;

  list.innerHTML = `<p class="text-gray-500 text-center py-4">Fetching records...</p>`;
  modal.classList.remove('hidden');

  const dbInstance = getDb();
  if (!currentUser || !dbInstance) return;

  if (type === 'streak') {
    title.innerText = "Streak History";
    dbInstance.ref('users/' + currentUser.uid).once('value', (snap) => {
      const data = snap.val() || {};
      const lastCheck = data.lastCheckIn ? new Date(data.lastCheckIn).toLocaleString() : 'Never';
      
      list.innerHTML = `
        <div class="card-inner p-3 rounded-xl flex justify-between items-center">
          <div>
            <p class="font-bold text-white">Current Streak</p>
            <p class="text-[10px] text-gray-500">Last Claim: ${lastCheck}</p>
          </div>
          <span class="text-[#00ff66] font-mono font-bold">${data.streakDays || 0} Days</span>
        </div>
        <div class="card-inner p-3 rounded-xl flex justify-between items-center">
          <div>
            <p class="font-bold text-white">Best Record</p>
          </div>
          <span class="text-orange-400 font-mono font-bold">${data.longestStreak || data.streakDays || 0} Days</span>
        </div>
      `;
    });
  } else if (type === 'transaction') {
    title.innerText = "Transaction History";
    dbInstance.ref('users/' + currentUser.uid + '/completedTasks').once('value', (snap) => {
      const tasks = snap.val() || {};
      const keys = Object.keys(tasks);

      if (keys.length === 0) {
        list.innerHTML = `<p class="text-gray-500 text-center py-4">No completed transactions yet.</p>`;
        return;
      }

      list.innerHTML = "";
      keys.forEach((k) => {
        list.innerHTML += `
          <div class="card-inner p-3 rounded-xl flex justify-between items-center">
            <div>
              <p class="font-bold text-white">Task Reward: ${k}</p>
              <p class="text-[10px] text-gray-500">Completed</p>
            </div>
            <span class="text-[#00ff66] font-mono font-bold">+Reward</span>
          </div>
        `;
      });
    });
  } else if (type === 'referral') {
    title.innerText = "Referral History";
    dbInstance.ref('users/' + currentUser.uid).once('value', (snap) => {
      const data = snap.val() || {};
      list.innerHTML = `
        <div class="card-inner p-3 rounded-xl flex justify-between items-center">
          <div>
            <p class="font-bold text-white">Successful Invites</p>
            <p class="text-[10px] text-gray-500">Earned +5.00 BKT per referral</p>
          </div>
          <span class="text-blue-400 font-mono font-bold">${data.referralsUsed || 0} Joined</span>
        </div>
      `;
    });
  }
}

function closeHistoryModal() {
  const modal = document.getElementById('history-modal');
  if (modal) modal.classList.add('hidden');
}
