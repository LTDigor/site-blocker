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
    const pathEndIndex = findFirstIndex(suffix, ["?", "#"]);
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
    redirectPath = "/src/blocked/block.html"
) {
    return parseRules(rawRules).map((rule, index) => ({
        id: index + 1,
        priority: 1,
        action: {
            type: "redirect",
            redirect: {
                extensionPath: redirectPath
            }
        },
        condition: {
            ...buildCondition(rule),
            resourceTypes: ["main_frame"],
            isUrlFilterCaseSensitive: true
        }
    }));
}

function buildCondition(rule) {
    if (rule.type === "domain") {
        return {
            urlFilter: `||${rule.domain}^`
        };
    }

    if (rule.type === "path") {
        return {
            regexFilter: buildUrlRegex(rule.domain, escapeRegExp(rule.path))
        };
    }

    return {
        regexFilter: buildUrlRegex(rule.domain, rule.regex.source.replace(/^\^/, ""))
    };
}

function buildUrlRegex(domain, pathPattern) {
    const domainPattern = escapeRegExp(domain);

    return `^https?://([^/?#]+\\.)?${domainPattern}(?::[0-9]+)?/${pathPattern}`;
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
