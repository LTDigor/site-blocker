(function () {
    const BLOCKED_SITES_KEY = "blockedSites";
    const TEMPORARY_UNBLOCKS_KEY = "temporaryUnblocks";
    const BLOCKED_PAGE_PATH = "src/blocked/block.html";

    const nativeApi = globalThis.browser || globalThis.chrome;
    if (!nativeApi?.storage?.local || !nativeApi?.runtime?.getURL) return;

    function parseRule(rule) {
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

    function parseRules(rawRules) {
        return rawRules.reduce((parsedRules, rawRule) => {
            try {
                parsedRules.push(parseRule(rawRule));
            } catch {
                // Ignore invalid persisted rules so one bad entry does not break blocking.
            }

            return parsedRules;
        }, []);
    }

    function pruneExpiredTemporaryUnblocks(temporaryUnblocks = {}, now = Date.now()) {
        return Object.fromEntries(
            Object.entries(temporaryUnblocks)
                .filter(([, expiresAt]) => Number.isFinite(expiresAt) && expiresAt > now)
        );
    }

    function filterTemporarilyUnblockedRules(rawRules, temporaryUnblocks = {}) {
        const activeUnblocks = pruneExpiredTemporaryUnblocks(temporaryUnblocks);

        return rawRules.filter((rule) => !activeUnblocks[rule]);
    }

    function findMatchingRawRule(urlString, rawRules, temporaryUnblocks) {
        const activeRules = filterTemporarilyUnblockedRules(rawRules || [], temporaryUnblocks || {});

        for (const rawRule of activeRules) {
            try {
                if (matchesUrl(urlString, [parseRule(rawRule)])) {
                    return rawRule;
                }
            } catch {
                // Ignore invalid persisted rules so one bad entry does not break blocking.
            }
        }

        return null;
    }

    function normalizeDomain(domain) {
        return new URL(`https://${domain}`).hostname.replace(/^www\./i, "");
    }

    function normalizePathPart(pathPart) {
        return new URL(`/${pathPart}`, "https://example.test").pathname.replace(/^\//, "");
    }

    function findFirstIndex(value, needles) {
        const indexes = needles
            .map((needle) => value.indexOf(needle))
            .filter((index) => index !== -1);

        return indexes.length > 0 ? Math.min(...indexes) : value.length;
    }

    function matchesUrl(urlString, rules) {
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

    function redirectIfBlocked(rawRules, temporaryUnblocks) {
        const blockedRule = findMatchingRawRule(globalThis.location.href, rawRules, temporaryUnblocks);
        if (!blockedRule) return;

        globalThis.location.replace(nativeApi.runtime.getURL(
            `${BLOCKED_PAGE_PATH}?blockedRule=${encodeURIComponent(blockedRule)}`
        ));
    }

    function readBlockedSites() {
        const storageKeys = [BLOCKED_SITES_KEY, TEMPORARY_UNBLOCKS_KEY];

        if (globalThis.browser) {
            nativeApi.storage.local.get(storageKeys).then((data) => {
                redirectIfBlocked(data[BLOCKED_SITES_KEY], data[TEMPORARY_UNBLOCKS_KEY]);
            });
            return;
        }

        nativeApi.storage.local.get(storageKeys, (data) => {
            redirectIfBlocked(data[BLOCKED_SITES_KEY], data[TEMPORARY_UNBLOCKS_KEY]);
        });
    }

    nativeApi.storage.onChanged?.addListener((changes, areaName) => {
        if (
            areaName === "local" &&
            (changes[BLOCKED_SITES_KEY] || changes[TEMPORARY_UNBLOCKS_KEY])
        ) {
            readBlockedSites();
        }
    });

    readBlockedSites();
}());
