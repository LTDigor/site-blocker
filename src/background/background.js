import {
    buildDeclarativeNetRequestRules,
    getNextTemporaryUnblockExpiry,
    pruneExpiredTemporaryUnblocks
} from "./rules.js";
import {
    extensionAlarms,
    extensionDeclarativeNetRequest,
    extensionEvents,
    extensionStorage
} from "../shared/extension-api.js";

const BLOCKED_SITES_KEY = "blockedSites";
const TEMPORARY_UNBLOCKS_KEY = "temporaryUnblocks";
const BLOCKED_PAGE_PATH = "/src/blocked/block.html";
const TEMPORARY_UNBLOCK_ALARM = "temporary-unblock-expired";

async function loadRules() {
    const data = await extensionStorage.local.get([BLOCKED_SITES_KEY, TEMPORARY_UNBLOCKS_KEY]);
    const temporaryUnblocks = data[TEMPORARY_UNBLOCKS_KEY] || {};
    const activeTemporaryUnblocks = pruneExpiredTemporaryUnblocks(temporaryUnblocks);

    if (!areSameTemporaryUnblocks(temporaryUnblocks, activeTemporaryUnblocks)) {
        await extensionStorage.local.set({ [TEMPORARY_UNBLOCKS_KEY]: activeTemporaryUnblocks });
    }

    await updateBlockingRules(data[BLOCKED_SITES_KEY] || [], activeTemporaryUnblocks);
    await scheduleTemporaryUnblockRefresh(activeTemporaryUnblocks);
}

async function applyTemporaryUnblock(site, expiresAt) {
    if (!site || !Number.isFinite(expiresAt)) {
        throw new Error("Invalid temporary unblock request");
    }

    const data = await extensionStorage.local.get([BLOCKED_SITES_KEY, TEMPORARY_UNBLOCKS_KEY]);
    const blockedSites = data[BLOCKED_SITES_KEY] || [];
    const temporaryUnblocks = pruneExpiredTemporaryUnblocks(data[TEMPORARY_UNBLOCKS_KEY] || {});
    const activeTemporaryUnblocks = {
        ...temporaryUnblocks,
        [site]: expiresAt
    };

    await extensionStorage.local.set({ [TEMPORARY_UNBLOCKS_KEY]: activeTemporaryUnblocks });
    await updateBlockingRules(blockedSites, activeTemporaryUnblocks);
    await scheduleTemporaryUnblockRefresh(activeTemporaryUnblocks);
}

async function updateBlockingRules(rawRules, temporaryUnblocks = {}) {
    try {
        const rules = buildDeclarativeNetRequestRules(rawRules, BLOCKED_PAGE_PATH, temporaryUnblocks);
        const supportedRules = await filterSupportedRules(rules);
        const existingRules = await extensionDeclarativeNetRequest.getDynamicRules();

        await extensionDeclarativeNetRequest.updateDynamicRules({
            removeRuleIds: existingRules.map((rule) => rule.id),
            addRules: supportedRules
        });
    } catch (error) {
        console.error("Failed to update blocking rules:", error);
    }
}

async function scheduleTemporaryUnblockRefresh(temporaryUnblocks) {
    if (!extensionAlarms.clear || !extensionAlarms.create) return;

    try {
        await extensionAlarms.clear(TEMPORARY_UNBLOCK_ALARM);
        const nextExpiry = getNextTemporaryUnblockExpiry(temporaryUnblocks);

        if (!nextExpiry) return;

        await extensionAlarms.create(TEMPORARY_UNBLOCK_ALARM, {
            delayInMinutes: Math.max(0.1, (nextExpiry - Date.now() + 100) / 60000)
        });
    } catch (error) {
        console.warn("Failed to schedule temporary unblock refresh:", error);
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
    return extensionDeclarativeNetRequest
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

extensionEvents.storage.onChanged.addListener((changes, areaName) => {
    if (
        areaName === "local" &&
        (changes[BLOCKED_SITES_KEY] || changes[TEMPORARY_UNBLOCKS_KEY])
    ) {
        loadRules();
    }
});

extensionEvents.alarms.onAlarm?.addListener((alarm) => {
    if (alarm.name === TEMPORARY_UNBLOCK_ALARM) {
        loadRules();
    }
});

extensionEvents.runtime.onMessage?.addListener((message, sender, sendResponse) => {
    if (message?.type !== "temporaryUnblock") return false;

    applyTemporaryUnblock(message.site, message.expiresAt)
        .then(() => {
            sendResponse({ ok: true });
        })
        .catch((error) => {
            console.error("Failed to apply temporary unblock:", error);
            sendResponse({ ok: false, message: error.message || String(error) });
        });

    return true;
});

extensionEvents.runtime.onInstalled.addListener(loadRules);
extensionEvents.runtime.onStartup.addListener(loadRules);
loadRules();

function areSameTemporaryUnblocks(leftUnblocks, rightUnblocks) {
    const leftEntries = Object.entries(leftUnblocks);
    const rightEntries = Object.entries(rightUnblocks);

    return leftEntries.length === rightEntries.length &&
        leftEntries.every(([site, expiresAt]) => rightUnblocks[site] === expiresAt);
}
