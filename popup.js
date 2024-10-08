document.addEventListener("DOMContentLoaded", () => {
  const matchList = document.getElementById("match-list");

  // Attempt to load cached HTML content first
  const cachedHTML = localStorage.getItem("cachedMatchListHTML");
  if (cachedHTML) {
    matchList.innerHTML = cachedHTML;
    // Re-initialize any JavaScript-based UI enhancements here, if necessary
    new SimpleBar(matchList, { autoHide: false });
  }

  // Function to filter matches
  const filterMatches = (data, now) => {
    return data.filter((match) => {
      if (match.date === "Date not specified") {
        const recordDate = new Date(match.recordDate);
        const hoursDiff = (now - recordDate) / 3600000; // Convert milliseconds to hours

        // If the match has been recorded within the last 3 hours, it's considered live.
        return hoursDiff <= 3;
      } else {
        const matchDate = new Date(match.date);

        // Allow a 1-hour delay for matches that have started
        const oneHourInMs = 3600000;

        // Match should appear if it's within the next 24 hours or started in the last hour
        return now <= (matchDate.getTime() + oneHourInMs) && matchDate - now <= 86400000;
      }
    });
  };

  // Function to update data
  const updateData = () => {
    // Retrieve data from Chrome's storage
    chrome.storage.local.get("matchesData", (result) => {
      const data = result.matchesData;

      if (!data) {
        matchList.innerHTML = "<p>Error loading matches data.</p>";
        return;
      }

      // Limiting the matches to the first 20 entries
      const limitedData = data.slice(0, 20);
      const now = new Date(); // Use for both date comparison and recordDate comparison

      const filteredMatches = filterMatches(limitedData, now);

      if (filteredMatches.length === 0) {
        matchList.innerHTML =
          "<p>No matches today or upcoming live matches within the last hour.</p>";
        return;
      }

      matchList.innerHTML = filteredMatches
        .map((match) => {
          const team1Logo =
            match.team1Logo && match.team1Logo !== "Logo not available"
              ? match.team1Logo
              : "https://www.hltv.org/img/static/team/placeholder.svg";
          const team2Logo =
            match.team2Logo && match.team2Logo !== "Logo not available"
              ? match.team2Logo
              : "https://www.hltv.org/img/static/team/placeholder.svg";
          const eventName = match.event ? match.event : "Unknown Event";
          const localTime =
            match.date === "Date not specified"
              ? "Live"
              : new Date(match.date).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              });
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
        })
        .join("");

      // Cache the generated HTML in local storage
      localStorage.setItem("cachedMatchListHTML", matchList.innerHTML);

      // Get the scrollHeight of the element after populating it
      const contentHeight = matchList.scrollHeight;

      // Set max-height to the scrollHeight or a fixed maximum value (e.g., 500px)
      const maxHeight = Math.min(contentHeight, 500);

      // Dynamically set the max-height
      matchList.style.maxHeight = `${maxHeight}px`;

      // Re-initialize SimpleBar (retain the height setting)
      new SimpleBar(matchList, { autoHide: false });
    });
  };

  // Initial update
  updateData();
});
