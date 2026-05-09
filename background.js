let rules = [];

function loadRules() {
    chrome.storage.local.get(["blockedSites"], (data) => {
        rules = (data.blockedSites || []).map(parseRule);
    });
}

chrome.storage.onChanged.addListener(loadRules);
loadRules();


// =====================
// PARSER
// =====================
function parseRule(rule) {

    rule = rule.trim().replace(/^https?:\/\//, "");

    const slashIndex = rule.indexOf("/");

    // ONLY DOMAIN
    if (slashIndex === -1 || rule.endsWith("/")) {
        return {
            domain: rule.replace(/\/$/, ""),
            type: "domain"
        };
    }

    const domain = rule.substring(0, slashIndex);
    const pathPart = rule.substring(slashIndex + 1);

    // REGEX PATH
    if (pathPart.startsWith("^")) {
        return {
            domain,
            type: "regex",
            regex: new RegExp(pathPart)
        };
    }

    // PREFIX PATH
    return {
        domain,
        type: "path",
        path: pathPart
    };
}


// =====================
// MATCHER
// =====================
function matches(urlString) {

    const url = new URL(urlString);

    return rules.some(rule => {

        // DOMAIN CHECK
        const domainMatch =
            url.hostname === rule.domain ||
            url.hostname.endsWith("." + rule.domain);

        if (!domainMatch) return false;

        // BLOCK WHOLE DOMAIN
        if (rule.type === "domain") {
            return true;
        }

        const path = url.pathname.replace(/^\//, "");

        // PREFIX PATH
        if (rule.type === "path") {
            return path.startsWith(rule.path);
        }

        // REGEX PATH
        if (rule.type === "regex") {
            return rule.regex.test(path);
        }

        return false;
    });
}


// =====================
// BLOCKING
// =====================
chrome.webNavigation.onBeforeNavigate.addListener((details) => {

    if (details.frameId !== 0) return;

    if (matches(details.url)) {
        chrome.tabs.update(details.tabId, {
            url: chrome.runtime.getURL("block.html")
        });
    }

});