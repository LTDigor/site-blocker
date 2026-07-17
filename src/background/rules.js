export function parseRule(rule) {
    const { domain: rawDomain, pathPart } = splitRule(rule);
    const domain = normalizeDomain(rawDomain);

    if (!pathPart) {
        return {
            domain,
            type: "domain"
        };
    }

    if (pathPart.startsWith("^")) {
        return {
            domain,
            type: "regex",
            regex: new RegExp(pathPart)
        };
    }

    return {
        domain,
        type: "path",
        path: normalizePathPart(pathPart)
    };
}

function splitRule(rule) {
    const normalizedRule = rule.trim().replace(/^https?:\/\//i, "");
    const domainEndIndex = findFirstIndex(normalizedRule, ["/", "?", "#"]);
    const domain = normalizedRule.slice(0, domainEndIndex);

    if (!domain || domain.includes("@") || domain.includes(":")) {
        throw new Error("Unsupported rule authority");
    }

    const suffix = normalizedRule.slice(domainEndIndex);
    const pathEndIndex = findFirstIndex(suffix, suffix.startsWith("/^") ? ["#"] : ["?", "#"]);
    const pathPart = suffix.startsWith("/") ? suffix.slice(1, pathEndIndex) : "";

    return {
        domain,
        pathPart
    };
}

export function parseRules(rawRules) {
    return rawRules.reduce((parsedRules, rawRule) => {
        try {
            parsedRules.push(parseRule(rawRule));
        } catch {
            // Ignore invalid persisted rules so one bad entry does not break blocking.
        }

        return parsedRules;
    }, []);
}

export function pruneExpiredTemporaryUnblocks(temporaryUnblocks = {}, now = Date.now()) {
    return Object.fromEntries(
        Object.entries(temporaryUnblocks)
            .filter(([, expiresAt]) => Number.isFinite(expiresAt) && expiresAt > now)
    );
}

export function filterTemporarilyUnblockedRules(
    rawRules,
    temporaryUnblocks = {},
    now = Date.now()
) {
    const activeUnblocks = pruneExpiredTemporaryUnblocks(temporaryUnblocks, now);

    return rawRules.filter((rule) => !activeUnblocks[rule]);
}

export function getNextTemporaryUnblockExpiry(temporaryUnblocks = {}, now = Date.now()) {
    const expiries = Object.values(pruneExpiredTemporaryUnblocks(temporaryUnblocks, now));

    return expiries.length > 0 ? Math.min(...expiries) : null;
}

function normalizeDomain(domain) {
    return new URL(`https://${domain}`).hostname.replace(/^www\./i, "");
}

function normalizePathPart(pathPart) {
    if (pathPart.startsWith("^")) {
        return pathPart;
    }

    return new URL(`/${pathPart}`, "https://example.test").pathname.replace(/^\//, "");
}

function findFirstIndex(value, needles) {
    const indexes = needles
        .map((needle) => value.indexOf(needle))
        .filter((index) => index !== -1);

    return indexes.length > 0 ? Math.min(...indexes) : value.length;
}

export function matchesUrl(urlString, rules) {
    const url = new URL(urlString);

    return rules.some((rule) => matchesRule(url, rule));
}

function matchesRule(url, rule) {
    if (isBypassedImplicitSubdomainUrl(url, rule)) {
        return false;
    }

    const domainMatch =
        url.hostname === rule.domain ||
        url.hostname.endsWith("." + rule.domain);

    if (!domainMatch) return false;

    if (rule.type === "domain") {
        return true;
    }

    const path = url.pathname.replace(/^\//, "");

    if (rule.type === "path") {
        return path.startsWith(rule.path);
    }

    if (rule.type === "regex") {
        return rule.regex.test(path);
    }

    return false;
}

export function buildDeclarativeNetRequestRules(
    rawRules,
    redirectPath = "/src/blocked/block.html",
    temporaryUnblocks = {},
    now = Date.now()
) {
    return filterTemporarilyUnblockedRules(rawRules, temporaryUnblocks, now).reduce((rules, rawRule) => {
        let parsedRule;

        try {
            parsedRule = parseRule(rawRule);
        } catch {
            return rules;
        }

        rules.push({
            id: rules.length + 1,
            priority: 1,
            action: {
                type: "redirect",
                redirect: buildBlockedPageRedirect(redirectPath, rawRule)
            },
            condition: {
                regexFilter: buildFullUrlRegex(parsedRule),
                resourceTypes: ["main_frame"],
                isUrlFilterCaseSensitive: true,
                ...buildRuleConditionExclusions(parsedRule)
            }
        });

        return rules;
    }, []);
}

export function buildBlockedPagePath(redirectPath, blockedRule, blockedUrl = "") {
    const hash = blockedUrl ? `#${blockedUrl}` : "";

    return `${redirectPath}?blockedRule=${encodeURIComponent(blockedRule)}${hash}`;
}

function buildBlockedPageRedirect(redirectPath, blockedRule) {
    const path = buildBlockedPagePath(redirectPath, blockedRule, "\\0");

    if (/^https?:|^chrome-extension:|^moz-extension:/i.test(redirectPath)) {
        return { regexSubstitution: path };
    }

    return {
        extensionPath: buildBlockedPagePath(redirectPath, blockedRule)
    };
}

function buildFullUrlRegex(rule) {
    const domainPattern = escapeRegExp(rule.domain);
    const urlStart = `^https?://([^/?#]+\\.)?${domainPattern}(?::[0-9]+)?`;

    if (rule.type === "domain") {
        return `${urlStart}([/?#].*)?$`;
    }

    if (rule.type === "path") {
        return `${urlStart}/${escapeRegExp(rule.path)}.*$`;
    }

    return `${urlStart}/${rule.regex.source.replace(/^\^/, "")}.*$`;
}

function buildRuleConditionExclusions(rule) {
    if (rule.domain === "youtube.com") {
        return {
            excludedRequestDomains: ["accounts.youtube.com"]
        };
    }

    return {};
}

function isBypassedImplicitSubdomainUrl(url, rule) {
    return rule.domain === "youtube.com" && url.hostname === "accounts.youtube.com";
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
