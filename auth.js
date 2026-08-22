// auth.js - Bankrupt Clean Auth & Instant Referral Engine

// 1. Capture referral code immediately on page load
(function captureReferral() {
  const urlParams = new URLSearchParams(window.location.search);
  const refCode = urlParams.get("ref");
  if (refCode) {
    localStorage.setItem("pending_referrer", refCode.trim());
    console.log("Referral code captured:", refCode.trim());
  }
})();

// Helper to access Firebase instances safely
function getFirebase() {
  const auth = window.auth || firebase.auth();
  const db = window.db || firebase.database();
  return { auth, db };
}

// 2. GOOGLE OAUTH SIGN IN
async function handleGoogleSignIn() {
  try {
    const { auth, db } = getFirebase();
    const provider = new firebase.auth.GoogleAuthProvider();
    
    // Explicitly request popup authentication
    const res = await auth.signInWithPopup(provider);
    if (res && res.user) {
      await processUserRegistration(res.user, db);
      window.location.href = 'index.html';
    }
  } catch (err) {
    console.error("Google Auth Error:", err);
    alert("Google Sign-In Error: " + err.message);
  }
}

// 3. TWITTER (X) OAUTH SIGN IN
async function handleTwitterSignIn() {
  try {
    const { auth, db } = getFirebase();
    const provider = new firebase.auth.TwitterAuthProvider();
    
    // Explicitly request popup authentication
    const res = await auth.signInWithPopup(provider);
    if (res && res.user) {
      await processUserRegistration(res.user, db);
      window.location.href = 'index.html';
    }
  } catch (err) {
    console.error("Twitter Auth Error:", err);
    alert("X (Twitter) Sign-In Error: " + err.message);
  }
}

// 4. ANONYMOUS GUEST SIGN IN (TESTING & GUESTS)
async function handleAnonymousSignIn() {
  try {
    const { auth, db } = getFirebase();
    const res = await auth.signInAnonymously();
    if (res && res.user) {
      await processUserRegistration(res.user, db);
      window.location.href = 'index.html';
    }
  } catch (err) {
    console.error("Guest Auth Error:", err);
    alert("Guest Sign-In Error: " + err.message);
  }
}

// 5. CENTRALIZED USER REGISTRATION & REFERRAL ENGINE
async function processUserRegistration(user, db) {
  try {
    const userRef = db.ref('users/' + user.uid);
    const snap = await userRef.once('value');

    // Only run registration logic for NEW users
    if (!snap.exists()) {
      const pendingReferrerUid = localStorage.getItem("pending_referrer");
      let validReferrer = null;

      // Check if referrer exists in DB
      if (pendingReferrerUid && pendingReferrerUid !== user.uid) {
        try {
          const refSnap = await db.ref('users/' + pendingReferrerUid).once('value');
          if (refSnap.exists()) {
            validReferrer = pendingReferrerUid;
          }
        } catch (refErr) {
          console.warn("Referrer lookup bypassed:", refErr);
        }
      }

      // Write initial user profile
      await userRef.set({
        uid: user.uid,
        name: user.displayName || (`Miner_${user.uid.substring(0, 5)}`),
        balance: 0.00,
        referredBy: validReferrer,
        referralsCount: 0,
        inviteCount: 0,
        bonusReferralSlots: 0,
        streakDays: 0,
        lastCheckIn: 0,
        createdAt: Date.now()
      });

      // Award referral bonus if valid
      if (validReferrer) {
        await awardReferralBonus(db, validReferrer, user.uid);
      }
    }
  } catch (dbErr) {
    console.error("Registration Database Error:", dbErr);
    throw dbErr;
  }
}

// 6. ATOMIC REFERRAL REWARD PROCESSOR
async function awardReferralBonus(db, referrerUid, newUserId) {
  try {
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
  } catch (err) {
    console.warn("Failed to credit referral bonus:", err);
  }
}
