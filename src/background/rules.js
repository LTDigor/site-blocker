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
        path: pathPart
    };
}

function splitRule(rule) {
    const normalizedRule = rule.trim().replace(/^https?:\/\//, "");
    const domainEndIndex = findFirstIndex(normalizedRule, ["/", "?", "#"]);
    const domain = normalizedRule.slice(0, domainEndIndex);
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
