// popup.js
document.addEventListener("DOMContentLoaded", () => {
  const matchList = document.getElementById("match-list");
  const PLACEHOLDER_IMAGE = "images/placeholder.svg"; // Local path to your SVG
  const HLTV_URL = "https://www.hltv.org/matches"; // Main HLTV matches page

  // Function to format date and time
  const formatDateTime = (dateTimeString, lang = "en") => {
    const matchDate = new Date(dateTimeString);

    // Use 24-hour format for Romanian and 12-hour format for English
    if (lang === "ro") {
      return matchDate.toLocaleTimeString("ro-RO", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false // 24-hour format
      });
    } else {
      return matchDate.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      });
    }
  };

  const translations = {
    ro: {
      days: ["Duminică", "Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă"],
      today: "Astăzi",
      tomorrow: "Mâine"
    },
    en: {
      days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      today: "Today",
      tomorrow: "Tomorrow"
    }
  };

  // Function to handle image errors
  function setupImageHandlers() {
    const teamLogos = document.querySelectorAll('.team-logo');
    teamLogos.forEach(img => {
      // Handle successful loads
      img.addEventListener('load', function () {
        const logoUrl = this.src;
        if (logoUrl.includes('teemo.uk')) {
          const logoId = logoUrl.split('/').pop();
          console.log(`[function setupImageHandlers] Image loaded successfully: ${logoId}`);

          // Check if we already have it cached
          const cacheKey = `logo_${logoId}`;
          chrome.storage.local.get(cacheKey, (result) => {
            if (!result[cacheKey]) {
              console.log(`[function setupImageHandlers] Capturing successfully loaded image: ${logoId}`);
              // Capture the image to the cache by creating a canvas
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              canvas.width = this.naturalWidth;
              canvas.height = this.naturalHeight;
              ctx.drawImage(this, 0, 0);

              try {
                const dataURL = canvas.toDataURL('image/png');
                saveImageToCache(logoUrl, dataURL);
              } catch (e) {
                console.error(`❌ Error capturing image: ${e.message}`);
              }
            }
          });
        }
      });

      // Handle load errors
      img.addEventListener('error', function () {
        if (this.src !== PLACEHOLDER_IMAGE && this.src.includes('teemo.uk')) {
          console.log(`[function setupImageHandlers] Image load error: ${this.src.split('/').pop()}`);
          this.src = PLACEHOLDER_IMAGE;
        }
      });
    });
  }

  // Function to determine if a match should be treated as live
  const isMatchLive = (match) => {
    // If the match comes from live_matches array, it's live
    if (match._status === "live") {
      return true;
    }

    // If API explicitly says it's in progress
    if (match.status && match.status.type === "inprogress") {
      return true;
    }

    // For backward compatibility with older format
    if (match.status === "live" || match.status === "finished") {
      return true;
    }

    // If the scheduled start time has passed, consider it live
    let startTime;
    if (match.startTimestamp) {
      startTime = new Date(match.startTimestamp * 1000);
    } else if (match.start_time) {
      startTime = new Date(match.start_time);
    } else if (match.startDate) {
      startTime = new Date(match.startDate);
    } else {
      startTime = new Date(0);
    }

    const currentTime = new Date();
    const timeDifference = currentTime - startTime; // in milliseconds

    // If start time was more than 5 minutes ago and less than 3 hours ago, consider it live
    const isLive = timeDifference > 5 * 60 * 1000 && timeDifference < 3 * 60 * 60 * 1000;

    return isLive;
  };

  // Helper function to get team name from different API formats
  const getTeamName = (team) => {
    if (!team) return "Unknown";
    return team.name || team.nameCode || "Unknown";
  };

  // Helper function to get team logo from different API formats
  const getTeamLogo = async (team) => {
    if (!team) return PLACEHOLDER_IMAGE;

    // New API format with logo object from teemo.uk
    if (team.logo && team.logo.path) {
      const logoUrl = `https://teemo.uk${team.logo.path}`;
      const logoId = logoUrl.split('/').pop();
      const cacheKey = `logo_${logoId}`;

      // Check if logo is in cache
      const cachedResult = await new Promise(resolve => {
        chrome.storage.local.get(cacheKey, (result) => {
          resolve(result[cacheKey]);
        });
      });

      if (cachedResult) {
        console.log(`[const getTeamLogo] Loading logo from cache: ${logoId}`);
        return cachedResult;
      }

      console.log(`🌐 Logo not in cache, will attempt to fetch and cache: ${logoId}`);
      // Return the URL for now, but start the cache process in the background
      fetchAndCacheLogo(logoUrl);
      return logoUrl;
    }

    return PLACEHOLDER_IMAGE;
  };

  function fetchAndCacheLogo(logoUrl) {
    const logoId = logoUrl.split('/').pop();
    console.log(`[function fetchAndCacheLogo] Attempting to fetch logo: ${logoId}`);

    fetch(logoUrl)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Network response not ok: ${response.status}`);
        }
        return response.blob();
      })
      .then(blob => {
        // Convert blob to base64
        const reader = new FileReader();
        reader.onloadend = () => {
          // Save the base64 data to cache
          saveImageToCache(logoUrl, reader.result);
        };
        reader.readAsDataURL(blob);
      })
      .catch(error => {
        console.log(`❌ Failed to fetch logo: ${logoId}`, error.message);
      });
  }

  function saveImageToCache(logoUrl, base64Data) {
    const logoId = logoUrl.split('/').pop(); // Extract logo ID from URL
    const cacheKey = `logo_${logoId}`;

    console.log(`📦 Attempting to cache: ${logoId}`);

    chrome.storage.local.set({ [cacheKey]: base64Data }, () => {
      if (chrome.runtime.lastError) {
        console.error(`❌ Error saving to cache: ${chrome.runtime.lastError.message}`);
      } else {
        console.log(`[function saveImageToCache] Successfully saved to cache: ${logoId}`);
      }
    });
  }

  // Function to get match identifier from different API formats
  const getMatchIdentifier = (match) => {
    // If there's a match_id or id, use it
    if (match.match_id) return match.match_id;
    if (match.id) return match.id;

    // Otherwise create an identifier using team names
    const homeTeam = match.homeTeam ? getTeamName(match.homeTeam) : match.home_team_name || "unknown";
    const awayTeam = match.awayTeam ? getTeamName(match.awayTeam) : match.away_team_name || "unknown";
    const startTime = match.startTimestamp || match.start_time || match.startDate || Date.now();

    return `${homeTeam}-${awayTeam}-${startTime}`;
  };

  // Function to get tournament/event name
  const formatEventName = (match) => {
    if (match.tournament && match.tournament.uniqueTournament && match.season) {
      return `${match.tournament.uniqueTournament.name} ${match.season.name.replace(/\b20\d{2}\b/, "").trim()}`;
    }

    return "Unknown Event";
  };

  // Function to format date for headers
  const formatDateHeader = (timestamp, lang = "en") => {
    // Use the appropriate translation based on language
    const t = translations[lang] || translations.en;

    // Convert timestamp to Date object
    const matchDate = new Date(timestamp * 1000);
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    // Reset hours to compare just the date
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const tomorrowDate = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
    const matchDay = new Date(matchDate.getFullYear(), matchDate.getMonth(), matchDate.getDate());

    // Get day name using the translation
    const dayName = t.days[matchDay.getDay()];

    // Format the date according to the language
    let formattedDate;
    if (lang === "ro") {
      // Romanian format: DD.MM.YYYY
      const day = matchDay.getDate().toString().padStart(2, '0');
      const month = (matchDay.getMonth() + 1).toString().padStart(2, '0');
      const year = matchDay.getFullYear();
      formattedDate = `${day}.${month}.${year}`;
    } else {
      // Default format: YYYY-MM-DD
      formattedDate = matchDay.toISOString().split('T')[0];
    }

    if (matchDay.getTime() === todayDate.getTime()) {
      return `${t.today} - ${formattedDate}`;
    } else if (matchDay.getTime() === tomorrowDate.getTime()) {
      return `${t.tomorrow}, ${dayName} - ${formattedDate}`;
    } else {
      return `${dayName} - ${formattedDate}`;
    }
  };

  // Function to get match date/timestamp from different API formats
  const getMatchTimestamp = (match) => {
    if (match.startTimestamp) return match.startTimestamp;
    if (match.start_time) return new Date(match.start_time).getTime() / 1000;
    if (match.startDate) return new Date(match.startDate).getTime() / 1000;
    return Date.now() / 1000;
  };

  // Function to update UI with matches data
  const updateUI = async (data) => {
    console.log("Data received:", data);

    // Check if data is completely missing or undefined
    if (!data) {
      // Show error screen for no data
      matchList.innerHTML = generateConnectionErrorHTML();
      setupRetryButton();
      return;
    }

    // Get the language from the API response, default to "en"
    const language = data.lang || "en";
    console.log(`Using language: ${language}`);

    // Get live and upcoming matches
    const liveMatches = data.live_matches || [];
    const upcomingMatches = data.upcoming_matches || [];

    console.log("Live matches:", liveMatches.length);
    console.log("Upcoming matches:", upcomingMatches.length);

    // If both arrays exist but are empty, show the "No Matches Found" screen
    if (Array.isArray(liveMatches) && Array.isArray(upcomingMatches) &&
      liveMatches.length === 0 && upcomingMatches.length === 0) {
      matchList.innerHTML = generateNoMatchesHTML();
      setupBackgroundSyncCountdown();
      return;
    }

    // Process live matches first
    const displayMatches = [];
    const processedIds = new Set();

    // Add all live matches first
    liveMatches.forEach(match => {
      const id = getMatchIdentifier(match);
      match._status = "live"; // Ensure status is marked as live
      displayMatches.push(match);
      processedIds.add(id);
    });

    // Add upcoming matches, marking them as live if they should be
    upcomingMatches.forEach(match => {
      const id = getMatchIdentifier(match);
      if (!processedIds.has(id)) {
        // Check if this match should be treated as live based on start time
        if (isMatchLive(match)) {
          match._status = "live"; // Mark it as live
        }
        displayMatches.push(match);
        processedIds.add(id);
      }
    });

    // Ensure live matches are at the top and upcoming are sorted by time
    displayMatches.sort((a, b) => {
      // Live matches always come first
      if (isMatchLive(a) && !isMatchLive(b)) return -1;
      if (!isMatchLive(a) && isMatchLive(b)) return 1;

      // If both are upcoming, sort by start time
      const getStartTime = (match) => {
        if (match.startTimestamp) return match.startTimestamp * 1000;
        if (match.start_time) return new Date(match.start_time).getTime();
        if (match.startDate) return new Date(match.startDate).getTime();
        return 0;
      };

      return getStartTime(a) - getStartTime(b);
    });

    // Limit to 50 matches
    const limitedMatches = displayMatches.slice(0, 50);

    // Group matches by date
    const matchesByDate = {};

    limitedMatches.forEach(match => {
      const timestamp = getMatchTimestamp(match);
      const matchDate = new Date(timestamp * 1000);
      // Create a date string without time to use as key
      const dateKey = matchDate.toISOString().split('T')[0];

      if (!matchesByDate[dateKey]) {
        matchesByDate[dateKey] = [];
      }

      matchesByDate[dateKey].push(match);
    });

    // Generate HTML for each date group
    let matchesHTML = [];

    // Sort dates chronologically
    const sortedDates = Object.keys(matchesByDate).sort();

    for (const dateKey of sortedDates) {
      const matches = matchesByDate[dateKey];
      const firstMatch = matches[0];
      // Pass the language to formatDateHeader
      const dateHeader = formatDateHeader(getMatchTimestamp(firstMatch), language);

      // Add date header
      matchesHTML.push(`
        <div class="date-separator">
          <div class="date-line"></div>
          <div class="date-text">${dateHeader}</div>
          <div class="date-line"></div>
        </div>
      `);

      // Add matches for this date
      const dateMatchPromises = matches.map(async (match) => {
        // Get team names
        const homeTeamName = match.homeTeam ? getTeamName(match.homeTeam) : match.home_team_name || "Unknown";
        const awayTeamName = match.awayTeam ? getTeamName(match.awayTeam) : match.away_team_name || "Unknown";

        // Get team logos with caching
        const homeTeamLogo = match.homeTeam ? await getTeamLogo(match.homeTeam) : PLACEHOLDER_IMAGE;
        const awayTeamLogo = match.awayTeam ? await getTeamLogo(match.awayTeam) : PLACEHOLDER_IMAGE;

        // Get event name
        const eventName = formatEventName(match);

        // Determine if match is live based on our enhanced logic
        const isLive = isMatchLive(match);

        // Get match time
        let matchTime = "Time Unknown";
        if (isLive) {
          matchTime = language === "ro" ? "Live" : "Live"; // Same in both languages
        } else if (match.startTimestamp) {
          matchTime = formatDateTime(new Date(match.startTimestamp * 1000), language);
        } else if (match.start_time) {
          matchTime = formatDateTime(match.start_time, language);
        } else if (match.startDate) {
          matchTime = formatDateTime(match.startDate, language);
        }

        // Check if either team has high userCount (> 1000)
        const homeTeamUserCount = match.homeTeam && match.homeTeam.userCount ? match.homeTeam.userCount : 0;
        const awayTeamUserCount = match.awayTeam && match.awayTeam.userCount ? match.awayTeam.userCount : 0;
        const isPopularMatch = homeTeamUserCount > 500 || awayTeamUserCount > 500;

        // Build CSS classes
        let matchClass = "list-group-item list-group-item-dark";

        if (isLive) {
          matchClass += " live-match";
        }

        if (isPopularMatch) {
          matchClass += " popular-team";
        }

        return `
          <a href="${HLTV_URL}" target="_blank" class="${matchClass}">
            <div class="d-flex w-100 justify-content-between">
              <div>
                <div class="event-name">${eventName}</div>
                <div class="team">
                  <img src="${homeTeamLogo}" alt="${homeTeamName}" class="team-logo">
                  <span class="team-name">${homeTeamName}</span>
                </div>
                <div class="team">
                  <img src="${awayTeamLogo}" alt="${awayTeamName}" class="team-logo">
                  <span class="team-name">${awayTeamName}</span>
                </div>
              </div>
              <small class="match-time">${matchTime}</small>
            </div>
          </a>
        `;
      });

      const dateMatchesHTML = await Promise.all(dateMatchPromises);
      matchesHTML = matchesHTML.concat(dateMatchesHTML);
    }

    matchList.innerHTML = matchesHTML.join("");

    // Add error handlers to images after they're in the DOM
    setupImageHandlers();

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

    handleConsecutivePopularMatches();
  };

  // Retrieve data from Chrome's storage
  chrome.storage.local.get("matchesData", (result) => {
    console.log("Retrieved from storage:", result);
    updateUI(result.matchesData);
  });

  function handleConsecutivePopularMatches() {
    // Get all popular team matches
    const popularMatches = document.querySelectorAll('.popular-team');

    // If we have at least 2 popular matches
    if (popularMatches.length >= 2) {
      // Track which matches we've processed
      const processedMatches = new Set();

      // For each popular match
      for (let i = 0; i < popularMatches.length; i++) {
        // Skip if already processed
        if (processedMatches.has(popularMatches[i])) continue;

        // Start a new group
        const group = [popularMatches[i]];
        processedMatches.add(popularMatches[i]);

        // Find consecutive matches
        let currentMatch = popularMatches[i];

        // Keep checking for next matches
        for (let j = i + 1; j < popularMatches.length; j++) {
          const nextMatch = popularMatches[j];

          // Skip if already processed
          if (processedMatches.has(nextMatch)) continue;

          // Check if they're close to each other in the DOM (max 2 elements between)
          let isConsecutive = false;
          let elementsBetween = 0;
          let tempElement = currentMatch;

          // Check up to 3 elements ahead (allowing for 2 elements between matches)
          for (let step = 0; step < 3; step++) {
            if (!tempElement.nextElementSibling) break;
            tempElement = tempElement.nextElementSibling;

            if (tempElement === nextMatch) {
              isConsecutive = true;
              break;
            }
            elementsBetween++;
          }

          if (isConsecutive) {
            // Add to group
            group.push(nextMatch);
            processedMatches.add(nextMatch);
            currentMatch = nextMatch; // Update current match for next iteration
          }
        }

        // If we have a group of at least 2 consecutive popular matches
        if (group.length >= 2) {
          console.log(`Created group with ${group.length} matches`); // Debug

          // Create a container for the group
          const container = document.createElement('div');
          container.className = 'popular-matches-group';

          // Get the first match in group
          const firstMatch = group[0];

          // Insert the container before the first match
          firstMatch.parentNode.insertBefore(container, firstMatch);

          // Move all matches in the group into the container
          group.forEach(match => {
            // Remove the individual popular styling
            match.classList.remove('popular-team');
            match.style.border = 'none';
            match.style.borderBottom = '1px solid #333';

            // Move to the container
            container.appendChild(match);
          });
        }
      }
    }
  }

  //? Helper Functions
  // Generate HTML for connection error
  function generateConnectionErrorHTML() {
    return `
    <div class="error-container">
      <div class="error-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 4C7.58172 4 4 7.58172 4 12C4 16.4183 7.58172 20 12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4Z" stroke="#ff4655" stroke-width="2"/>
          <path d="M12 8V12" stroke="#ff4655" stroke-width="2" stroke-linecap="round"/>
          <circle cx="12" cy="15" r="1" fill="#ff4655"/>
        </svg>
      </div>
      <h3 class="error-title">Connection Error</h3>
      <p class="error-message">We couldn't load the matches data right now.</p>
      <div class="error-actions">
        <button id="retry-button" class="retry-button">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="retry-icon">
            <path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C15.3019 3 18.1885 4.77814 19.7545 7.42909" stroke="white" stroke-width="2" stroke-linecap="round"/>
            <path d="M21 3V7H17" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Retry
        </button>
      </div>
    </div>
  `;
  }

  // Generate HTML for no matches found
  function generateNoMatchesHTML() {
    return `
    <div class="empty-container">
      <div class="empty-icon">
        <img src="icon.png" width="48" height="48" alt="No matches found">
      </div>
      <h3 class="empty-title">No Matches For Today</h3>
      <p class="empty-message">There are no upcoming or live matches at the moment.</p>
      <p class="empty-hint">Check back later for new matches</p>
      <div class="next-check">
        <span class="next-check-label">Next check:</span>
        <span class="next-check-time">-</span>
      </div>
    </div>
  `;
  }

  // Setup retry button event listener
  function setupRetryButton() {
    document.getElementById('retry-button').addEventListener('click', function () {
      // Request fresh data from background script
      chrome.runtime.sendMessage({ action: "fetchMatches" }, function (response) {
        console.log("Retry fetch response:", response);
      });
    });
  }

  // Setup countdown synced with background.js alarm
  function setupBackgroundSyncCountdown() {
    const nextCheckElement = document.querySelector('.next-check-time');

    // Get the next scheduled alarm time for fetchDataAlarm
    chrome.alarms.get("fetchDataAlarm", (alarm) => {
      if (!alarm) {
        nextCheckElement.textContent = "unknown";
        return;
      }

      // Calculate time until next alarm
      const now = Date.now();
      const nextAlarmTime = alarm.scheduledTime;
      let timeRemaining = Math.max(0, nextAlarmTime - now);

      updateCountdownDisplay(timeRemaining);

      // Update the countdown every second
      const countdownInterval = setInterval(() => {
        timeRemaining = Math.max(0, timeRemaining - 1000);

        if (timeRemaining <= 0) {
          clearInterval(countdownInterval);
          nextCheckElement.textContent = "Checking...";

          // Wait a bit for the background fetch to complete, then refresh our view
          setTimeout(() => {
            chrome.storage.local.get("matchesData", (result) => {
              updateUI(result.matchesData);
            });
          }, 2000);

          return;
        }

        updateCountdownDisplay(timeRemaining);
      }, 1000);
    });
  }

  // Helper function to format and display the countdown
  function updateCountdownDisplay(milliseconds) {
    const nextCheckElement = document.querySelector('.next-check-time');
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    nextCheckElement.textContent = `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
});