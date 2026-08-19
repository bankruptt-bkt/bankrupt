import { db, auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.x.x/firebase-auth.js";
import { doc, getDoc, setDoc, runTransaction } from "https://www.gstatic.com/firebasejs/9.x.x/firebase-firestore.js";

const BOT_USERNAME = "YourBotUsername"; // Replace with your actual Telegram Bot username (without @)
const REFERRAL_REWARD = 100;
const MAX_REFERRALS = 10;

// 1. Auth Listener
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // Process referral if joining via an invite link for the first time
    await handleIncomingReferral(user);

    // Fetch user data & render referral UI
    const userSnap = await getDoc(doc(db, "users", user.uid));
    const refCount = userSnap.exists() ? (userSnap.data().referralCount || 0) : 0;

    setupReferralUI(user.uid, refCount);
  }
});

/**
 * Handles generating and copying the referral link
 */
function setupReferralUI(userId, referralCount = 0) {
  const refInput = document.getElementById("referral-link");
  const countDisplay = document.getElementById("ref-count-display");
  const copyBtn = document.getElementById("copy-ref-btn");

  const inviteLink = `https://t.me/${BOT_USERNAME}?startapp=${userId}`;

  if (refInput) refInput.value = inviteLink;
  if (countDisplay) countDisplay.textContent = `${referralCount} / ${MAX_REFERRALS}`;

  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent("Join me on BANKRUPT and claim your initial $BKT reward!")}`;
      
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.openTelegramLink(shareUrl);
      } else {
        navigator.clipboard.writeText(inviteLink);
        alert("Invite link copied to clipboard!");
      }
    });
  }
}

/**
 * Handles rewarding the inviter and the new user upon signup
 */
async function handleIncomingReferral(newUser) {
  const newUserRef = doc(db, "users", newUser.uid);
  const newUserSnap = await getDoc(newUserRef);

  // Stop if user already exists
  if (newUserSnap.exists()) return;

  // Extract startapp parameter passed by Telegram Mini App
  const startParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param;

  if (!startParam || startParam === newUser.uid) {
    // Standard creation without a referrer
    await setDoc(newUserRef, {
      username: newUser.displayName || "Anonymous",
      balance: 0,
      referralCount: 0,
      referredBy: null,
      createdAt: new Date()
    });
    return;
  }

  const referrerRef = doc(db, "users", startParam);

  try {
    await runTransaction(db, async (transaction) => {
      const referrerDoc = await transaction.get(referrerRef);
      let referrerEligible = false;
      let currentRefCounts = 0;

      if (referrerDoc.exists()) {
        currentRefCounts = referrerDoc.data().referralCount || 0;
        if (currentRefCounts < MAX_REFERRALS) {
          referrerEligible = true;
        }
      }

      // Create new user profile with bonus if referred
      transaction.set(newUserRef, {
        username: newUser.displayName || "Anonymous",
        balance: referrerEligible ? REFERRAL_REWARD : 0,
        referralCount: 0,
        referredBy: startParam,
        createdAt: new Date()
      });

      // Credit referrer if they are under max limit
      if (referrerEligible) {
        const referrerBalance = referrerDoc.data().balance || 0;
        transaction.update(referrerRef, {
          balance: referrerBalance + REFERRAL_REWARD,
          referralCount: currentRefCounts + 1
        });
      }
    });
  } catch (err) {
    console.error("Error processing referral:", err);
  }
}
