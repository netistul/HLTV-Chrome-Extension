function fetchDataAndStore() {
  console.log("Attempting to fetch data...");

  fetch(
    `https://example.blob.core.windows.net/hltv/matches.json?timestamp=${new Date().getTime()}`
  )
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.json();
    })
    .then((data) => {
      console.log("Data fetched:", data);
      chrome.storage.local.set({ matchesData: data }, () => {
        console.log("Data fetched and stored.");

        // Calculate live matches count
        const liveMatchesCount = data.filter((match) => {
          if (match.date === "Date not specified") {
            const now = new Date();
            const recordDate = new Date(match.recordDate);
            const hoursDiff = (now - recordDate) / 3600000; // Convert milliseconds to hours
            return hoursDiff <= 3; // Include if recordDate is less than or equal to 3 hours old
          }
          return false;
        }).length;

        // Update the badge
        if (liveMatchesCount > 0) {
          chrome.action.setBadgeText({ text: liveMatchesCount.toString() });
          chrome.action.setBadgeBackgroundColor({ color: "#2b6ea4" });
        } else {
          chrome.action.setBadgeText({ text: "" }); // Clear badge when liveMatchesCount is 0
        }
      });
    })
    .catch((error) => {
      console.error("Error fetching data:", error);
    });
}

// Event listener for the install event
self.addEventListener("install", (event) => {
  console.log("Service Worker installing.");
  fetchDataAndStore();
});

// Event listener for the activate event
self.addEventListener("activate", (event) => {
  console.log("Service Worker activated.");
  fetchDataAndStore();
});

// Create an alarm that fires every 10 minutes
chrome.alarms.get("fetchDataAlarm", (alarm) => {
  if (!alarm) {
    chrome.alarms.create("fetchDataAlarm", { periodInMinutes: 10 });
  }
});

// Set up an alarm listener
chrome.alarms.onAlarm.addListener((alarm) => {
  console.log("Alarm fired:", alarm.name);
  if (alarm.name === "fetchDataAlarm") {
    fetchDataAndStore();
  }
});

// Fetch data when Chrome starts up
chrome.runtime.onStartup.addListener(() => {
  fetchDataAndStore();
});