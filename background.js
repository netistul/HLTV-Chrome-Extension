// background.js
function fetchDataAndStore() {
  console.log('Attempting to fetch data...');  // Debugging line
  
  fetch('https://azi.blob.core.windows.net/hltv/matches.json')
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');  // New error handling
      }
      return response.json();
    })
    .then(data => {
      console.log('Data fetched:', data);  // Debugging line
      chrome.storage.local.set({ matchesData: data }, () => {
        console.log('Data fetched and stored.');
        
        // Count the number of live matches
        const liveMatchesCount = data.filter(match => match.date === "Date not specified").length;
        
        // Update the badge
        chrome.action.setBadgeText({text: liveMatchesCount.toString()});
        chrome.action.setBadgeBackgroundColor({color: '#2b6ea4'});
        
        // Send a message to popup.js to let it know that new data is available
        chrome.runtime.sendMessage({message: 'data_updated'}, function(response) {
          if (chrome.runtime.lastError) {
            console.warn(chrome.runtime.lastError.message);
          } else {
            // Handle the response or do other things.
          }
        });
      });
    })
    .catch(error => {
      console.error('Error fetching data:', error);
    });
}


// Event listener for the install event
self.addEventListener('install', (event) => {
  console.log('Service Worker installing.');
  fetchDataAndStore();
});

// Event listener for the activate event
self.addEventListener('activate', (event) => {
  console.log('Service Worker activated.');
  fetchDataAndStore();
});

// Create an alarm that fires every 1 minute
chrome.alarms.create('fetchDataAlarm', { periodInMinutes: 1 });

// Set up an alarm listener
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'fetchDataAlarm') {
    fetchDataAndStore();
  }
});

// Add this line to fetch data when Chrome starts up
chrome.runtime.onStartup.addListener(() => {
  fetchDataAndStore();
});

