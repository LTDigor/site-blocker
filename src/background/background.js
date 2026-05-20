import { buildDeclarativeNetRequestRules } from "./rules.js";

const BLOCKED_SITES_KEY = "blockedSites";
const BLOCKED_PAGE_PATH = "/src/blocked/block.html";

async function loadRules() {
    chrome.storage.local.get([BLOCKED_SITES_KEY], (data) => {
        updateBlockingRules(data[BLOCKED_SITES_KEY] || []);
    });
}

async function updateBlockingRules(rawRules) {
    try {
        const rules = buildDeclarativeNetRequestRules(rawRules, BLOCKED_PAGE_PATH);
        const supportedRules = await filterSupportedRules(rules);
        const existingRules = await chrome.declarativeNetRequest.getDynamicRules();

        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: existingRules.map((rule) => rule.id),
            addRules: supportedRules
        });
    } catch (error) {
        console.error("Failed to update blocking rules:", error);
    }
}

async function filterSupportedRules(rules) {
    const supportedRules = [];

    for (const rule of rules) {
        if (!rule.condition.regexFilter || await isRegexSupported(rule.condition.regexFilter)) {
            supportedRules.push(rule);
        }
    }

    return supportedRules;
}

function isRegexSupported(regex) {
    return chrome.declarativeNetRequest
        .isRegexSupported({
            regex,
            isCaseSensitive: true
        })
        .then((result) => {
            if (!result.isSupported) {
                console.warn("Skipped unsupported blocking regex:", regex, result.reason);
            }

            return result.isSupported;
        })
        .catch((error) => {
            console.warn("Skipped unsupported blocking regex:", regex, error);
            return false;
        });
}

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes[BLOCKED_SITES_KEY]) {
        loadRules();
    }
});

chrome.runtime.onInstalled.addListener(loadRules);
chrome.runtime.onStartup.addListener(loadRules);
loadRules();
