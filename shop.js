// ==========================================
// HYBRID SHOP & MILESTONE CLAIM LOGIC
// ==========================================

const FALLBACK_AVATAR = "https://api.dicebear.com/7.x/bottts/svg?seed=Bankrupt";

// Master Catalog defining both purchasable products and claimable milestone rewards
const MASTER_CATALOG = [
  // --- MILESTONE REWARDS (FREE CLAIM ON CONDITION) ---
  {
    id: "grinder",
    type: "milestone",
    category: "milestone",
    title: "Grinder Badge",
    desc: "Maintain a 3-day active mining streak.",
    image: "assets/images/profile/grinder.jpg",
    price: 0,
    checkRequirement: (userData) => (userData.streakDays || 0) >= 3,
    reqLabel: "Requires 3-Day Streak"
  },
  {
    id: "hustler",
    type: "milestone",
    category: "milestone",
    title: "Hustler Badge",
    desc: "Refer at least 1 friend to the platform.",
    image: "assets/images/profile/hustler.jpg",
    price: 0,
    checkRequirement: (userData) => (userData.referralsUsed || 0) >= 1,
    reqLabel: "Requires 1 Referral"
  },
  {
    id: "degenerate",
    type: "milestone",
    category: "milestone",
    title: "Degenerate Badge",
    desc: "Hit a massive 7-day continuous streak.",
    image: "assets/images/profile/degenerate.jpg",
    price: 0,
    checkRequirement: (userData) => (userData.longestStreak || userData.streakDays || 0) >= 7,
    reqLabel: "Requires 7-Day Streak"
  },

  // --- PURCHASABLE BADGES ---
  {
    id: "broke_badge",
    type: "purchase",
    category: "badge",
    title: "Broke Badge",
    desc: "Flex your initial earnings on your profile.",
    image: "assets/images/profile/rookie.jpg",
    price: 500
  },
  {
    id: "tycoon",
    type: "purchase",
    category: "badge",
    title: "Tycoon Logo",
    desc: "Unlock the exclusive Tycoon avatar logo.",
    image: "assets/images/profile/tycoon.jpg",
    price: 5000
  },

  // --- PURCHASABLE TITLES ---
  {
    id: "bankruptking",
    type: "purchase",
    category: "title",
    title: "Bankrupt King",
    desc: "Wear the crown of the absolute top earner.",
    image: "assets/images/profile/bankruptking.jpg",
    price: 25000
  },

  // --- PURCHASABLE BOOSTS ---
  {
    id: "speed_boost_2x",
    type: "boost",
    category: "boost",
    title: "2x Mining Rate",
    desc: "Doubles your mining yield per hour for 24 hours.",
    image: "assets/images/profile/grinder.jpg",
    price: 1500
  }
];

let activeCategoryFilter = "all";
let currentUserData = {};
let currentUserId = null;

document.addEventListener("DOMContentLoaded", () => {
  const authInstance = getAuth();

  if (authInstance) {
    authInstance.onAuthStateChanged((user) => {
      if (user) {
        currentUserId = user.uid;
        listenToShopUserData(user.uid);
      }
    });
  }
});

// Real-time synchronization for user balance and unlocked inventory
function listenToShopUserData(uid) {
  const dbInstance = getDb();
  if (!dbInstance) return;

  dbInstance.ref("users/" + uid).on("value", (snap) => {
    currentUserData = snap.val() || {};
    
    // Update live top bar balance display
    const balanceElem = document.getElementById("shop-user-balance");
    if (balanceElem) {
      const balance = currentUserData.balance || 0;
      balanceElem.innerText = balance.toFixed(4);
    }

    renderCatalog();
  });
}

