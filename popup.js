// popup.js
document.addEventListener("DOMContentLoaded", () => {
  const matchList = document.getElementById("match-list");
  const PLACEHOLDER_IMAGE = "images/placeholder.svg"; // Local path to your SVG
  const HLTV_URL = "https://www.hltv.org/matches"; // Main HLTV matches page

  // Function to format date and time
  const formatDateTime = (dateTimeString) => {
    const matchDate = new Date(dateTimeString);
    return matchDate.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  // Function to handle image errors
  function setupImageErrorHandlers() {
    const teamLogos = document.querySelectorAll('.team-logo');
    teamLogos.forEach(img => {
      img.addEventListener('error', function () {
        this.src = PLACEHOLDER_IMAGE;
      });
    });
  }

  // Function to update UI with matches data
  const updateUI = (data) => {
    if (!data || (!data.live_matches && !data.upcoming_matches)) {
      matchList.innerHTML = "<p>Error loading matches data.</p>";
      return;
    }

    // Combine live and upcoming matches
    const allMatches = [
      ...(data.live_matches || []),
      ...(data.upcoming_matches || [])
    ];

    // Limit to 20 matches
    const limitedMatches = allMatches.slice(0, 20);

    if (limitedMatches.length === 0) {
      matchList.innerHTML = "<p>No matches available.</p>";
      return;
    }

    matchList.innerHTML = limitedMatches
      .map((match) => {
        // Use placeholder image if hash is missing or empty
        const homeTeamLogo = match.home_team_hash_image
          ? `https://images.sportdevs.com/${match.home_team_hash_image}.png`
          : PLACEHOLDER_IMAGE;

        const awayTeamLogo = match.away_team_hash_image
          ? `https://images.sportdevs.com/${match.away_team_hash_image}.png`
          : PLACEHOLDER_IMAGE;

        const leagueName = match.league_name || "Unknown League";
        const tournamentName = match.tournament_name || "";

        const matchTime = match.status === "live"
          ? "Live"
          : formatDateTime(match.start_time);

        return `
          <a href="${HLTV_URL}" target="_blank" class="list-group-item list-group-item-dark">
            <div class="d-flex w-100 justify-content-between">
              <div>
                <div class="event-name">${leagueName} - ${tournamentName}</div>
                <div class="team">
                  <img src="${homeTeamLogo}" alt="${match.home_team_name}" class="team-logo">
                  <span class="team-name">${match.home_team_name}</span>
                </div>
                <div class="team">
                  <img src="${awayTeamLogo}" alt="${match.away_team_name}" class="team-logo">
                  <span class="team-name">${match.away_team_name}</span>
                </div>
              </div>
              <small class="match-time">${matchTime}</small>
            </div>
          </a>
        `;
      })
      .join("");

    // Add error handlers to images after they're in the DOM
    setupImageErrorHandlers();

    // Get the scrollHeight of the element after populating it
    const contentHeight = matchList.scrollHeight;

    // Set max-height to the scrollHeight or a fixed maximum value (e.g., 500px)
    const maxHeight = Math.min(contentHeight, 500);

    // Dynamically set the max-height
    matchList.style.maxHeight = `${maxHeight}px`;

    // Re-initialize SimpleBar if you're still using it
    if (typeof SimpleBar !== 'undefined') {
      new SimpleBar(matchList, { autoHide: false });
    }
  };

  // Retrieve data from Chrome's storage
  chrome.storage.local.get("matchesData", (result) => {
    updateUI(result.matchesData);
  });
});