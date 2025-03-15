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

  // Function to determine if a match should be treated as live
  const isMatchLive = (match) => {
    // If API explicitly says it's live, trust that
    if (match._status === "live" || match.status === "live") {
      console.log(`Match ${match.home_team_name} vs ${match.away_team_name} is live by API status`);
      return true;
    }

    // If API says it's finished, we should still display it as "live"
    if (match.status === "finished") {
      console.log(`Match ${match.home_team_name} vs ${match.away_team_name} is finished but marking as live`);
      return true;
    }

    // If the scheduled start time has passed, consider it live
    const scheduledTime = new Date(match.start_time || 0);
    const currentTime = new Date();
    const timeDifference = currentTime - scheduledTime; // in milliseconds

    // If start time was more than 5 minutes ago and less than 3 hours ago, consider it live
    const isLive = timeDifference > 5 * 60 * 1000 && timeDifference < 3 * 60 * 60 * 1000;

    if (isLive) {
      console.log(`Match ${match.home_team_name} vs ${match.away_team_name} marked as LIVE based on time`);
    }

    return isLive;
  };

  // Function to update UI with matches data
  const updateUI = (data) => {
    console.log("Data received:", data);

    if (!data || (!data.live_matches && !data.upcoming_matches)) {
      matchList.innerHTML = "<p>Error loading matches data.</p>";
      return;
    }

    // Get live and upcoming matches
    const liveMatches = data.live_matches || [];
    const upcomingMatches = data.upcoming_matches || [];

    console.log("Live matches:", liveMatches.length);
    console.log("Upcoming matches:", upcomingMatches.length);

    // Create a unique identifier function in case match_id is not available
    const getMatchIdentifier = (match) => {
      // If there's a match_id, use it
      if (match.match_id) return match.match_id;

      // Otherwise create an identifier using team names
      return `${match.home_team_name || ""}-${match.away_team_name || ""}-${match.start_time || ""}`;
    };

    // Process live matches first
    const displayMatches = [];
    const processedIds = new Set();

    // Add all live matches first
    liveMatches.forEach(match => {
      const id = getMatchIdentifier(match);
      match._status = "live"; // Ensure status is marked as live
      displayMatches.push(match);
      processedIds.add(id);
      console.log("Added live match:", id);
    });

    // Add upcoming matches, marking them as live if they should be
    upcomingMatches.forEach(match => {
      const id = getMatchIdentifier(match);
      if (!processedIds.has(id)) {
        // Check if this match should be treated as live based on start time
        if (isMatchLive(match)) {
          match._status = "live"; // Mark it as live
          console.log("Marked upcoming match as live based on start time:", id);
        }
        displayMatches.push(match);
        processedIds.add(id);
      } else {
        console.log("Skipped duplicate match:", id);
      }
    });

    // Ensure live matches are at the top and upcoming are sorted by time
    displayMatches.sort((a, b) => {
      // Live matches always come first
      if (isMatchLive(a) && !isMatchLive(b)) return -1;
      if (!isMatchLive(a) && isMatchLive(b)) return 1;

      // If both are upcoming, sort by start time
      return new Date(a.start_time || 0) - new Date(b.start_time || 0);
    });

    console.log("Display matches after processing:", displayMatches.length);

    // Log the first few matches to verify order
    displayMatches.slice(0, 5).forEach((m, i) => {
      console.log(`Match ${i}: ${isMatchLive(m) ? "LIVE" : "UPCOMING"} - ${m.home_team_name} vs ${m.away_team_name}`);
    });

    // Limit to 20 matches
    const limitedMatches = displayMatches.slice(0, 20);

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

        const formatEventName = (match) => {
          const league = match.league_name || "Unknown League";
          const season = match.season_name || "";

          // If we have both league and season, format as "ESEA Advanced Season 52 North America"
          if (league && season) {
            // Convert "Advance North America season 52 2025" to "Advanced Season 52 North America"
            const formattedSeason = season
              .replace(/advance/i, "Advanced")
              .replace(/season/i, "Season");

            return `${league} ${formattedSeason}`;
          }

          // Fallback if any information is missing
          return league;
        };

        // Determine if match is live based on our enhanced logic
        const isLive = isMatchLive(match);
        const matchTime = isLive ? "Live" : formatDateTime(match.start_time);

        // Add a CSS class for live matches to style them differently
        const matchClass = isLive
          ? "list-group-item list-group-item-dark live-match"
          : "list-group-item list-group-item-dark";

        return `
          <a href="${HLTV_URL}" target="_blank" class="${matchClass}">
            <div class="d-flex w-100 justify-content-between">
              <div>
                <div class="event-name">${formatEventName(match)}</div>
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
    console.log("Retrieved from storage:", result);
    updateUI(result.matchesData);
  });
});