// Category filter handler
function filterShopCategory(category) {
  activeCategoryFilter = category;

  const categories = ["all", "milestone", "badge", "boost", "title"];
  categories.forEach((cat) => {
    const btn = document.getElementById(`shop-tab-${cat}`);
    if (btn) {
      if (cat === category) {
        btn.className = "px-4 py-2 text-xs rounded-xl whitespace-nowrap transition-all tab-active";
      } else {
        btn.className = "px-4 py-2 text-xs rounded-xl whitespace-nowrap text-gray-400 hover:text-white transition-all font-medium bg-[#121814] border border-[#1c2620]";
      }
    }
  });

  renderCatalog();
}

// Render dynamic item cards based on real-time state
function renderCatalog() {
  const grid = document.getElementById("shop-catalog-grid");
  if (!grid) return;

  grid.innerHTML = "";

  const unlockedBadges = currentUserData.unlockedBadges || {};
  const activeLogo = currentUserData.activeProfileLogo || "";

  const itemsToDisplay = MASTER_CATALOG.filter((item) => {
    if (activeCategoryFilter === "all") return true;
    return item.category === activeCategoryFilter;
  });

  if (itemsToDisplay.length === 0) {
    grid.innerHTML = `<p class="col-span-2 text-center text-xs text-gray-500 py-8">No items available in this category.</p>`;
    return;
  }

  itemsToDisplay.forEach((item) => {
    const isOwned = unlockedBadges[item.id] || false;
    const isEquipped = activeLogo === item.image;
    
    let buttonHtml = "";
    let borderClass = "border-[#1c2620]";
    let tagBadge = `<span class="text-[9px] font-bold px-2 py-0.5 rounded-full bg-gray-800 text-gray-300">SHOP</span>`;

    // 1. Milestone Rewards Logic
    if (item.type === "milestone") {
      tagBadge = `<span class="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-900/60 text-blue-300 border border-blue-500/30">CLAIMABLE</span>`;
      const meetsRequirement = item.checkRequirement(currentUserData);

      if (isOwned) {
        if (isEquipped) {
          buttonHtml = `<button class="w-full py-2 rounded-xl text-xs font-bold bg-gray-800 text-gray-400 cursor-default">Equipped</button>`;
        } else {
          buttonHtml = `<button onclick="equipShopItem('${item.image}')" class="w-full py-2 rounded-xl text-xs font-bold bg-[#1c2620] text-white hover:border-[#00ff66] border border-gray-700 transition-colors">Equip</button>`;
        }
      } else if (meetsRequirement) {
        borderClass = "border-[#00ff66] pulse-claim";
        buttonHtml = `<button onclick="claimMilestone('${item.id}')" class="w-full py-2 rounded-xl text-xs font-bold bg-[#00ff66] text-black hover:brightness-110 transition-transform">Claim Badge</button>`;
      } else {
        buttonHtml = `<button class="w-full py-1.5 rounded-xl text-[10px] font-bold bg-gray-900 text-gray-500 border border-gray-800 cursor-not-allowed leading-tight">${item.reqLabel}</button>`;
      }
    } 
    // 2. Direct Purchases (BKT)
    else if (item.type === "purchase") {
      if (isOwned) {
        if (isEquipped) {
          buttonHtml = `<button class="w-full py-2 rounded-xl text-xs font-bold bg-gray-800 text-gray-400 cursor-default">Equipped</button>`;
        } else {
          buttonHtml = `<button onclick="equipShopItem('${item.image}')" class="w-full py-2 rounded-xl text-xs font-bold bg-[#1c2620] text-white hover:border-[#00ff66] border border-gray-700 transition-colors">Equip</button>`;
        }
      } else {
        buttonHtml = `<button onclick="buyShopItem('${item.id}', ${item.price})" class="w-full py-2 rounded-xl text-xs font-bold bg-[#121814] text-[#00ff66] border border-[#00ff66]/40 hover:bg-[#00ff66] hover:text-black transition-all flex items-center justify-center gap-1">
          <i class="fa-solid fa-coins text-[10px]"></i> ${item.price.toLocaleString()} BKT
        </button>`;
      }
    }
    // 3. Temporary Boosts
    else if (item.type === "boost") {
      tagBadge = `<span class="text-[9px] font-bold px-2 py-0.5 rounded-full bg-orange-950/60 text-orange-400 border border-orange-500/30">BOOST</span>`;
      buttonHtml = `<button onclick="buyBoost('${item.id}', ${item.price})" class="w-full py-2 rounded-xl text-xs font-bold bg-orange-500 text-black hover:bg-orange-400 transition-colors">Buy Boost</button>`;
    }

    const card = document.createElement("div");
    card.className = `card-bg rounded-2xl p-3 flex flex-col justify-between border ${borderClass} relative`;

    card.innerHTML = `
      <div>
        <div class="flex items-center justify-between mb-2">
          ${tagBadge}
        </div>
        <div class="w-20 h-20 mx-auto rounded-full overflow-hidden border border-gray-800 bg-[#0a0d0b] mb-3 flex items-center justify-center">
          <img src="${item.image}" alt="${item.title}" class="w-full h-full object-cover" onerror="this.onerror=null; this.src='${FALLBACK_AVATAR}';">
        </div>
        <h3 class="font-bold text-xs text-white text-center tracking-wide">${item.title}</h3>
        <p class="text-[10px] text-gray-500 text-center mt-1 leading-snug line-clamp-2 min-h-[28px]">${item.desc}</p>
      </div>

      <div class="mt-3">
        ${buttonHtml}
      </div>
    `;

    grid.appendChild(card);
  });
}

