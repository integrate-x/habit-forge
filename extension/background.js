// MVP extension scaffold. Website blocking and scheduled opening will be added here.
chrome.runtime.onInstalled.addListener(()=>chrome.alarms.create('habit-forge-tick',{periodInMinutes:1}));
chrome.alarms.onAlarm.addListener(()=>console.log('Habit Forge scheduler tick'));
