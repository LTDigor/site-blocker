export function hasExtensionApi() {
    return Boolean(getNativeApi());
}

export function getExtensionUrl(path) {
    const nativeApi = getNativeApi();

    if (!nativeApi?.runtime?.getURL) {
        throw new Error("Extension API unavailable: getURL");
    }

    return nativeApi.runtime.getURL(path);
}

export const extensionEvents = {
    alarms: {
        get onAlarm() {
            return getNativeApi()?.alarms?.onAlarm;
        }
    },
    runtime: {
        get onInstalled() {
            return getNativeApi()?.runtime?.onInstalled;
        },
        get onMessage() {
            return getNativeApi()?.runtime?.onMessage;
        },
        get onStartup() {
            return getNativeApi()?.runtime?.onStartup;
        }
    },
    storage: {
        get onChanged() {
            return getNativeApi()?.storage?.onChanged;
        }
    }
};

export const extensionRuntime = {
    sendMessage(message) {
        return callApi(getNativeApi()?.runtime, "sendMessage", [message]);
    }
};

export const extensionAlarms = {
    clear(name) {
        return callApi(getNativeApi()?.alarms, "clear", [name]);
    },
    create(name, alarmInfo) {
        const alarms = getNativeApi()?.alarms;

        if (!alarms?.create) {
            return Promise.reject(new Error("Extension API unavailable: create"));
        }

        return Promise.resolve().then(() => alarms.create(name, alarmInfo));
    }
};

export const extensionStorage = {
    local: {
        get(keys) {
            return callApi(getNativeApi()?.storage?.local, "get", [keys]);
        },
        set(value) {
            return callApi(getNativeApi()?.storage?.local, "set", [value]);
        },
        remove(keys) {
            return callApi(getNativeApi()?.storage?.local, "remove", [keys]);
        }
    }
};

export const extensionTabs = {
    query(queryInfo) {
        return callApi(getNativeApi()?.tabs, "query", [queryInfo]);
    },
    update(tabId, options) {
        return callApi(getNativeApi()?.tabs, "update", [tabId, options]);
    }
};

export const extensionDeclarativeNetRequest = {
    getDynamicRules() {
        return callApi(getNativeApi()?.declarativeNetRequest, "getDynamicRules");
    },
    updateDynamicRules(options) {
        return callApi(getNativeApi()?.declarativeNetRequest, "updateDynamicRules", [options]);
    },
    isRegexSupported(options) {
        return callApi(getNativeApi()?.declarativeNetRequest, "isRegexSupported", [options]);
    }
};

function callApi(namespace, methodName, args = []) {
    const nativeApi = getNativeApi();
    const usesPromiseApi = Boolean(globalThis.browser);

    if (!namespace?.[methodName]) {
        return Promise.reject(new Error(`Extension API unavailable: ${methodName}`));
    }

    if (usesPromiseApi) {
        return Promise.resolve().then(() => namespace[methodName](...args));
    }

    return new Promise((resolve, reject) => {
        namespace[methodName](...args, (result) => {
            const error = nativeApi.runtime?.lastError;

            if (error) {
                reject(new Error(error.message || String(error)));
                return;
            }

            resolve(result);
        });
    });
}

function getNativeApi() {
    const nativeApi = globalThis.browser || globalThis.chrome;

    if (!nativeApi?.runtime?.getURL || !nativeApi?.storage?.local) {
        return null;
    }

    return nativeApi;
}
