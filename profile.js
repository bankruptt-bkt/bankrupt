import { db, auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.x.x/firebase-auth.js";
import { doc, getDoc, setDoc, runTransaction } from "https://www.gstatic.com/firebasejs/9.x.x/firebase-firestore.js";

const REFERRAL_REWARD = 100;
const MAX_REFERRALS = 10;

// 1. Auth Listener
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // Check if new user visited via a referral URL parameter (?ref=USER_ID)
    await handleIncomingWebReferral(user);

    // Fetch user profile from Firestore
    const userSnap = await getDoc(doc(db, "users", user.uid));
    const refCount = userSnap.exists() ? (userSnap.data().referralCount || 0) : 0;

    // Set up web referral link UI
    setupWebReferralUI(user.uid, refCount);
  }
});

/**
 * Creates a web URL using the current domain name
 */
function setupWebReferralUI(userId, referralCount = 0) {
  const refInput = document.getElementById("referral-link");
  const countDisplay = document.getElementById("ref-count-display");
  const copyBtn = document.getElementById("copy-ref-btn");

  // Generates a clean Web URL: https://bankruptt-bkt.github.io/bankrupt/?ref=USER_ID
  const inviteLink = `${window.location.origin}${window.location.pathname}?ref=${userId}`;

  if (refInput) refInput.value = inviteLink;
  if (countDisplay) countDisplay.textContent = `${referralCount} / ${MAX_REFERRALS}`;

  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(inviteLink);
        alert("Referral link copied to clipboard!");
      } catch (err) {
        // Fallback copy logic
        refInput.select();
        document.execCommand("copy");
        alert("Referral link copied!");
      }
    });
  }
}

/**
 * Handles processing ?ref= in the web browser URL
 */
async function handleIncomingWebReferral(newUser) {
  const newUserRef = doc(db, "users", newUser.uid);
  const newUserSnap = await getDoc(newUserRef);

  // Stop if user already exists
  if (newUserSnap.exists()) return;

  // Extract ?ref= from the website URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const referrerId = urlParams.get("ref");

  if (!referrerId || referrerId === newUser.uid) {
    // Standard user registration
    await setDoc(newUserRef, {
      username: newUser.displayName || "Anonymous",
      balance: 0,
      referralCount: 0,
      referredBy: null,
      createdAt: new Date()
    });
    return;
  }

  const referrerRef = doc(db, "users", referrerId);

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

      // Create new user with welcome reward
      transaction.set(newUserRef, {
        username: newUser.displayName || "Anonymous",
        balance: referrerEligible ? REFERRAL_REWARD : 0,
        referralCount: 0,
        referredBy: referrerId,
        createdAt: new Date()
      });

      // Credit referrer
      if (referrerEligible) {
        const referrerBalance = referrerDoc.data().balance || 0;
        transaction.update(referrerRef, {
          balance: referrerBalance + REFERRAL_REWARD,
          referralCount: currentRefCounts + 1
        });
      }
    });
  } catch (err) {
    console.error("Error processing web referral:", err);
  }
}
