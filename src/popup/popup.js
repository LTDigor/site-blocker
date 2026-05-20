import { getCurrentSiteFromUrl, normalizeStoredRules, validateRuleInput } from "./validation.js";

const input = document.getElementById("siteInput");
const form = document.getElementById("ruleForm");
const currentSiteButton = document.getElementById("currentSiteBtn");
const list = document.getElementById("list");
const counter = document.getElementById("counter");
const emptyState = document.getElementById("emptyState");
const formHint = document.getElementById("formHint");

const storage = globalThis.chrome?.storage?.local || createMemoryStorage();

function createMemoryStorage() {
    let state = { blockedSites: [] };

    return {
        get(keys, callback) {
            callback(Object.fromEntries(keys.map((key) => [key, state[key]])));
        },
        set(nextState, callback) {
            state = { ...state, ...nextState };
            callback?.();
        }
    };
}

function render(sites) {
    list.innerHTML = "";
    counter.textContent = sites.length;
    emptyState.classList.toggle("is-hidden", sites.length > 0);

    sites.forEach((site, index) => {
        const li = document.createElement("li");
        li.className = "rule-item";

        const ruleText = document.createElement("span");
        ruleText.className = "rule-text";
        ruleText.textContent = site;
        ruleText.title = site;

        const remove = document.createElement("button");
        remove.className = "remove-button";
        remove.type = "button";
        remove.textContent = "×";
        remove.setAttribute("aria-label", `Remove ${site}`);
        remove.title = "Remove rule";

        remove.onclick = () => {
            sites.splice(index, 1);
            save(sites);
            setHint("Rule removed.");
        };

        li.appendChild(ruleText);
        li.appendChild(remove);
        list.appendChild(li);
    });
}

function save(sites) {
    storage.set({ blockedSites: sites }, () => {
        render(sites);
    });
}

function setHint(message, isError = false) {
    formHint.textContent = message;
    formHint.classList.toggle("is-error", isError);
}

function saveRule(rule, successMessage, duplicateMessage) {
    storage.get(["blockedSites"], (data) => {
        const sites = data.blockedSites || [];

        if (sites.includes(rule)) {
            setHint(duplicateMessage, true);
            input.select();
            return;
        }

        sites.push(rule);
        save(sites);
        input.value = "";
        setHint(successMessage);
    });
}

form.onsubmit = (event) => {
    event.preventDefault();

    const validation = validateRuleInput(input.value);
    if (!validation.isValid) {
        setHint(validation.message, true);
        input.focus();
        return;
    }

    const site = validation.value;
    saveRule(site, "Rule added.", "This rule is already in the list.");
};

currentSiteButton.onclick = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const site = getCurrentSiteFromUrl(tabs?.[0]?.url);

        if (!site) {
            setHint("Open a regular website to add its current site.", true);
            return;
        }

        input.value = site;
        saveRule(site, "Current site added.", "This site is already in the list.");
    });
};

storage.get(["blockedSites"], (data) => {
    const sites = data.blockedSites || [];
    const normalizedSites = normalizeStoredRules(sites);

    if (!areSameRules(sites, normalizedSites)) {
        storage.set({ blockedSites: normalizedSites }, () => {
            render(normalizedSites);
        });
        return;
    }

    render(normalizedSites);
});

function areSameRules(leftRules, rightRules) {
    return leftRules.length === rightRules.length &&
        leftRules.every((rule, index) => rule === rightRules[index]);
}
