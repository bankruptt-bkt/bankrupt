import { db, auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.x.x/firebase-auth.js";
import { doc, getDoc, setDoc, runTransaction } from "https://www.gstatic.com/firebasejs/9.x.x/firebase-firestore.js";

const REFERRAL_REWARD = 100;
const MAX_REFERRALS = 10;

// 1. Run UI immediately so the link loads instantly on page load
setupWebReferralUI();

// 2. Auth Listener updates user-specific counts and processes incoming invites
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // Re-render UI with the user's specific UID
    setupWebReferralUI(user.uid);

    // Process incoming invite link (?ref=...)
    await handleIncomingWebReferral(user);

    // Fetch and display live referral stats
    const userSnap = await getDoc(doc(db, "users", user.uid));
    const refCount = userSnap.exists() ? (userSnap.data().referralCount || 0) : 0;
    
    const countDisplay = document.getElementById("ref-count-display");
    if (countDisplay) countDisplay.textContent = `${refCount} / ${MAX_REFERRALS}`;
  }
});

/**
 * Generates the web link immediately
 */
function setupWebReferralUI(userId = "guest") {
  const refInput = document.getElementById("referral-link");
  const copyBtn = document.getElementById("copy-ref-btn");

  // Generates link using site URL
  const inviteLink = `${window.location.origin}${window.location.pathname}?ref=${userId}`;

  if (refInput) refInput.value = inviteLink;

  if (copyBtn) {
    // Remove previous listeners to prevent duplicates
    const newCopyBtn = copyBtn.cloneNode(true);
    copyBtn.parentNode.replaceChild(newCopyBtn, copyBtn);

    newCopyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(inviteLink);
        alert("Referral link copied to clipboard!");
      } catch (err) {
        refInput.select();
        document.execCommand("copy");
        alert("Referral link copied!");
      }
    });
  }
}

/**
 * Handles processing ?ref= parameter in URL
 */
async function handleIncomingWebReferral(newUser) {
  const newUserRef = doc(db, "users", newUser.uid);
  const newUserSnap = await getDoc(newUserRef);

  if (newUserSnap.exists()) return;

  const urlParams = new URLSearchParams(window.location.search);
  const referrerId = urlParams.get("ref");

  if (!referrerId || referrerId === newUser.uid || referrerId === "guest") {
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

      transaction.set(newUserRef, {
        username: newUser.displayName || "Anonymous",
        balance: referrerEligible ? REFERRAL_REWARD : 0,
        referralCount: 0,
        referredBy: referrerId,
        createdAt: new Date()
      });

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
