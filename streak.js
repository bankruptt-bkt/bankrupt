// Configuration matching your Whitepaper specs
const STREAK_REWARDS = [10, 25, 50, 100, 200, 350, 500]; // $BKT reward per day
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const GRACE_PERIOD_MS = 48 * 60 * 60 * 1000; // Reset streak if over 48h

/**
 * Checks streak status and updates Firestore / UI
 * @param {string} userId - User's Telegram/Firestore ID
 * @param {object} db - Firestore database instance
 */
async function handleDailyStreak(userId, db) {
  const userRef = db.collection('users').doc(userId);
  const doc = await userRef.get();

  if (!doc.exists) return;

  const data = doc.data();
  const now = Date.now();
  const lastClaim = data.lastClaimTimestamp || 0;
  const timePassed = now - lastClaim;

  let currentStreak = data.currentStreak || 0;
  let canClaim = false;

  if (timePassed >= GRACE_PERIOD_MS) {
    // Over 48 hours: Reset streak
    currentStreak = 0;
    canClaim = true;
  } else if (timePassed >= DAY_IN_MS) {
    // Between 24 to 48 hours: Eligible for next day
    canClaim = true;
  } else {
    // Under 24 hours: Already claimed today
    canClaim = false;
  }

  updateStreakUI(currentStreak, canClaim, timePassed);
  
  return { currentStreak, canClaim };
}

/**
 * Claims the daily reward and increments streak in Firestore
 */
async function claimStreakReward(userId, db) {
  const userRef = db.collection('users').doc(userId);
  
  await db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) throw "User does not exist!";

    const data = userDoc.data();
    const now = Date.now();
    const lastClaim = data.lastClaimTimestamp || 0;
    const timePassed = now - lastClaim;

    if (timePassed < DAY_IN_MS && lastClaim !== 0) {
      throw "Reward already claimed today!";
    }

    let streak = data.currentStreak || 0;
    
    // Reset if grace period expired, otherwise increment (cap at Day 7 loop)
    if (timePassed >= GRACE_PERIOD_MS) {
      streak = 1;
    } else {
      streak = streak >= 7 ? 1 : streak + 1;
    }

    const rewardAmount = STREAK_REWARDS[streak - 1];
    const currentBalance = data.balance || 0;

    transaction.update(userRef, {
      currentStreak: streak,
      lastClaimTimestamp: now,
      balance: currentBalance + rewardAmount
    });
  });

  console.log("Streak reward claimed successfully!");
}

/**
 * Helper to dynamically render UI elements
 */
function updateStreakUI(streak, canClaim, timePassed) {
  const claimBtn = document.getElementById('claim-streak-btn');
  const streakText = document.getElementById('streak-count-display');
  
  if (streakText) streakText.innerText = `Day ${streak} / 7`;

  if (claimBtn) {
    if (canClaim) {
      claimBtn.disabled = false;
      claimBtn.innerText = `Claim Day ${streak >= 7 || streak === 0 ? 1 : streak + 1} Reward`;
    } else {
      claimBtn.disabled = true;
      const hoursRemaining = Math.ceil((DAY_IN_MS - timePassed) / (1000 * 60 * 60));
      claimBtn.innerText = `Next claim in ${hoursRemaining}h`;
    }
  }
}
