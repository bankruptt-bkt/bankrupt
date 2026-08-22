// auth.js - Bankrupt Auth & Referral Engine

// 1. Capture referral code immediately on page load
(function captureReferral() {
  const urlParams = new URLSearchParams(window.location.search);
  const refCode = urlParams.get("ref");
  if (refCode) {
    localStorage.setItem("pending_referrer", refCode.trim());
    console.log("Referral code captured:", refCode.trim());
  }
})();

// Helper to check for mobile device viewport or user agent
function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
    || window.innerWidth <= 768;
}

// Helper to access Firebase instances safely
function getFirebase() {
  const auth = window.auth || firebase.auth();
  const db = window.db || firebase.database();
  return { auth, db };
}

// 2. Google Sign-In Handler
async function handleGoogleSignIn() {
  try {
    const { auth, db } = getFirebase();
    const provider = new firebase.auth.GoogleAuthProvider();

    if (isMobileDevice()) {
      await auth.signInWithRedirect(provider);
    } else {
      const res = await auth.signInWithPopup(provider);
      await processUserRegistration(res.user, db);
      window.location.href = 'index.html';
    }
  } catch (err) {
    console.error("Google Auth Error:", err);
    alert("Google Sign-In Error: " + err.message);
  }
}

// 3. Twitter (X) Sign-In Handler
async function handleTwitterSignIn() {
  try {
    const { auth, db } = getFirebase();
    const provider = new firebase.auth.TwitterAuthProvider();

    if (isMobileDevice()) {
      await auth.signInWithRedirect(provider);
    } else {
      const res = await auth.signInWithPopup(provider);
      await processUserRegistration(res.user, db);
      window.location.href = 'index.html';
    }
  } catch (err) {
    console.error("Twitter Auth Error:", err);
    alert("X (Twitter) Sign-In Error: " + err.message);
  }
}

// 4. Anonymous Guest Handler (Testing & Quick Mobile Entry)
async function handleAnonymousSignIn() {
  try {
    const { auth, db } = getFirebase();
    const res = await auth.signInAnonymously();
    await processUserRegistration(res.user, db);
    window.location.href = 'index.html';
  } catch (err) {
    console.error("Guest Auth Error:", err);
    alert("Guest Sign-In Error: " + err.message);
  }
}

// 5. Handle Mobile Redirect Callbacks on Load
window.addEventListener('DOMContentLoaded', async () => {
  try {
    const { auth, db } = getFirebase();
    const result = await auth.getRedirectResult();
    
    if (result && result.user) {
      await processUserRegistration(result.user, db);
      window.location.href = 'index.html';
    }
  } catch (err) {
    console.error("Redirect Completion Error:", err);
  }
});

// 6. Centralized Database Entry & Referral Check
async function processUserRegistration(user, db) {
  const userRef = db.ref('users/' + user.uid);
  const snap = await userRef.once('value');

  if (!snap.exists()) {
    const pendingReferrerUid = localStorage.getItem("pending_referrer");
    let validReferrer = null;

    if (pendingReferrerUid && pendingReferrerUid !== user.uid) {
      const refSnap = await db.ref('users/' + pendingReferrerUid).once('value');
      if (refSnap.exists()) {
        validReferrer = pendingReferrerUid;
      }
    }

    // Write initial user record
    await userRef.set({
      uid: user.uid,
      name: user.displayName || (`Guest_${user.uid.substring(0, 5)}`),
      balance: 0.00,
      referredBy: validReferrer,
      referralsCount: 0,
      inviteCount: 0,
      bonusReferralSlots: 0,
      streakDays: 0,
      lastCheckIn: 0,
      createdAt: Date.now()
    });

    // Execute atomic referral credit if valid
    if (validReferrer) {
      await awardReferralBonus(db, validReferrer, user.uid);
    }
  }
}

// 7. Atomic Referral Reward Processing
async function awardReferralBonus(db, referrerUid, newUserId) {
  const BONUS_BKT = 5.00;
  const referrerRef = db.ref('users/' + referrerUid);

  await referrerRef.transaction((referrer) => {
    if (referrer) {
      referrer.referralsCount = (referrer.referralsCount || 0) + 1;
      referrer.inviteCount = (referrer.inviteCount || 0) + 1;
      referrer.balance = (referrer.balance || 0) + BONUS_BKT;
    }
    return referrer;
  });

  await db.ref('system/totalReferrals').transaction((c) => (c || 0) + 1);

  await db.ref(`users/${referrerUid}/referralHistory`).push({
    referredUserId: newUserId,
    reward: BONUS_BKT,
    type: 'SIGNUP_BONUS',
    timestamp: Date.now()
  });

  localStorage.removeItem("pending_referrer");
}
