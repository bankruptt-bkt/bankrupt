// Safe accessor helper for Firebase Realtime Database
function getDb() {
  return window.db || (typeof firebase !== 'undefined' ? firebase.database() : null);
}

// Safe accessor helper for Firebase Auth
function getAuth() {
  return window.auth || (typeof firebase !== 'undefined' ? firebase.auth() : null);
}

// Protect Admin Panel - Verify User Auth
document.addEventListener("DOMContentLoaded", () => {
  const authInstance = getAuth();
  if (authInstance) {
    authInstance.onAuthStateChanged((user) => {
      if (!user) {
        window.location.href = "login.html";
      }
    });
  }
});

// ==========================================
// 1. GRANT DIRECT TOKEN BONUS
// ==========================================
async function handleGrantBonus() {
  const uid = document.getElementById('bonus-uid-input').value.trim();
  const amountStr = document.getElementById('bonus-amount-input').value.trim();
  const amount = parseFloat(amountStr);

  if (!uid || isNaN(amount) || amount <= 0) {
    alert("Please enter a valid User UID and a positive bonus amount.");
    return;
  }

  const dbInstance = getDb();
  if (!dbInstance) {
    alert("Database connection error.");
    return;
  }

  const userRef = dbInstance.ref(`users/${uid}`);

  try {
    // Atomic transaction to guarantee balance accuracy on user's dashboard
    const result = await userRef.child('balance').transaction((currentBalance) => {
      return (currentBalance || 0) + amount;
    });

    if (result.committed) {
      alert(`Successfully added +${amount} BKT to User: ${uid}`);
      document.getElementById('bonus-uid-input').value = '';
      document.getElementById('bonus-amount-input').value = '';
    } else {
      alert("Failed to update balance. Please verify the UID.");
    }
  } catch (error) {
    console.error("Bonus Error:", error);
    alert("Error granting bonus: " + error.message);
  }
}

// ==========================================
// 2. ADD ADDITIONAL REFERRALS (BEYOND BASE 10)
// ==========================================
async function handleAddReferrals() {
  const uid = document.getElementById('ref-uid-input').value.trim();
  const refCountStr = document.getElementById('ref-count-input').value.trim();
  const additionalRefs = parseInt(refCountStr, 10);

  if (!uid || isNaN(additionalRefs) || additionalRefs <= 0) {
    alert("Please enter a valid User UID and positive referral count.");
    return;
  }

  const dbInstance = getDb();
  if (!dbInstance) {
    alert("Database connection error.");
    return;
  }

  const userRef = dbInstance.ref(`users/${uid}`);

  try {
    // Atomic transaction to increment referral count safely
    const result = await userRef.child('referralsCount').transaction((currentCount) => {
      return (currentCount || 0) + additionalRefs;
    });

    if (result.committed) {
      alert(`Successfully added +${additionalRefs} referrals to User: ${uid}`);
      document.getElementById('ref-uid-input').value = '';
      document.getElementById('ref-count-input').value = '';
    } else {
      alert("Failed to update referrals. Please verify the UID.");
    }
  } catch (error) {
    console.error("Referrals Error:", error);
    alert("Error updating referrals: " + error.message);
  }
}