// Action: Claim Free Milestone
async function claimMilestone(itemId) {
  if (!currentUserId) return;
  const dbInstance = getDb();

  try {
    const updates = {};
    updates[`users/${currentUserId}/unlockedBadges/${itemId}`] = true;
    
    await dbInstance.ref().update(updates);
    alert("🎉 Achievement Claimed! You can now equip this item.");
  } catch (err) {
    alert("Error claiming reward: " + err.message);
  }
}

// Action: Buy Item using BKT Tokens
async function buyShopItem(itemId, price) {
  if (!currentUserId) return;
  const dbInstance = getDb();

  const currentBalance = currentUserData.balance || 0;
  if (currentBalance < price) {
    alert(`Insufficient balance! You need ${price.toLocaleString()} BKT to unlock this item.`);
    return;
  }

  if (!confirm(`Are you sure you want to spend ${price.toLocaleString()} BKT?`)) return;

  try {
    const newBalance = currentBalance - price;
    const updates = {};
    
    updates[`users/${currentUserId}/balance`] = newBalance;
    updates[`users/${currentUserId}/unlockedBadges/${itemId}`] = true;

    await dbInstance.ref().update(updates);
    alert("Success! Item purchased and unlocked.");
  } catch (err) {
    alert("Transaction failed: " + err.message);
  }
}

// Action: Equip Profile Logo
async function equipShopItem(logoPath) {
  if (!currentUserId) return;
  const dbInstance = getDb();

  try {
    await dbInstance.ref(`users/${currentUserId}`).update({
      activeProfileLogo: logoPath
    });
  } catch (err) {
    alert("Failed to equip item: " + err.message);
  }
}

// Action: Buy Temporary Speed Boost
async function buyBoost(boostId, price) {
  if (!currentUserId) return;
  const dbInstance = getDb();

  const currentBalance = currentUserData.balance || 0;
  if (currentBalance < price) {
    alert("Insufficient balance to activate boost!");
    return;
  }

  try {
    const newBalance = currentBalance - price;
    const boostExpiry = Date.now() + (24 * 60 * 60 * 1000); // 24 hours active

    const updates = {};
    updates[`users/${currentUserId}/balance`] = newBalance;
    updates[`users/${currentUserId}/activeBoosts/${boostId}`] = boostExpiry;

    await dbInstance.ref().update(updates);
    alert("⚡ 2x Mining Rate activated for 24 hours!");
  } catch (err) {
    alert("Failed to buy boost: " + err.message);
  }
}
