function renderPodium(top3) {
  const container = document.getElementById("podium-container");
  if (!container) return;

  container.innerHTML = "";

  const displayOrder = [
    { rank: 2, data: top3[1], border: "border-gray-400", logo: LOGO_MAP.rank2, height: "h-40" },
    { rank: 1, data: top3[0], border: "border-yellow-400", logo: LOGO_MAP.rank1, height: "h-48" },
    { rank: 3, data: top3[2], border: "border-amber-700", logo: LOGO_MAP.rank3, height: "h-40" }
  ];

  displayOrder.forEach((item) => {
    const user = item.data || { name: "Miner", avatar: FALLBACK_AVATAR, balance: 0, streak: 0, referrals: 0 };
    const rawVal = user[currentTab] || 0;

    const card = document.createElement("div");
    // Added overflow-visible so top badges float cleanly above the card
    card.className = `card-bg rounded-2xl p-3 flex flex-col items-center justify-between text-center ${item.height} relative w-full overflow-visible`;

    card.innerHTML = `
      <div class="relative mt-3">
        <!-- Rank Badge Floating Crown -->
        <div class="absolute -top-4 left-1/2 -translate-x-1/2 w-7 h-7 z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
          <img src="${item.logo}" alt="Rank ${item.rank}" class="w-full h-full object-contain rounded-full border border-yellow-500/50 bg-[#0a0d0b]"/>
        </div>
        
        <!-- User Avatar Ring -->
        <div class="w-14 h-14 rounded-full border-2 ${item.border} overflow-hidden bg-[#0a0d0b] flex items-center justify-center shadow-inner">
          <img src="${user.avatar}" alt="${user.name}" class="w-full h-full object-cover" onerror="this.src='${FALLBACK_AVATAR}';">
        </div>
      </div>

      <div class="w-full truncate px-1 mt-1">
        <p class="font-bold text-xs text-white truncate">${user.name}</p>
        <p class="text-xs font-black text-[#00ff66] tracking-tight mt-0.5">${formatScore(rawVal)}</p>
        <p class="text-[9px] text-gray-500 uppercase">${getTabUnit()}</p>
      </div>
    `;

    container.appendChild(card);
  });
}
