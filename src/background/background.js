import { matchesUrl, parseRules } from "./rules.js";

let rules = [];

function loadRules() {
    chrome.storage.local.get(["blockedSites"], (data) => {
        rules = parseRules(data.blockedSites || []);
    });
}

chrome.storage.onChanged.addListener(loadRules);
loadRules();

// =====================
// BLOCKING
// =====================
chrome.webNavigation.onBeforeNavigate.addListener((details) => {

    if (details.frameId !== 0) return;

    if (matchesUrl(details.url, rules)) {
        chrome.tabs.update(details.tabId, {
            url: chrome.runtime.getURL("src/blocked/block.html")
        });
    }

});
