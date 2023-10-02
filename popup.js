document.addEventListener("DOMContentLoaded", function() {
  const matchList = document.getElementById("match-list");

  // Function to update data
  function updateData() {
    // Retrieve data from Chrome's storage
    chrome.storage.local.get('matchesData', function(result) {
      const data = result.matchesData;

      if (!data) {
        matchList.innerHTML = "<p>Error loading matches data.</p>";
        return;
      }

      // Limiting the matches to the first 20 entries
      const limitedData = data.slice(0, 20);
      const today = new Date();
      const msPerDay = 24 * 60 * 60 * 1000;

      const matchesWithin24Hrs = limitedData.filter(match => {
        if (match.date === "Date not specified") return true; // Treat "Date not specified" as live matches
        const matchDate = new Date(match.date);
        const timeDifference = matchDate.getTime() - today.getTime();
        return timeDifference >= 0 && timeDifference <= msPerDay;
      });

      if (matchesWithin24Hrs.length === 0) {
        matchList.innerHTML = "<p>No matches today.</p>";
        return;
      }

      matchList.innerHTML = matchesWithin24Hrs.map(match => {
        const team1Logo = (match.team1Logo && match.team1Logo !== "Logo not available") ? match.team1Logo : 'https://www.hltv.org/img/static/team/placeholder.svg';
        const team2Logo = (match.team2Logo && match.team2Logo !== "Logo not available") ? match.team2Logo : 'https://www.hltv.org/img/static/team/placeholder.svg';
        const eventName = match.event ? match.event : "Unknown Event";
        const localTime = match.date === "Date not specified" ? "Live" : new Date(match.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const matchLink = match.matchLink ? match.matchLink : "#";

        return `
          <a href="${matchLink}" target="_blank" class="list-group-item list-group-item-dark">
            <div class="d-flex w-100 justify-content-between">
              <div>
                <div class="event-name">${eventName}</div>
                <div class="team">
                  <img src="${team1Logo}" alt="${match.team1}" class="team-logo">
                  <span class="team-name">${match.team1}</span>
                </div>
                <div class="team">
                  <img src="${team2Logo}" alt="${match.team2}" class="team-logo">
                  <span class="team-name">${match.team2}</span>
                </div>
              </div>
              <small class="match-time">${localTime}</small>
            </div>
          </a>
        `;
      }).join('');

      // Cache the generated HTML in local storage
      localStorage.setItem('cachedMatchListHTML', matchList.innerHTML);

      // Get the scrollHeight of the element after populating it
      const contentHeight = matchList.scrollHeight;

      // Set max-height to the scrollHeight or a fixed maximum value (e.g., 500px)
      const maxHeight = Math.min(contentHeight, 500);

      // Dynamically set the max-height
      matchList.style.maxHeight = `${maxHeight}px`;

      // Initialize SimpleBar (retain the height setting)
      new SimpleBar(matchList, { autoHide: false });
    });
  }


  // Initial update
  updateData();

  // Listen for messages from background.js
  chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
      if (request.message === 'data_updated') {
        // Fetch new data from chrome.storage.local
        updateData();
      }
    }
  );
});
