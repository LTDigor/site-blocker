export function validateRuleInput(value) {
    const rule = value.trim();

    if (!rule) {
        return {
            isValid: false,
            message: "Enter a site or URL first."
        };
    }

    if (/\s/.test(rule)) {
        return {
            isValid: false,
            message: "Blocked sites cannot contain spaces."
        };
    }

    if (/^[a-z][a-z\d+.-]*:\/\//i.test(rule) && !/^https?:\/\//i.test(rule)) {
        return {
            isValid: false,
            message: "Only http and https URLs are supported."
        };
    }

    const parsedRule = parseInputRule(rule);

    if (!isValidHostname(parsedRule.hostname)) {
        return {
            isValid: false,
            message: "Enter a valid domain or URL."
        };
    }

    if (!isValidRegexPath(parsedRule.path)) {
        return {
            isValid: false,
            message: "Enter a valid regular expression path."
        };
    }

    return {
        isValid: true,
        value: normalizeRule(parsedRule)
    };
}

export function validateLocalImageFile(file, maxSizeBytes = 4 * 1024 * 1024) {
    if (!file) {
        return {
            isValid: false,
            message: "Choose an image file first."
        };
    }

    if (!file.type?.startsWith("image/")) {
        return {
            isValid: false,
            message: "Choose a valid image file."
        };
    }

    if (file.size > maxSizeBytes) {
        return {
            isValid: false,
            message: "Choose an image up to 4 MB."
        };
    }

    return {
        isValid: true
    };
}

export function normalizeStoredRules(rules) {
    const normalizedRules = [];
    const seenRules = new Set();

    for (const rule of rules) {
        const validation = validateRuleInput(rule);

        if (!validation.isValid || seenRules.has(validation.value)) {
            continue;
        }

        normalizedRules.push(validation.value);
        seenRules.add(validation.value);
    }

    return normalizedRules;
}

export function getCurrentSiteFromUrl(urlString) {
    try {
        const url = new URL(urlString);

        if (url.protocol !== "http:" && url.protocol !== "https:") {
            return null;
        }

        return url.hostname.replace(/^www\./i, "");
    } catch {
        return null;
    }
}

function parseInputRule(rule) {
    const isHttpUrl = /^https?:\/\//i.test(rule);

    if (isHttpUrl) {
        try {
            new URL(rule);
        } catch {
            return {
                hostname: "",
                path: ""
            };
        }
    }

    const withoutProtocol = rule.replace(/^https?:\/\//i, "");
    const hostEndIndex = findFirstIndex(withoutProtocol, ["/", "?", "#"]);
    const hostname = withoutProtocol.slice(0, hostEndIndex);
    const pathAndSuffix = withoutProtocol.slice(hostEndIndex);
    const pathEndIndex = findFirstIndex(pathAndSuffix, ["?", "#"]);
    const path = pathAndSuffix.startsWith("/") ? pathAndSuffix.slice(0, pathEndIndex) : "";

    return {
        hostname: hostname.replace(/\/$/, ""),
        path
    };
}

function findFirstIndex(value, needles) {
    const indexes = needles
        .map((needle) => value.indexOf(needle))
        .filter((index) => index !== -1);

    return indexes.length > 0 ? Math.min(...indexes) : value.length;
}

function normalizeRule({ hostname, path }) {
    const normalizedHostname = hostname.replace(/^www\./i, "");

    if (!path || path === "/") {
        return normalizedHostname;
    }

    return `${normalizedHostname}${path}`;
}

function isValidRegexPath(path) {
    const pathPart = path.replace(/^\//, "");
    if (!pathPart.startsWith("^")) return true;

    try {
        new RegExp(pathPart);
        return true;
    } catch {
        return false;
    }
}

function isValidHostname(hostname) {
    if (!hostname || hostname.length > 253) return false;
    if (hostname.toLowerCase() === "localhost") return true;

    let asciiHostname;
    try {
        asciiHostname = new URL(`https://${hostname}`).hostname;
    } catch {
        return false;
    }

    const labels = asciiHostname.split(".");

    if (labels.length < 2) return false;

    return labels.every((label) =>
        label.length > 0 &&
        label.length <= 63 &&
        /^[a-z\d](?:[a-z\d-]*[a-z\d])?$/i.test(label)
    );
}
