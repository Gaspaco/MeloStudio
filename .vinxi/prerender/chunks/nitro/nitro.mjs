import process from 'node:process';globalThis._importMeta_=globalThis._importMeta_||{url:"file:///_entry.js",env:process.env};import destr from 'file:///Users/gaspaco/Downloads/MeloStudio/node_modules/destr/dist/index.mjs';
import { defineEventHandler, handleCacheHeaders, splitCookiesString, createEvent, fetchWithEvent, isEvent, eventHandler, setHeaders, sendRedirect, proxyRequest, getRequestURL, setResponseStatus, getResponseHeader, setResponseHeaders, send, getRequestHeader, removeResponseHeader, createError, appendResponseHeader, setResponseHeader, createApp, createRouter as createRouter$1, toNodeListener, lazyEventHandler } from 'file:///Users/gaspaco/Downloads/MeloStudio/node_modules/nitropack/node_modules/h3/dist/index.mjs';
import { createHooks } from 'file:///Users/gaspaco/Downloads/MeloStudio/node_modules/hookable/dist/index.mjs';
import { createFetch, Headers as Headers$1 } from 'file:///Users/gaspaco/Downloads/MeloStudio/node_modules/ofetch/dist/node.mjs';
import { fetchNodeRequestHandler, callNodeRequestHandler } from 'file:///Users/gaspaco/Downloads/MeloStudio/node_modules/node-mock-http/dist/index.mjs';
import { parseURL, withoutBase, joinURL, getQuery, withQuery, decodePath, withLeadingSlash, withoutTrailingSlash } from 'file:///Users/gaspaco/Downloads/MeloStudio/node_modules/ufo/dist/index.mjs';
import { createStorage, prefixStorage } from 'file:///Users/gaspaco/Downloads/MeloStudio/node_modules/unstorage/dist/index.mjs';
import unstorage_47drivers_47fs from 'file:///Users/gaspaco/Downloads/MeloStudio/node_modules/unstorage/drivers/fs.mjs';
import unstorage_47drivers_47fs_45lite from 'file:///Users/gaspaco/Downloads/MeloStudio/node_modules/unstorage/drivers/fs-lite.mjs';
import { digest } from 'file:///Users/gaspaco/Downloads/MeloStudio/node_modules/ohash/dist/index.mjs';
import { klona } from 'file:///Users/gaspaco/Downloads/MeloStudio/node_modules/klona/dist/index.mjs';
import defu, { defuFn } from 'file:///Users/gaspaco/Downloads/MeloStudio/node_modules/defu/dist/defu.mjs';
import { snakeCase } from 'file:///Users/gaspaco/Downloads/MeloStudio/node_modules/scule/dist/index.mjs';
import { AsyncLocalStorage } from 'node:async_hooks';
import { getContext } from 'file:///Users/gaspaco/Downloads/MeloStudio/node_modules/unctx/dist/index.mjs';
import { toRouteMatcher, createRouter } from 'file:///Users/gaspaco/Downloads/MeloStudio/node_modules/radix3/dist/index.mjs';
import _x1tP1zvZDMPFX3Ic7L_q7Pi53lDVTp1qhVfI10yb7Bs from 'file:///Users/gaspaco/Downloads/MeloStudio/node_modules/vinxi/lib/app-fetch.js';
import _Ic2FTqU5DAaeneRvU6mUYC_Ll90ck49bZwnWpChyUU4 from 'file:///Users/gaspaco/Downloads/MeloStudio/node_modules/vinxi/lib/app-manifest.js';
import { promises } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'file:///Users/gaspaco/Downloads/MeloStudio/node_modules/pathe/dist/index.mjs';
import { parseSetCookie } from 'file:///Users/gaspaco/Downloads/MeloStudio/node_modules/cookie-es/dist/index.mjs';
import { sharedConfig, lazy, createComponent, catchError, onCleanup } from 'file:///Users/gaspaco/Downloads/MeloStudio/node_modules/solid-js/dist/server.js';
import { renderToString, isServer, getRequestEvent, ssrElement, escape, mergeProps, ssr, createComponent as createComponent$1, ssrHydrationKey, NoHydration, ssrAttribute } from 'file:///Users/gaspaco/Downloads/MeloStudio/node_modules/solid-js/web/dist/server.js';
import { provideRequestEvent } from 'file:///Users/gaspaco/Downloads/MeloStudio/node_modules/solid-js/web/storage/dist/storage.js';
import { eventHandler as eventHandler$1, H3Event, getRequestIP, parseCookies, getResponseStatus, getResponseStatusText, getCookie, setCookie, getResponseHeader as getResponseHeader$1, setResponseHeader as setResponseHeader$1, removeResponseHeader as removeResponseHeader$1, getResponseHeaders, getRequestURL as getRequestURL$1, getRequestWebStream, setResponseStatus as setResponseStatus$1, appendResponseHeader as appendResponseHeader$1, setHeader, sendRedirect as sendRedirect$1 } from 'file:///Users/gaspaco/Downloads/MeloStudio/node_modules/h3/dist/index.mjs';
import { fromJSON, Feature, crossSerializeStream, getCrossReferenceHeader, toCrossJSONStream } from 'file:///Users/gaspaco/Downloads/MeloStudio/node_modules/seroval/dist/esm/production/index.mjs';
import { AbortSignalPlugin, CustomEventPlugin, DOMExceptionPlugin, EventPlugin, FormDataPlugin, HeadersPlugin, ReadableStreamPlugin, RequestPlugin, ResponsePlugin, URLSearchParamsPlugin, URLPlugin } from 'file:///Users/gaspaco/Downloads/MeloStudio/node_modules/seroval-plugins/dist/esm/production/web.mjs';

const serverAssets = [{"baseName":"server","dir":"/Users/gaspaco/Downloads/MeloStudio/assets"}];

const assets$1 = createStorage();

for (const asset of serverAssets) {
  assets$1.mount(asset.baseName, unstorage_47drivers_47fs({ base: asset.dir, ignore: (asset?.ignore || []) }));
}

const storage = createStorage({});

storage.mount('/assets', assets$1);

storage.mount('data', unstorage_47drivers_47fs_45lite({"driver":"fsLite","base":"./.data/kv"}));
storage.mount('root', unstorage_47drivers_47fs({"driver":"fs","readOnly":true,"base":"/Users/gaspaco/Downloads/MeloStudio"}));
storage.mount('src', unstorage_47drivers_47fs({"driver":"fs","readOnly":true,"base":"/Users/gaspaco/Downloads/MeloStudio"}));
storage.mount('build', unstorage_47drivers_47fs({"driver":"fs","readOnly":false,"base":"/Users/gaspaco/Downloads/MeloStudio/.vinxi"}));
storage.mount('cache', unstorage_47drivers_47fs({"driver":"fs","readOnly":false,"base":"/Users/gaspaco/Downloads/MeloStudio/.vinxi/cache"}));

function useStorage(base = "") {
  return base ? prefixStorage(storage, base) : storage;
}

const Hasher = /* @__PURE__ */ (() => {
  class Hasher2 {
    buff = "";
    #context = /* @__PURE__ */ new Map();
    write(str) {
      this.buff += str;
    }
    dispatch(value) {
      const type = value === null ? "null" : typeof value;
      return this[type](value);
    }
    object(object) {
      if (object && typeof object.toJSON === "function") {
        return this.object(object.toJSON());
      }
      const objString = Object.prototype.toString.call(object);
      let objType = "";
      const objectLength = objString.length;
      objType = objectLength < 10 ? "unknown:[" + objString + "]" : objString.slice(8, objectLength - 1);
      objType = objType.toLowerCase();
      let objectNumber = null;
      if ((objectNumber = this.#context.get(object)) === void 0) {
        this.#context.set(object, this.#context.size);
      } else {
        return this.dispatch("[CIRCULAR:" + objectNumber + "]");
      }
      if (typeof Buffer !== "undefined" && Buffer.isBuffer && Buffer.isBuffer(object)) {
        this.write("buffer:");
        return this.write(object.toString("utf8"));
      }
      if (objType !== "object" && objType !== "function" && objType !== "asyncfunction") {
        if (this[objType]) {
          this[objType](object);
        } else {
          this.unknown(object, objType);
        }
      } else {
        const keys = Object.keys(object).sort();
        const extraKeys = [];
        this.write("object:" + (keys.length + extraKeys.length) + ":");
        const dispatchForKey = (key) => {
          this.dispatch(key);
          this.write(":");
          this.dispatch(object[key]);
          this.write(",");
        };
        for (const key of keys) {
          dispatchForKey(key);
        }
        for (const key of extraKeys) {
          dispatchForKey(key);
        }
      }
    }
    array(arr, unordered) {
      unordered = unordered === void 0 ? false : unordered;
      this.write("array:" + arr.length + ":");
      if (!unordered || arr.length <= 1) {
        for (const entry of arr) {
          this.dispatch(entry);
        }
        return;
      }
      const contextAdditions = /* @__PURE__ */ new Map();
      const entries = arr.map((entry) => {
        const hasher = new Hasher2();
        hasher.dispatch(entry);
        for (const [key, value] of hasher.#context) {
          contextAdditions.set(key, value);
        }
        return hasher.toString();
      });
      this.#context = contextAdditions;
      entries.sort();
      return this.array(entries, false);
    }
    date(date) {
      return this.write("date:" + date.toJSON());
    }
    symbol(sym) {
      return this.write("symbol:" + sym.toString());
    }
    unknown(value, type) {
      this.write(type);
      if (!value) {
        return;
      }
      this.write(":");
      if (value && typeof value.entries === "function") {
        return this.array(
          [...value.entries()],
          true
          /* ordered */
        );
      }
    }
    error(err) {
      return this.write("error:" + err.toString());
    }
    boolean(bool) {
      return this.write("bool:" + bool);
    }
    string(string) {
      this.write("string:" + string.length + ":");
      this.write(string);
    }
    function(fn) {
      this.write("fn:");
      if (isNativeFunction(fn)) {
        this.dispatch("[native]");
      } else {
        this.dispatch(fn.toString());
      }
    }
    number(number) {
      return this.write("number:" + number);
    }
    null() {
      return this.write("Null");
    }
    undefined() {
      return this.write("Undefined");
    }
    regexp(regex) {
      return this.write("regex:" + regex.toString());
    }
    arraybuffer(arr) {
      this.write("arraybuffer:");
      return this.dispatch(new Uint8Array(arr));
    }
    url(url) {
      return this.write("url:" + url.toString());
    }
    map(map) {
      this.write("map:");
      const arr = [...map];
      return this.array(arr, false);
    }
    set(set) {
      this.write("set:");
      const arr = [...set];
      return this.array(arr, false);
    }
    bigint(number) {
      return this.write("bigint:" + number.toString());
    }
  }
  for (const type of [
    "uint8array",
    "uint8clampedarray",
    "unt8array",
    "uint16array",
    "unt16array",
    "uint32array",
    "unt32array",
    "float32array",
    "float64array"
  ]) {
    Hasher2.prototype[type] = function(arr) {
      this.write(type + ":");
      return this.array([...arr], false);
    };
  }
  function isNativeFunction(f) {
    if (typeof f !== "function") {
      return false;
    }
    return Function.prototype.toString.call(f).slice(
      -15
      /* "[native code] }".length */
    ) === "[native code] }";
  }
  return Hasher2;
})();
function serialize(object) {
  const hasher = new Hasher();
  hasher.dispatch(object);
  return hasher.buff;
}
function hash(value) {
  return digest(typeof value === "string" ? value : serialize(value)).replace(/[-_]/g, "").slice(0, 10);
}

function defaultCacheOptions() {
  return {
    name: "_",
    base: "/cache",
    swr: true,
    maxAge: 1
  };
}
function defineCachedFunction(fn, opts = {}) {
  opts = { ...defaultCacheOptions(), ...opts };
  const pending = {};
  const group = opts.group || "nitro/functions";
  const name = opts.name || fn.name || "_";
  const integrity = opts.integrity || hash([fn, opts]);
  const validate = opts.validate || ((entry) => entry.value !== void 0);
  async function get(key, resolver, shouldInvalidateCache, event) {
    const cacheKey = [opts.base, group, name, key + ".json"].filter(Boolean).join(":").replace(/:\/$/, ":index");
    let entry = await useStorage().getItem(cacheKey).catch((error) => {
      console.error(`[cache] Cache read error.`, error);
      useNitroApp().captureError(error, { event, tags: ["cache"] });
    }) || {};
    if (typeof entry !== "object") {
      entry = {};
      const error = new Error("Malformed data read from cache.");
      console.error("[cache]", error);
      useNitroApp().captureError(error, { event, tags: ["cache"] });
    }
    const ttl = (opts.maxAge ?? 0) * 1e3;
    if (ttl) {
      entry.expires = Date.now() + ttl;
    }
    const expired = shouldInvalidateCache || entry.integrity !== integrity || ttl && Date.now() - (entry.mtime || 0) > ttl || validate(entry) === false;
    const _resolve = async () => {
      const isPending = pending[key];
      if (!isPending) {
        if (entry.value !== void 0 && (opts.staleMaxAge || 0) >= 0 && opts.swr === false) {
          entry.value = void 0;
          entry.integrity = void 0;
          entry.mtime = void 0;
          entry.expires = void 0;
        }
        pending[key] = Promise.resolve(resolver());
      }
      try {
        entry.value = await pending[key];
      } catch (error) {
        if (!isPending) {
          delete pending[key];
        }
        throw error;
      }
      if (!isPending) {
        entry.mtime = Date.now();
        entry.integrity = integrity;
        delete pending[key];
        if (validate(entry) !== false) {
          let setOpts;
          if (opts.maxAge && !opts.swr) {
            setOpts = { ttl: opts.maxAge };
          }
          const promise = useStorage().setItem(cacheKey, entry, setOpts).catch((error) => {
            console.error(`[cache] Cache write error.`, error);
            useNitroApp().captureError(error, { event, tags: ["cache"] });
          });
          if (event?.waitUntil) {
            event.waitUntil(promise);
          }
        }
      }
    };
    const _resolvePromise = expired ? _resolve() : Promise.resolve();
    if (entry.value === void 0) {
      await _resolvePromise;
    } else if (expired && event && event.waitUntil) {
      event.waitUntil(_resolvePromise);
    }
    if (opts.swr && validate(entry) !== false) {
      _resolvePromise.catch((error) => {
        console.error(`[cache] SWR handler error.`, error);
        useNitroApp().captureError(error, { event, tags: ["cache"] });
      });
      return entry;
    }
    return _resolvePromise.then(() => entry);
  }
  return async (...args) => {
    const shouldBypassCache = await opts.shouldBypassCache?.(...args);
    if (shouldBypassCache) {
      return fn(...args);
    }
    const key = await (opts.getKey || getKey)(...args);
    const shouldInvalidateCache = await opts.shouldInvalidateCache?.(...args);
    const entry = await get(
      key,
      () => fn(...args),
      shouldInvalidateCache,
      args[0] && isEvent(args[0]) ? args[0] : void 0
    );
    let value = entry.value;
    if (opts.transform) {
      value = await opts.transform(entry, ...args) || value;
    }
    return value;
  };
}
function cachedFunction(fn, opts = {}) {
  return defineCachedFunction(fn, opts);
}
function getKey(...args) {
  return args.length > 0 ? hash(args) : "";
}
function escapeKey(key) {
  return String(key).replace(/\W/g, "");
}
function defineCachedEventHandler(handler, opts = defaultCacheOptions()) {
  const variableHeaderNames = (opts.varies || []).filter(Boolean).map((h) => h.toLowerCase()).sort();
  const _opts = {
    ...opts,
    getKey: async (event) => {
      const customKey = await opts.getKey?.(event);
      if (customKey) {
        return escapeKey(customKey);
      }
      const _path = event.node.req.originalUrl || event.node.req.url || event.path;
      let _pathname;
      try {
        _pathname = escapeKey(decodeURI(parseURL(_path).pathname)).slice(0, 16) || "index";
      } catch {
        _pathname = "-";
      }
      const _hashedPath = `${_pathname}.${hash(_path)}`;
      const _headers = variableHeaderNames.map((header) => [header, event.node.req.headers[header]]).map(([name, value]) => `${escapeKey(name)}.${hash(value)}`);
      return [_hashedPath, ..._headers].join(":");
    },
    validate: (entry) => {
      if (!entry.value) {
        return false;
      }
      if (entry.value.code >= 400) {
        return false;
      }
      if (entry.value.body === void 0) {
        return false;
      }
      if (entry.value.headers.etag === "undefined" || entry.value.headers["last-modified"] === "undefined") {
        return false;
      }
      return true;
    },
    group: opts.group || "nitro/handlers",
    integrity: opts.integrity || hash([handler, opts])
  };
  const _cachedHandler = cachedFunction(
    async (incomingEvent) => {
      const variableHeaders = {};
      for (const header of variableHeaderNames) {
        const value = incomingEvent.node.req.headers[header];
        if (value !== void 0) {
          variableHeaders[header] = value;
        }
      }
      const reqProxy = cloneWithProxy(incomingEvent.node.req, {
        headers: variableHeaders
      });
      const resHeaders = {};
      let _resSendBody;
      const resProxy = cloneWithProxy(incomingEvent.node.res, {
        statusCode: 200,
        writableEnded: false,
        writableFinished: false,
        headersSent: false,
        closed: false,
        getHeader(name) {
          return resHeaders[name];
        },
        setHeader(name, value) {
          resHeaders[name] = value;
          return this;
        },
        getHeaderNames() {
          return Object.keys(resHeaders);
        },
        hasHeader(name) {
          return name in resHeaders;
        },
        removeHeader(name) {
          delete resHeaders[name];
        },
        getHeaders() {
          return resHeaders;
        },
        end(chunk, arg2, arg3) {
          if (typeof chunk === "string") {
            _resSendBody = chunk;
          }
          if (typeof arg2 === "function") {
            arg2();
          }
          if (typeof arg3 === "function") {
            arg3();
          }
          return this;
        },
        write(chunk, arg2, arg3) {
          if (typeof chunk === "string") {
            _resSendBody = chunk;
          }
          if (typeof arg2 === "function") {
            arg2(void 0);
          }
          if (typeof arg3 === "function") {
            arg3();
          }
          return true;
        },
        writeHead(statusCode, headers2) {
          this.statusCode = statusCode;
          if (headers2) {
            if (Array.isArray(headers2) || typeof headers2 === "string") {
              throw new TypeError("Raw headers  is not supported.");
            }
            for (const header in headers2) {
              const value = headers2[header];
              if (value !== void 0) {
                this.setHeader(
                  header,
                  value
                );
              }
            }
          }
          return this;
        }
      });
      const event = createEvent(reqProxy, resProxy);
      event.fetch = (url, fetchOptions) => fetchWithEvent(event, url, fetchOptions, {
        fetch: useNitroApp().localFetch
      });
      event.$fetch = (url, fetchOptions) => fetchWithEvent(event, url, fetchOptions, {
        fetch: globalThis.$fetch
      });
      event.waitUntil = incomingEvent.waitUntil;
      event.context = incomingEvent.context;
      event.context.cache = {
        options: _opts
      };
      const body = await handler(event) || _resSendBody;
      const headers = event.node.res.getHeaders();
      headers.etag = String(
        headers.Etag || headers.etag || `W/"${hash(body)}"`
      );
      headers["last-modified"] = String(
        headers["Last-Modified"] || headers["last-modified"] || (/* @__PURE__ */ new Date()).toUTCString()
      );
      const cacheControl = [];
      if (opts.swr) {
        if (opts.maxAge) {
          cacheControl.push(`s-maxage=${opts.maxAge}`);
        }
        if (opts.staleMaxAge) {
          cacheControl.push(`stale-while-revalidate=${opts.staleMaxAge}`);
        } else {
          cacheControl.push("stale-while-revalidate");
        }
      } else if (opts.maxAge) {
        cacheControl.push(`max-age=${opts.maxAge}`);
      }
      if (cacheControl.length > 0) {
        headers["cache-control"] = cacheControl.join(", ");
      }
      const cacheEntry = {
        code: event.node.res.statusCode,
        headers,
        body
      };
      return cacheEntry;
    },
    _opts
  );
  return defineEventHandler(async (event) => {
    if (opts.headersOnly) {
      if (handleCacheHeaders(event, { maxAge: opts.maxAge })) {
        return;
      }
      return handler(event);
    }
    const response = await _cachedHandler(
      event
    );
    if (event.node.res.headersSent || event.node.res.writableEnded) {
      return response.body;
    }
    if (handleCacheHeaders(event, {
      modifiedTime: new Date(response.headers["last-modified"]),
      etag: response.headers.etag,
      maxAge: opts.maxAge
    })) {
      return;
    }
    event.node.res.statusCode = response.code;
    for (const name in response.headers) {
      const value = response.headers[name];
      if (name === "set-cookie") {
        event.node.res.appendHeader(
          name,
          splitCookiesString(value)
        );
      } else {
        if (value !== void 0) {
          event.node.res.setHeader(name, value);
        }
      }
    }
    return response.body;
  });
}
function cloneWithProxy(obj, overrides) {
  return new Proxy(obj, {
    get(target, property, receiver) {
      if (property in overrides) {
        return overrides[property];
      }
      return Reflect.get(target, property, receiver);
    },
    set(target, property, value, receiver) {
      if (property in overrides) {
        overrides[property] = value;
        return true;
      }
      return Reflect.set(target, property, value, receiver);
    }
  });
}
const cachedEventHandler = defineCachedEventHandler;

const inlineAppConfig = {};



const appConfig$1 = defuFn(inlineAppConfig);

function getEnv(key, opts) {
  const envKey = snakeCase(key).toUpperCase();
  return destr(
    process.env[opts.prefix + envKey] ?? process.env[opts.altPrefix + envKey]
  );
}
function _isObject(input) {
  return typeof input === "object" && !Array.isArray(input);
}
function applyEnv(obj, opts, parentKey = "") {
  for (const key in obj) {
    const subKey = parentKey ? `${parentKey}_${key}` : key;
    const envValue = getEnv(subKey, opts);
    if (_isObject(obj[key])) {
      if (_isObject(envValue)) {
        obj[key] = { ...obj[key], ...envValue };
        applyEnv(obj[key], opts, subKey);
      } else if (envValue === void 0) {
        applyEnv(obj[key], opts, subKey);
      } else {
        obj[key] = envValue ?? obj[key];
      }
    } else {
      obj[key] = envValue ?? obj[key];
    }
    if (opts.envExpansion && typeof obj[key] === "string") {
      obj[key] = _expandFromEnv(obj[key]);
    }
  }
  return obj;
}
const envExpandRx = /\{\{([^{}]*)\}\}/g;
function _expandFromEnv(value) {
  return value.replace(envExpandRx, (match, key) => {
    return process.env[key] || match;
  });
}

const _inlineRuntimeConfig = {
  "app": {
    "baseURL": "/"
  },
  "nitro": {
    "routeRules": {
      "/_build/assets/**": {
        "headers": {
          "cache-control": "public, immutable, max-age=31536000"
        }
      }
    }
  }
};
const envOptions = {
  prefix: "NITRO_",
  altPrefix: _inlineRuntimeConfig.nitro.envPrefix ?? process.env.NITRO_ENV_PREFIX ?? "_",
  envExpansion: _inlineRuntimeConfig.nitro.envExpansion ?? process.env.NITRO_ENV_EXPANSION ?? false
};
const _sharedRuntimeConfig = _deepFreeze(
  applyEnv(klona(_inlineRuntimeConfig), envOptions)
);
function useRuntimeConfig(event) {
  {
    return _sharedRuntimeConfig;
  }
}
_deepFreeze(klona(appConfig$1));
function _deepFreeze(object) {
  const propNames = Object.getOwnPropertyNames(object);
  for (const name of propNames) {
    const value = object[name];
    if (value && typeof value === "object") {
      _deepFreeze(value);
    }
  }
  return Object.freeze(object);
}
new Proxy(/* @__PURE__ */ Object.create(null), {
  get: (_, prop) => {
    console.warn(
      "Please use `useRuntimeConfig()` instead of accessing config directly."
    );
    const runtimeConfig = useRuntimeConfig();
    if (prop in runtimeConfig) {
      return runtimeConfig[prop];
    }
    return void 0;
  }
});

const nitroAsyncContext = getContext("nitro-app", {
  asyncContext: true,
  AsyncLocalStorage: AsyncLocalStorage 
});

const config = useRuntimeConfig();
const _routeRulesMatcher = toRouteMatcher(
  createRouter({ routes: config.nitro.routeRules })
);
function createRouteRulesHandler(ctx) {
  return eventHandler((event) => {
    const routeRules = getRouteRules(event);
    if (routeRules.headers) {
      setHeaders(event, routeRules.headers);
    }
    if (routeRules.redirect) {
      let target = routeRules.redirect.to;
      if (target.endsWith("/**")) {
        let targetPath = event.path;
        const strpBase = routeRules.redirect._redirectStripBase;
        if (strpBase) {
          targetPath = withoutBase(targetPath, strpBase);
        }
        target = joinURL(target.slice(0, -3), targetPath);
      } else if (event.path.includes("?")) {
        const query = getQuery(event.path);
        target = withQuery(target, query);
      }
      return sendRedirect(event, target, routeRules.redirect.statusCode);
    }
    if (routeRules.proxy) {
      let target = routeRules.proxy.to;
      if (target.endsWith("/**")) {
        let targetPath = event.path;
        const strpBase = routeRules.proxy._proxyStripBase;
        if (strpBase) {
          targetPath = withoutBase(targetPath, strpBase);
        }
        target = joinURL(target.slice(0, -3), targetPath);
      } else if (event.path.includes("?")) {
        const query = getQuery(event.path);
        target = withQuery(target, query);
      }
      return proxyRequest(event, target, {
        fetch: ctx.localFetch,
        ...routeRules.proxy
      });
    }
  });
}
function getRouteRules(event) {
  event.context._nitro = event.context._nitro || {};
  if (!event.context._nitro.routeRules) {
    event.context._nitro.routeRules = getRouteRulesForPath(
      withoutBase(event.path.split("?")[0], useRuntimeConfig().app.baseURL)
    );
  }
  return event.context._nitro.routeRules;
}
function getRouteRulesForPath(path) {
  return defu({}, ..._routeRulesMatcher.matchAll(path).reverse());
}

function _captureError(error, type) {
  console.error(`[${type}]`, error);
  useNitroApp().captureError(error, { tags: [type] });
}
function trapUnhandledNodeErrors() {
  process.on(
    "unhandledRejection",
    (error) => _captureError(error, "unhandledRejection")
  );
  process.on(
    "uncaughtException",
    (error) => _captureError(error, "uncaughtException")
  );
}
function joinHeaders(value) {
  return Array.isArray(value) ? value.join(", ") : String(value);
}
function normalizeFetchResponse(response) {
  if (!response.headers.has("set-cookie")) {
    return response;
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: normalizeCookieHeaders(response.headers)
  });
}
function normalizeCookieHeader(header = "") {
  return splitCookiesString(joinHeaders(header));
}
function normalizeCookieHeaders(headers) {
  const outgoingHeaders = new Headers();
  for (const [name, header] of headers) {
    if (name === "set-cookie") {
      for (const cookie of normalizeCookieHeader(header)) {
        outgoingHeaders.append("set-cookie", cookie);
      }
    } else {
      outgoingHeaders.set(name, joinHeaders(header));
    }
  }
  return outgoingHeaders;
}

function defineNitroErrorHandler(handler) {
  return handler;
}

const errorHandler$0 = defineNitroErrorHandler(
  function defaultNitroErrorHandler(error, event) {
    const res = defaultHandler(error, event);
    setResponseHeaders(event, res.headers);
    setResponseStatus(event, res.status, res.statusText);
    return send(event, JSON.stringify(res.body, null, 2));
  }
);
function defaultHandler(error, event, opts) {
  const isSensitive = error.unhandled || error.fatal;
  const statusCode = error.statusCode || 500;
  const statusMessage = error.statusMessage || "Server Error";
  const url = getRequestURL(event, { xForwardedHost: true, xForwardedProto: true });
  if (statusCode === 404) {
    const baseURL = "/";
    if (/^\/[^/]/.test(baseURL) && !url.pathname.startsWith(baseURL)) {
      const redirectTo = `${baseURL}${url.pathname.slice(1)}${url.search}`;
      return {
        status: 302,
        statusText: "Found",
        headers: { location: redirectTo },
        body: `Redirecting...`
      };
    }
  }
  if (isSensitive && !opts?.silent) {
    const tags = [error.unhandled && "[unhandled]", error.fatal && "[fatal]"].filter(Boolean).join(" ");
    console.error(`[request error] ${tags} [${event.method}] ${url}
`, error);
  }
  const headers = {
    "content-type": "application/json",
    // Prevent browser from guessing the MIME types of resources.
    "x-content-type-options": "nosniff",
    // Prevent error page from being embedded in an iframe
    "x-frame-options": "DENY",
    // Prevent browsers from sending the Referer header
    "referrer-policy": "no-referrer",
    // Disable the execution of any js
    "content-security-policy": "script-src 'none'; frame-ancestors 'none';"
  };
  setResponseStatus(event, statusCode, statusMessage);
  if (statusCode === 404 || !getResponseHeader(event, "cache-control")) {
    headers["cache-control"] = "no-cache";
  }
  const body = {
    error: true,
    url: url.href,
    statusCode,
    statusMessage,
    message: isSensitive ? "Server Error" : error.message,
    data: isSensitive ? void 0 : error.data
  };
  return {
    status: statusCode,
    statusText: statusMessage,
    headers,
    body
  };
}

const errorHandlers = [errorHandler$0];

async function errorHandler(error, event) {
  for (const handler of errorHandlers) {
    try {
      await handler(error, event, { defaultHandler });
      if (event.handled) {
        return; // Response handled
      }
    } catch(error) {
      // Handler itself thrown, log and continue
      console.error(error);
    }
  }
  // H3 will handle fallback
}

const appConfig = {"name":"vinxi","routers":[{"name":"public","type":"static","base":"/","dir":"./public","root":"/Users/gaspaco/Downloads/MeloStudio","order":0,"outDir":"/Users/gaspaco/Downloads/MeloStudio/.vinxi/build/public"},{"name":"ssr","type":"http","link":{"client":"client"},"handler":"src/entry-server.tsx","extensions":["js","jsx","ts","tsx"],"target":"server","root":"/Users/gaspaco/Downloads/MeloStudio","base":"/","outDir":"/Users/gaspaco/Downloads/MeloStudio/.vinxi/build/ssr","order":1},{"name":"client","type":"client","base":"/_build","handler":"src/entry-client.tsx","extensions":["js","jsx","ts","tsx"],"target":"browser","root":"/Users/gaspaco/Downloads/MeloStudio","outDir":"/Users/gaspaco/Downloads/MeloStudio/.vinxi/build/client","order":2},{"name":"server-fns","type":"http","base":"/_server","handler":"node_modules/@solidjs/start/dist/runtime/server-handler.js","target":"server","root":"/Users/gaspaco/Downloads/MeloStudio","outDir":"/Users/gaspaco/Downloads/MeloStudio/.vinxi/build/server-fns","order":3}],"server":{"compressPublicAssets":{"brotli":true},"routeRules":{"/_build/assets/**":{"headers":{"cache-control":"public, immutable, max-age=31536000"}}},"experimental":{"asyncContext":true},"preset":"vercel","prerender":{}},"root":"/Users/gaspaco/Downloads/MeloStudio"};
					const buildManifest = {"ssr":{"virtual:$vinxi/handler/ssr":{"file":"ssr.js","name":"ssr","src":"virtual:$vinxi/handler/ssr","isEntry":true}},"client":{"_auth-CRRFgofH.js":{"file":"assets/auth-CRRFgofH.js","name":"auth"},"_index-CzGW6FVa.js":{"file":"assets/index-CzGW6FVa.js","name":"index"},"_routing-CRcy8o_Y.js":{"file":"assets/routing-CRcy8o_Y.js","name":"routing"},"src/routes/dashboard.tsx?pick=default&pick=$css":{"file":"assets/dashboard-D3h1szCO.js","name":"dashboard","src":"src/routes/dashboard.tsx?pick=default&pick=$css","isEntry":true,"isDynamicEntry":true,"imports":["_routing-CRcy8o_Y.js","_index-CzGW6FVa.js","_auth-CRRFgofH.js"],"css":["assets/dashboard-BC0rjEow.css"]},"src/routes/forgot.tsx?pick=default&pick=$css":{"file":"assets/forgot-lzOhdYdu.js","name":"forgot","src":"src/routes/forgot.tsx?pick=default&pick=$css","isEntry":true,"isDynamicEntry":true,"imports":["_routing-CRcy8o_Y.js","_index-CzGW6FVa.js"],"css":["assets/forgot-C4pJE_2p.css"]},"src/routes/index.tsx?pick=default&pick=$css":{"file":"assets/index-DIsEf-vi.js","name":"index","src":"src/routes/index.tsx?pick=default&pick=$css","isEntry":true,"isDynamicEntry":true,"imports":["_routing-CRcy8o_Y.js","_index-CzGW6FVa.js","_auth-CRRFgofH.js"],"css":["assets/index-DDFYPyIv.css"]},"src/routes/login.tsx?pick=default&pick=$css":{"file":"assets/login-SqgK5paF.js","name":"login","src":"src/routes/login.tsx?pick=default&pick=$css","isEntry":true,"isDynamicEntry":true,"imports":["_routing-CRcy8o_Y.js","_index-CzGW6FVa.js","_auth-CRRFgofH.js"],"css":["assets/login-CGNAsWA4.css"]},"src/routes/signup.tsx?pick=default&pick=$css":{"file":"assets/signup-C_neQVDS.js","name":"signup","src":"src/routes/signup.tsx?pick=default&pick=$css","isEntry":true,"isDynamicEntry":true,"imports":["_routing-CRcy8o_Y.js","_index-CzGW6FVa.js","_auth-CRRFgofH.js"],"css":["assets/signup-CKwJ53lE.css"]},"virtual:$vinxi/handler/client":{"file":"assets/client-B3pXaLYA.js","name":"client","src":"virtual:$vinxi/handler/client","isEntry":true,"imports":["_routing-CRcy8o_Y.js"],"dynamicImports":["src/routes/dashboard.tsx?pick=default&pick=$css","src/routes/forgot.tsx?pick=default&pick=$css","src/routes/index.tsx?pick=default&pick=$css","src/routes/login.tsx?pick=default&pick=$css","src/routes/signup.tsx?pick=default&pick=$css"],"css":["assets/client-CWmnLvlF.css"]}},"server-fns":{"_server-fns-BVAbYid8.js":{"file":"assets/server-fns-BVAbYid8.js","name":"server-fns","dynamicImports":["src/App.tsx"]},"src/App.tsx":{"file":"assets/App-CnvwUZj5.js","name":"App","src":"src/App.tsx","isDynamicEntry":true,"imports":["_server-fns-BVAbYid8.js"],"css":["assets/App-CWmnLvlF.css"]},"virtual:$vinxi/handler/server-fns":{"file":"server-fns.js","name":"server-fns","src":"virtual:$vinxi/handler/server-fns","isEntry":true,"imports":["_server-fns-BVAbYid8.js"]}}};

					const routeManifest = {"ssr":{},"client":{},"server-fns":{}};

        function createProdApp(appConfig) {
          return {
            config: { ...appConfig, buildManifest, routeManifest },
            getRouter(name) {
              return appConfig.routers.find(router => router.name === name)
            }
          }
        }

        function plugin(app) {
          const prodApp = createProdApp(appConfig);
          globalThis.app = prodApp;
        }

const chunks = {};
			 



			 function app() {
				 globalThis.$$chunks = chunks;
			 }

const plugins = [
  plugin,
_x1tP1zvZDMPFX3Ic7L_q7Pi53lDVTp1qhVfI10yb7Bs,
_Ic2FTqU5DAaeneRvU6mUYC_Ll90ck49bZwnWpChyUU4,
app
];

const assets = {
  "/Icon.svg.br": {
    "type": "image/svg+xml",
    "encoding": "br",
    "etag": "\"d556-tGVlRKjnwKYl4hL/EVYy6mGJN1E\"",
    "mtime": "2026-04-17T10:49:02.825Z",
    "size": 54614,
    "path": "../../.output/public/Icon.svg.br"
  },
  "/Icon.svg": {
    "type": "image/svg+xml",
    "encoding": null,
    "etag": "\"5f013-3fE//I2cztjJARtSOhDJNVmjxBo\"",
    "mtime": "2026-04-17T10:49:02.471Z",
    "size": 389139,
    "path": "../../.output/public/Icon.svg"
  },
  "/Icon.svg.gz": {
    "type": "image/svg+xml",
    "encoding": "gzip",
    "etag": "\"110e4-tDkkuoUXux5wcidsWNCNhLNjPF4\"",
    "mtime": "2026-04-17T10:49:02.606Z",
    "size": 69860,
    "path": "../../.output/public/Icon.svg.gz"
  },
  "/index.html.br": {
    "type": "text/html; charset=utf-8",
    "encoding": "br",
    "etag": "\"2a4-zl81NC1E1cTDNJbt+JOGhH7JPIw\"",
    "mtime": "2026-04-17T10:49:03.063Z",
    "size": 676,
    "path": "../../.output/public/index.html.br"
  },
  "/index.html.gz": {
    "type": "text/html; charset=utf-8",
    "encoding": "gzip",
    "etag": "\"386-/wo1BYG/CYsr7E6zLxELzOjFuBM\"",
    "mtime": "2026-04-17T10:49:03.060Z",
    "size": 902,
    "path": "../../.output/public/index.html.gz"
  },
  "/_build/.vite/manifest.json.br": {
    "type": "application/json",
    "encoding": "br",
    "etag": "\"1c5-a2atqaGuE0/n9ZXAFGdIjbuYnr0\"",
    "mtime": "2026-04-17T10:49:02.504Z",
    "size": 453,
    "path": "../../.output/public/_build/.vite/manifest.json.br"
  },
  "/_build/.vite/manifest.json": {
    "type": "application/json",
    "encoding": null,
    "etag": "\"ae0-neLLXamcrVfHgA9AGmBRX93Nhjs\"",
    "mtime": "2026-04-17T10:49:02.473Z",
    "size": 2784,
    "path": "../../.output/public/_build/.vite/manifest.json"
  },
  "/index.html": {
    "type": "text/html; charset=utf-8",
    "encoding": null,
    "etag": "\"1433-lIzT8UJC140gjcxlAV4d5rxeA+Y\"",
    "mtime": "2026-04-17T10:49:03.058Z",
    "size": 5171,
    "path": "../../.output/public/index.html"
  },
  "/_build/.vite/manifest.json.gz": {
    "type": "application/json",
    "encoding": "gzip",
    "etag": "\"205-CuGVU+dHBquAeJMS9MvLoGLx+eI\"",
    "mtime": "2026-04-17T10:49:02.504Z",
    "size": 517,
    "path": "../../.output/public/_build/.vite/manifest.json.gz"
  },
  "/_build/assets/auth-CRRFgofH.js.br": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "br",
    "etag": "\"db92-p3FHCc4sqsJbIhcE+EsTxh4NpIY\"",
    "mtime": "2026-04-17T10:49:02.700Z",
    "size": 56210,
    "path": "../../.output/public/_build/assets/auth-CRRFgofH.js.br"
  },
  "/_build/assets/client-B3pXaLYA.js": {
    "type": "text/javascript; charset=utf-8",
    "encoding": null,
    "etag": "\"3e28-/7DEamGMStkNJvUvpg+R4hpoLk8\"",
    "mtime": "2026-04-17T10:49:02.473Z",
    "size": 15912,
    "path": "../../.output/public/_build/assets/client-B3pXaLYA.js"
  },
  "/_build/assets/client-B3pXaLYA.js.br": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "br",
    "etag": "\"15fd-DzJ9As6ZeMYChS9G3yApHiNWKok\"",
    "mtime": "2026-04-17T10:49:02.504Z",
    "size": 5629,
    "path": "../../.output/public/_build/assets/client-B3pXaLYA.js.br"
  },
  "/_build/assets/auth-CRRFgofH.js": {
    "type": "text/javascript; charset=utf-8",
    "encoding": null,
    "etag": "\"432de-DzAC78CsLlkOplfPH5NTtk/CW84\"",
    "mtime": "2026-04-17T10:49:02.474Z",
    "size": 275166,
    "path": "../../.output/public/_build/assets/auth-CRRFgofH.js"
  },
  "/_build/assets/client-B3pXaLYA.js.gz": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "gzip",
    "etag": "\"1896-umwt8hnOEozwpUqA4Wah/Af6rvc\"",
    "mtime": "2026-04-17T10:49:02.504Z",
    "size": 6294,
    "path": "../../.output/public/_build/assets/client-B3pXaLYA.js.gz"
  },
  "/_build/assets/auth-CRRFgofH.js.gz": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "gzip",
    "etag": "\"1014d-rL6zhBoO/ro6FXF+BizeaJZh6CU\"",
    "mtime": "2026-04-17T10:49:02.541Z",
    "size": 65869,
    "path": "../../.output/public/_build/assets/auth-CRRFgofH.js.gz"
  },
  "/_build/assets/client-CWmnLvlF.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"2e6-ZKaEHGhXNMWVx8xhqdpfvE5IJ1Y\"",
    "mtime": "2026-04-17T10:49:02.473Z",
    "size": 742,
    "path": "../../.output/public/_build/assets/client-CWmnLvlF.css"
  },
  "/_build/assets/dashboard-BC0rjEow.css": {
    "type": "text/css; charset=utf-8",
    "encoding": null,
    "etag": "\"3d60-7CwnYTdsVahVkXatDt5A7MSX1dc\"",
    "mtime": "2026-04-17T10:49:02.473Z",
    "size": 15712,
    "path": "../../.output/public/_build/assets/dashboard-BC0rjEow.css"
  },
  "/_build/assets/dashboard-BC0rjEow.css.br": {
    "type": "text/css; charset=utf-8",
    "encoding": "br",
    "etag": "\"b61-aY0CnYIsI3BU+rgw4dsjXpKPnUM\"",
    "mtime": "2026-04-17T10:49:02.504Z",
    "size": 2913,
    "path": "../../.output/public/_build/assets/dashboard-BC0rjEow.css.br"
  },
  "/_build/assets/dashboard-BC0rjEow.css.gz": {
    "type": "text/css; charset=utf-8",
    "encoding": "gzip",
    "etag": "\"d08-oxr4Khve7bdbAyIFmFX0agRoplA\"",
    "mtime": "2026-04-17T10:49:02.504Z",
    "size": 3336,
    "path": "../../.output/public/_build/assets/dashboard-BC0rjEow.css.gz"
  },
  "/_build/assets/dashboard-D3h1szCO.js": {
    "type": "text/javascript; charset=utf-8",
    "encoding": null,
    "etag": "\"42a5-i/simnEdO8gJqtwfWW8jvdUxWtM\"",
    "mtime": "2026-04-17T10:49:02.473Z",
    "size": 17061,
    "path": "../../.output/public/_build/assets/dashboard-D3h1szCO.js"
  },
  "/_build/assets/dashboard-D3h1szCO.js.br": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "br",
    "etag": "\"10cc-Q97MGwke30NMhA8vYfYy0+JM/xI\"",
    "mtime": "2026-04-17T10:49:02.504Z",
    "size": 4300,
    "path": "../../.output/public/_build/assets/dashboard-D3h1szCO.js.br"
  },
  "/_build/assets/dashboard-D3h1szCO.js.gz": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "gzip",
    "etag": "\"12e1-/eA+KYUhOCp8DgJCzUKmxvFoXbg\"",
    "mtime": "2026-04-17T10:49:02.504Z",
    "size": 4833,
    "path": "../../.output/public/_build/assets/dashboard-D3h1szCO.js.gz"
  },
  "/_build/assets/forgot-C4pJE_2p.css": {
    "type": "text/css; charset=utf-8",
    "encoding": null,
    "etag": "\"139a-RG2yIk+Tf2nxXYL7PkRSbK3JCx0\"",
    "mtime": "2026-04-17T10:49:02.473Z",
    "size": 5018,
    "path": "../../.output/public/_build/assets/forgot-C4pJE_2p.css"
  },
  "/_build/assets/forgot-C4pJE_2p.css.br": {
    "type": "text/css; charset=utf-8",
    "encoding": "br",
    "etag": "\"49e-kcdbMCOQ12fh3y58na/p/KnQB/I\"",
    "mtime": "2026-04-17T10:49:02.504Z",
    "size": 1182,
    "path": "../../.output/public/_build/assets/forgot-C4pJE_2p.css.br"
  },
  "/hate-me.mp3": {
    "type": "audio/mpeg",
    "etag": "\"12975b-HswHy1cEZP+X9cJOidjb5/j3/Rw\"",
    "mtime": "2026-04-17T10:49:02.471Z",
    "size": 1218395,
    "path": "../../.output/public/hate-me.mp3"
  },
  "/_build/assets/forgot-C4pJE_2p.css.gz": {
    "type": "text/css; charset=utf-8",
    "encoding": "gzip",
    "etag": "\"5a1-pBTp+Ruy0Q15y42Y9uBpMQtPQpo\"",
    "mtime": "2026-04-17T10:49:02.504Z",
    "size": 1441,
    "path": "../../.output/public/_build/assets/forgot-C4pJE_2p.css.gz"
  },
  "/_build/assets/forgot-lzOhdYdu.js": {
    "type": "text/javascript; charset=utf-8",
    "encoding": null,
    "etag": "\"f07-ik4DAr4nznTbCsFFT1okpC7p/Cs\"",
    "mtime": "2026-04-17T10:49:02.473Z",
    "size": 3847,
    "path": "../../.output/public/_build/assets/forgot-lzOhdYdu.js"
  },
  "/_build/assets/forgot-lzOhdYdu.js.br": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "br",
    "etag": "\"4de-4VV1UjgYD4i9GlFOegIgeXMcyGg\"",
    "mtime": "2026-04-17T10:49:02.504Z",
    "size": 1246,
    "path": "../../.output/public/_build/assets/forgot-lzOhdYdu.js.br"
  },
  "/_build/assets/forgot-lzOhdYdu.js.gz": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "gzip",
    "etag": "\"5a8-jtmxD8Zz/zImSa4FHw3E78ie4bs\"",
    "mtime": "2026-04-17T10:49:02.504Z",
    "size": 1448,
    "path": "../../.output/public/_build/assets/forgot-lzOhdYdu.js.gz"
  },
  "/_build/assets/index-CzGW6FVa.js": {
    "type": "text/javascript; charset=utf-8",
    "encoding": null,
    "etag": "\"1133e-jdJBWMlfO5lIQFVudKhskC2LhoA\"",
    "mtime": "2026-04-17T10:49:02.474Z",
    "size": 70462,
    "path": "../../.output/public/_build/assets/index-CzGW6FVa.js"
  },
  "/_build/assets/index-CzGW6FVa.js.br": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "br",
    "etag": "\"6175-SgI+nHU5ZVJPxqS6OTW8qKcdv9s\"",
    "mtime": "2026-04-17T10:49:02.607Z",
    "size": 24949,
    "path": "../../.output/public/_build/assets/index-CzGW6FVa.js.br"
  },
  "/_build/assets/index-DDFYPyIv.css": {
    "type": "text/css; charset=utf-8",
    "encoding": null,
    "etag": "\"7954-No6+C0V50Vs2+jwTv4hgxKmU1G4\"",
    "mtime": "2026-04-17T10:49:02.473Z",
    "size": 31060,
    "path": "../../.output/public/_build/assets/index-DDFYPyIv.css"
  },
  "/_build/assets/index-CzGW6FVa.js.gz": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "gzip",
    "etag": "\"6be9-oKjrLQ00x8rlLkRGwgBNfuXHy4Q\"",
    "mtime": "2026-04-17T10:49:02.541Z",
    "size": 27625,
    "path": "../../.output/public/_build/assets/index-CzGW6FVa.js.gz"
  },
  "/_build/assets/index-DDFYPyIv.css.br": {
    "type": "text/css; charset=utf-8",
    "encoding": "br",
    "etag": "\"1689-svfqS1hB71U7F7KnpoEUpBJLAP8\"",
    "mtime": "2026-04-17T10:49:02.544Z",
    "size": 5769,
    "path": "../../.output/public/_build/assets/index-DDFYPyIv.css.br"
  },
  "/_build/assets/index-DDFYPyIv.css.gz": {
    "type": "text/css; charset=utf-8",
    "encoding": "gzip",
    "etag": "\"197d-bJIrY1D1dtq376VrMk+t72zNglc\"",
    "mtime": "2026-04-17T10:49:02.544Z",
    "size": 6525,
    "path": "../../.output/public/_build/assets/index-DDFYPyIv.css.gz"
  },
  "/_build/assets/index-DIsEf-vi.js": {
    "type": "text/javascript; charset=utf-8",
    "encoding": null,
    "etag": "\"157ca-KZV40KcvWvvc17RMvSp9JUZR2SI\"",
    "mtime": "2026-04-17T10:49:02.474Z",
    "size": 88010,
    "path": "../../.output/public/_build/assets/index-DIsEf-vi.js"
  },
  "/_build/assets/index-DIsEf-vi.js.br": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "br",
    "etag": "\"6f24-T3+eh85nf/Qg70HqE/Vbsf0qCSY\"",
    "mtime": "2026-04-17T10:49:02.616Z",
    "size": 28452,
    "path": "../../.output/public/_build/assets/index-DIsEf-vi.js.br"
  },
  "/_build/assets/login-CGNAsWA4.css": {
    "type": "text/css; charset=utf-8",
    "encoding": null,
    "etag": "\"16d9-XrLBn87ZK6l0QDRtgdfL6F4odH4\"",
    "mtime": "2026-04-17T10:49:02.473Z",
    "size": 5849,
    "path": "../../.output/public/_build/assets/login-CGNAsWA4.css"
  },
  "/_build/assets/login-CGNAsWA4.css.br": {
    "type": "text/css; charset=utf-8",
    "encoding": "br",
    "etag": "\"537-X+h6z5U84dV9yGFmylAsNb+kPyY\"",
    "mtime": "2026-04-17T10:49:02.606Z",
    "size": 1335,
    "path": "../../.output/public/_build/assets/login-CGNAsWA4.css.br"
  },
  "/_build/assets/index-DIsEf-vi.js.gz": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "gzip",
    "etag": "\"7b93-CuAql5GqrZtaIIkx/ksF/OFoLN4\"",
    "mtime": "2026-04-17T10:49:02.607Z",
    "size": 31635,
    "path": "../../.output/public/_build/assets/index-DIsEf-vi.js.gz"
  },
  "/_build/assets/login-SqgK5paF.js": {
    "type": "text/javascript; charset=utf-8",
    "encoding": null,
    "etag": "\"18c0-ljJB6k54imh0a9zqqemQA324LCI\"",
    "mtime": "2026-04-17T10:49:02.473Z",
    "size": 6336,
    "path": "../../.output/public/_build/assets/login-SqgK5paF.js"
  },
  "/_build/assets/login-CGNAsWA4.css.gz": {
    "type": "text/css; charset=utf-8",
    "encoding": "gzip",
    "etag": "\"65c-lNhk6m5dipYGt/hgtYDeYLKWDzc\"",
    "mtime": "2026-04-17T10:49:02.606Z",
    "size": 1628,
    "path": "../../.output/public/_build/assets/login-CGNAsWA4.css.gz"
  },
  "/_build/assets/login-SqgK5paF.js.br": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "br",
    "etag": "\"8c7-cKjimxlO5q+hluID+oJ3vH2t200\"",
    "mtime": "2026-04-17T10:49:02.607Z",
    "size": 2247,
    "path": "../../.output/public/_build/assets/login-SqgK5paF.js.br"
  },
  "/_build/assets/login-SqgK5paF.js.gz": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "gzip",
    "etag": "\"a34-WTwKYao09UVegZETE3Mg9UUTgY4\"",
    "mtime": "2026-04-17T10:49:02.607Z",
    "size": 2612,
    "path": "../../.output/public/_build/assets/login-SqgK5paF.js.gz"
  },
  "/_build/assets/routing-CRcy8o_Y.js": {
    "type": "text/javascript; charset=utf-8",
    "encoding": null,
    "etag": "\"7b9c-67sMoS1wHAiWPm58pA1cU7yVPdg\"",
    "mtime": "2026-04-17T10:49:02.474Z",
    "size": 31644,
    "path": "../../.output/public/_build/assets/routing-CRcy8o_Y.js"
  },
  "/_build/assets/routing-CRcy8o_Y.js.br": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "br",
    "etag": "\"2c58-V6R8XLmT6sS9cULl6gzFG5yjxlY\"",
    "mtime": "2026-04-17T10:49:02.607Z",
    "size": 11352,
    "path": "../../.output/public/_build/assets/routing-CRcy8o_Y.js.br"
  },
  "/_build/assets/routing-CRcy8o_Y.js.gz": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "gzip",
    "etag": "\"309f-SNDc0ROEIJX50rYUrBYzZ6NTMZ4\"",
    "mtime": "2026-04-17T10:49:02.607Z",
    "size": 12447,
    "path": "../../.output/public/_build/assets/routing-CRcy8o_Y.js.gz"
  },
  "/_build/assets/signup-CKwJ53lE.css": {
    "type": "text/css; charset=utf-8",
    "encoding": null,
    "etag": "\"18cc-zxwGTGGxqPW9jtrHD9Lx4Oja+R0\"",
    "mtime": "2026-04-17T10:49:02.473Z",
    "size": 6348,
    "path": "../../.output/public/_build/assets/signup-CKwJ53lE.css"
  },
  "/_build/assets/signup-CKwJ53lE.css.br": {
    "type": "text/css; charset=utf-8",
    "encoding": "br",
    "etag": "\"57d-T3pOXHRDetNUgCpcq1hZjzeG2AI\"",
    "mtime": "2026-04-17T10:49:02.607Z",
    "size": 1405,
    "path": "../../.output/public/_build/assets/signup-CKwJ53lE.css.br"
  },
  "/_build/assets/signup-CKwJ53lE.css.gz": {
    "type": "text/css; charset=utf-8",
    "encoding": "gzip",
    "etag": "\"68e-lLlX99xub0gQFx3r5uXdVCuuCv4\"",
    "mtime": "2026-04-17T10:49:02.607Z",
    "size": 1678,
    "path": "../../.output/public/_build/assets/signup-CKwJ53lE.css.gz"
  },
  "/_build/assets/signup-C_neQVDS.js": {
    "type": "text/javascript; charset=utf-8",
    "encoding": null,
    "etag": "\"2ddd-94/4U6zpReACLHOEKDA4Q5qXGEQ\"",
    "mtime": "2026-04-17T10:49:02.474Z",
    "size": 11741,
    "path": "../../.output/public/_build/assets/signup-C_neQVDS.js"
  },
  "/_build/assets/signup-C_neQVDS.js.br": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "br",
    "etag": "\"d81-YQqEgI8utYLUDTRK7xvK3Lb0Zj4\"",
    "mtime": "2026-04-17T10:49:02.607Z",
    "size": 3457,
    "path": "../../.output/public/_build/assets/signup-C_neQVDS.js.br"
  },
  "/_build/assets/signup-C_neQVDS.js.gz": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "gzip",
    "etag": "\"100b-njw3BJ4Qb5Q3MroOm+txMDTUKoI\"",
    "mtime": "2026-04-17T10:49:02.607Z",
    "size": 4107,
    "path": "../../.output/public/_build/assets/signup-C_neQVDS.js.gz"
  },
  "/_server/assets/App-CWmnLvlF.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"2e6-ZKaEHGhXNMWVx8xhqdpfvE5IJ1Y\"",
    "mtime": "2026-04-17T10:49:02.475Z",
    "size": 742,
    "path": "../../.output/public/_server/assets/App-CWmnLvlF.css"
  }
};

function readAsset (id) {
  const serverDir = dirname(fileURLToPath(globalThis._importMeta_.url));
  return promises.readFile(resolve(serverDir, assets[id].path))
}

const publicAssetBases = {};

function isPublicAssetURL(id = '') {
  if (assets[id]) {
    return true
  }
  for (const base in publicAssetBases) {
    if (id.startsWith(base)) { return true }
  }
  return false
}

function getAsset (id) {
  return assets[id]
}

const METHODS = /* @__PURE__ */ new Set(["HEAD", "GET"]);
const EncodingMap = { gzip: ".gz", br: ".br" };
const _dXclHI = eventHandler((event) => {
  if (event.method && !METHODS.has(event.method)) {
    return;
  }
  let id = decodePath(
    withLeadingSlash(withoutTrailingSlash(parseURL(event.path).pathname))
  );
  let asset;
  const encodingHeader = String(
    getRequestHeader(event, "accept-encoding") || ""
  );
  const encodings = [
    ...encodingHeader.split(",").map((e) => EncodingMap[e.trim()]).filter(Boolean).sort(),
    ""
  ];
  for (const encoding of encodings) {
    for (const _id of [id + encoding, joinURL(id, "index.html" + encoding)]) {
      const _asset = getAsset(_id);
      if (_asset) {
        asset = _asset;
        id = _id;
        break;
      }
    }
  }
  if (!asset) {
    if (isPublicAssetURL(id)) {
      removeResponseHeader(event, "Cache-Control");
      throw createError({ statusCode: 404 });
    }
    return;
  }
  if (asset.encoding !== void 0) {
    appendResponseHeader(event, "Vary", "Accept-Encoding");
  }
  const ifNotMatch = getRequestHeader(event, "if-none-match") === asset.etag;
  if (ifNotMatch) {
    setResponseStatus(event, 304, "Not Modified");
    return "";
  }
  const ifModifiedSinceH = getRequestHeader(event, "if-modified-since");
  const mtimeDate = new Date(asset.mtime);
  if (ifModifiedSinceH && asset.mtime && new Date(ifModifiedSinceH) >= mtimeDate) {
    setResponseStatus(event, 304, "Not Modified");
    return "";
  }
  if (asset.type && !getResponseHeader(event, "Content-Type")) {
    setResponseHeader(event, "Content-Type", asset.type);
  }
  if (asset.etag && !getResponseHeader(event, "ETag")) {
    setResponseHeader(event, "ETag", asset.etag);
  }
  if (asset.mtime && !getResponseHeader(event, "Last-Modified")) {
    setResponseHeader(event, "Last-Modified", mtimeDate.toUTCString());
  }
  if (asset.encoding && !getResponseHeader(event, "Content-Encoding")) {
    setResponseHeader(event, "Content-Encoding", asset.encoding);
  }
  if (asset.size > 0 && !getResponseHeader(event, "Content-Length")) {
    setResponseHeader(event, "Content-Length", asset.size);
  }
  return readAsset(id);
});

var __defProp$1 = Object.defineProperty;
var __defNormalProp$1 = (obj, key, value) => key in obj ? __defProp$1(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$1 = (obj, key, value) => __defNormalProp$1(obj, typeof key !== "symbol" ? key + "" : key, value);
function _e$1(e) {
  let n;
  const t = _$1(e), r = { duplex: "half", method: e.method, headers: e.headers };
  return e.node.req.body instanceof ArrayBuffer ? new Request(t, { ...r, body: e.node.req.body }) : new Request(t, { ...r, get body() {
    return n || (n = Ge(e), n);
  } });
}
function Me$1(e) {
  var _a;
  return (_a = e.web) != null ? _a : e.web = { request: _e$1(e), url: _$1(e) }, e.web.request;
}
function De$1() {
  return Qe();
}
const O = /* @__PURE__ */ Symbol("$HTTPEvent");
function Ne(e) {
  return typeof e == "object" && (e instanceof H3Event || (e == null ? void 0 : e[O]) instanceof H3Event || (e == null ? void 0 : e.__is_event__) === true);
}
function u(e) {
  return function(...n) {
    var _a;
    let t = n[0];
    if (Ne(t)) n[0] = t instanceof H3Event || t.__is_event__ ? t : t[O];
    else {
      if (!((_a = globalThis.app.config.server.experimental) == null ? void 0 : _a.asyncContext)) throw new Error("AsyncLocalStorage was not enabled. Use the `server.experimental.asyncContext: true` option in your app configuration to enable it. Or, pass the instance of HTTPEvent that you have as the first argument to the function.");
      if (t = De$1(), !t) throw new Error("No HTTPEvent found in AsyncLocalStorage. Make sure you are using the function within the server runtime.");
      n.unshift(t);
    }
    return e(...n);
  };
}
const _$1 = u(getRequestURL$1), je = u(getRequestIP), S$1 = u(setResponseStatus$1), q = u(getResponseStatus), We = u(getResponseStatusText), y = u(getResponseHeaders), H$1 = u(getResponseHeader$1), Be$1 = u(setResponseHeader$1), M = u(appendResponseHeader$1), ze = u(parseCookies), Je = u(getCookie), Xe = u(setCookie), h = u(setHeader), Ge = u(getRequestWebStream), Ke = u(removeResponseHeader$1), Ve = u(Me$1);
function Ze() {
  var _a;
  return getContext("nitro-app", { asyncContext: !!((_a = globalThis.app.config.server.experimental) == null ? void 0 : _a.asyncContext), AsyncLocalStorage: AsyncLocalStorage });
}
function Qe() {
  return Ze().use().event;
}
const b$1 = "Invariant Violation", { setPrototypeOf: Ye = function(e, n) {
  return e.__proto__ = n, e;
} } = Object;
let T$1 = class T extends Error {
  constructor(n = b$1) {
    super(typeof n == "number" ? `${b$1}: ${n} (see https://github.com/apollographql/invariant-packages)` : n);
    __publicField$1(this, "framesToPop", 1);
    __publicField$1(this, "name", b$1);
    Ye(this, T.prototype);
  }
};
function et(e, n) {
  if (!e) throw new T$1(n);
}
const v = "solidFetchEvent";
function tt(e) {
  return { request: Ve(e), response: ot(e), clientAddress: je(e), locals: {}, nativeEvent: e };
}
function nt(e) {
  return { ...e };
}
function st(e) {
  if (!e.context[v]) {
    const n = tt(e);
    e.context[v] = n;
  }
  return e.context[v];
}
function P$1(e, n) {
  for (const [t, r] of n.entries()) M(e, t, r);
}
class rt {
  constructor(n) {
    __publicField$1(this, "event");
    this.event = n;
  }
  get(n) {
    const t = H$1(this.event, n);
    return Array.isArray(t) ? t.join(", ") : t || null;
  }
  has(n) {
    return this.get(n) !== null;
  }
  set(n, t) {
    return Be$1(this.event, n, t);
  }
  delete(n) {
    return Ke(this.event, n);
  }
  append(n, t) {
    M(this.event, n, t);
  }
  getSetCookie() {
    const n = H$1(this.event, "Set-Cookie");
    return Array.isArray(n) ? n : [n];
  }
  forEach(n) {
    return Object.entries(y(this.event)).forEach(([t, r]) => n(Array.isArray(r) ? r.join(", ") : r, t, this));
  }
  entries() {
    return Object.entries(y(this.event)).map(([n, t]) => [n, Array.isArray(t) ? t.join(", ") : t])[Symbol.iterator]();
  }
  keys() {
    return Object.keys(y(this.event))[Symbol.iterator]();
  }
  values() {
    return Object.values(y(this.event)).map((n) => Array.isArray(n) ? n.join(", ") : n)[Symbol.iterator]();
  }
  [Symbol.iterator]() {
    return this.entries()[Symbol.iterator]();
  }
}
function ot(e) {
  return { get status() {
    return q(e);
  }, set status(n) {
    S$1(e, n);
  }, get statusText() {
    return We(e);
  }, set statusText(n) {
    S$1(e, q(e), n);
  }, headers: new rt(e) };
}
const D = [{ page: true, path: "/dashboard", filePath: "/Users/gaspaco/Downloads/MeloStudio/src/routes/dashboard.tsx" }, { page: true, path: "/forgot", filePath: "/Users/gaspaco/Downloads/MeloStudio/src/routes/forgot.tsx" }, { page: true, path: "/", filePath: "/Users/gaspaco/Downloads/MeloStudio/src/routes/index.tsx" }, { page: true, path: "/login", filePath: "/Users/gaspaco/Downloads/MeloStudio/src/routes/login.tsx" }, { page: true, path: "/signup", filePath: "/Users/gaspaco/Downloads/MeloStudio/src/routes/signup.tsx" }], at = it(D.filter((e) => e.page));
function it(e) {
  function n(t, r, o, a) {
    const i = Object.values(t).find((c) => o.startsWith(c.id + "/"));
    return i ? (n(i.children || (i.children = []), r, o.slice(i.id.length)), t) : (t.push({ ...r, id: o, path: o.replace(/\([^)/]+\)/g, "").replace(/\/+/g, "/") }), t);
  }
  return e.sort((t, r) => t.path.length - r.path.length).reduce((t, r) => n(t, r, r.path, r.path), []);
}
function ct(e) {
  return e.$HEAD || e.$GET || e.$POST || e.$PUT || e.$PATCH || e.$DELETE;
}
createRouter({ routes: D.reduce((e, n) => {
  if (!ct(n)) return e;
  let t = n.path.replace(/\([^)/]+\)/g, "").replace(/\/+/g, "/").replace(/\*([^/]*)/g, (r, o) => `**:${o}`).split("/").map((r) => r.startsWith(":") || r.startsWith("*") ? r : encodeURIComponent(r)).join("/");
  if (/:[^/]*\?/g.test(t)) throw new Error(`Optional parameters are not supported in API routes: ${t}`);
  if (e[t]) throw new Error(`Duplicate API routes for "${t}" found at "${e[t].route.path}" and "${n.path}"`);
  return e[t] = { route: n }, e;
}, {}) });
var lt = " ";
const dt = { style: (e) => ssrElement("style", e.attrs, () => e.children, true), link: (e) => ssrElement("link", e.attrs, void 0, true), script: (e) => e.attrs.src ? ssrElement("script", mergeProps(() => e.attrs, { get id() {
  return e.key;
} }), () => ssr(lt), true) : null, noscript: (e) => ssrElement("noscript", e.attrs, () => escape(e.children), true) };
function pt(e, n) {
  let { tag: t, attrs: { key: r, ...o } = { key: void 0 }, children: a } = e;
  return dt[t]({ attrs: { ...o, nonce: n }, key: r, children: a });
}
function ft(e, n, t, r = "default") {
  return lazy(async () => {
    var _a;
    {
      const a = (await e.import())[r], c = (await ((_a = n.inputs) == null ? void 0 : _a[e.src].assets())).filter((l) => l.tag === "style" || l.attrs.rel === "stylesheet");
      return { default: (l) => [...c.map((g) => pt(g)), createComponent(a, l)] };
    }
  });
}
function N() {
  function e(t) {
    return { ...t, ...t.$$route ? t.$$route.require().route : void 0, info: { ...t.$$route ? t.$$route.require().route.info : {}, filesystem: true }, component: t.$component && ft(t.$component, globalThis.MANIFEST.client, globalThis.MANIFEST.ssr), children: t.children ? t.children.map(e) : void 0 };
  }
  return at.map(e);
}
let A;
const Ft = isServer ? () => getRequestEvent().routes : () => A || (A = N());
function ht(e) {
  const n = Je(e.nativeEvent, "flash");
  if (n) try {
    let t = JSON.parse(n);
    if (!t || !t.result) return;
    const r = [...t.input.slice(0, -1), new Map(t.input[t.input.length - 1])], o = t.error ? new Error(t.result) : t.result;
    return { input: r, url: t.url, pending: false, result: t.thrown ? void 0 : o, error: t.thrown ? o : void 0 };
  } catch (t) {
    console.error(t);
  } finally {
    Xe(e.nativeEvent, "flash", "", { maxAge: 0 });
  }
}
async function gt(e) {
  const n = globalThis.MANIFEST.client;
  return globalThis.MANIFEST.ssr, e.response.headers.set("Content-Type", "text/html"), Object.assign(e, { manifest: await n.json(), assets: [...await n.inputs[n.handler].assets()], router: { submission: ht(e) }, routes: N(), complete: false, $islands: /* @__PURE__ */ new Set() });
}
const mt = /* @__PURE__ */ new Set([301, 302, 303, 307, 308]);
function Rt(e) {
  return e.status && mt.has(e.status) ? e.status : 302;
}
const yt = {}, E = [AbortSignalPlugin, CustomEventPlugin, DOMExceptionPlugin, EventPlugin, FormDataPlugin, HeadersPlugin, ReadableStreamPlugin, RequestPlugin, ResponsePlugin, URLSearchParamsPlugin, URLPlugin], St = 64, j = Feature.RegExp;
function W(e) {
  const n = new TextEncoder().encode(e), t = n.length, r = t.toString(16), o = "00000000".substring(0, 8 - r.length) + r, a = new TextEncoder().encode(`;0x${o};`), i = new Uint8Array(12 + t);
  return i.set(a), i.set(n, 12), i;
}
function C$1(e, n) {
  return new ReadableStream({ start(t) {
    crossSerializeStream(n, { scopeId: e, plugins: E, onSerialize(r, o) {
      t.enqueue(W(o ? `(${getCrossReferenceHeader(e)},${r})` : r));
    }, onDone() {
      t.close();
    }, onError(r) {
      t.error(r);
    } });
  } });
}
function wt(e) {
  return new ReadableStream({ start(n) {
    toCrossJSONStream(e, { disabledFeatures: j, depthLimit: St, plugins: E, onParse(t) {
      n.enqueue(W(JSON.stringify(t)));
    }, onDone() {
      n.close();
    }, onError(t) {
      n.error(t);
    } });
  } });
}
async function k(e) {
  return fromJSON(JSON.parse(e), { plugins: E, disabledFeatures: j });
}
async function bt(e) {
  const n = st(e), t = n.request, r = t.headers.get("X-Server-Id"), o = t.headers.get("X-Server-Instance"), a = t.headers.has("X-Single-Flight"), i = new URL(t.url);
  let c, p;
  if (r) et(typeof r == "string", "Invalid server function"), [c, p] = decodeURIComponent(r).split("#");
  else if (c = i.searchParams.get("id"), p = i.searchParams.get("name"), !c || !p) return new Response(null, { status: 404 });
  const l = yt[c];
  let g;
  if (!l) return new Response(null, { status: 404 });
  g = await l.importer();
  const B = g[l.functionName];
  let f = [];
  if (!o || e.method === "GET") {
    const s = i.searchParams.get("args");
    if (s) {
      const d = await k(s);
      for (const m of d) f.push(m);
    }
  }
  if (e.method === "POST") {
    const s = t.headers.get("content-type"), d = e.node.req, m = d instanceof ReadableStream, z = d.body instanceof ReadableStream, J = m && d.locked || z && d.body.locked, X = m ? d : d.body, w = J ? t : new Request(t, { ...t, body: X });
    t.headers.get("x-serialized") ? f = await k(await w.text()) : (s == null ? void 0 : s.startsWith("multipart/form-data")) || (s == null ? void 0 : s.startsWith("application/x-www-form-urlencoded")) ? f.push(await w.formData()) : (s == null ? void 0 : s.startsWith("application/json")) && (f = await w.json());
  }
  try {
    let s = await provideRequestEvent(n, async () => (sharedConfig.context = { event: n }, n.locals.serverFunctionMeta = { id: c + "#" + p }, B(...f)));
    if (a && o && (s = await L(n, s)), s instanceof Response) {
      if (s.headers && s.headers.has("X-Content-Raw")) return s;
      o && (s.headers && P$1(e, s.headers), s.status && (s.status < 300 || s.status >= 400) && S$1(e, s.status), s.customBody ? s = await s.customBody() : s.body == null && (s = null));
    }
    if (!o) return F(s, t, f);
    return h(e, "x-serialized", "true"), h(e, "content-type", "text/javascript"), C$1(o, s);
    return wt(s);
  } catch (s) {
    if (s instanceof Response) a && o && (s = await L(n, s)), s.headers && P$1(e, s.headers), s.status && (!o || s.status < 300 || s.status >= 400) && S$1(e, s.status), s.customBody ? s = s.customBody() : s.body == null && (s = null), h(e, "X-Error", "true");
    else if (o) {
      const d = s instanceof Error ? s.message : typeof s == "string" ? s : "true";
      h(e, "X-Error", d.replace(/[\r\n]+/g, ""));
    } else s = F(s, t, f, true);
    return o ? (h(e, "x-serialized", "true"), h(e, "content-type", "text/javascript"), C$1(o, s)) : s;
  }
}
function F(e, n, t, r) {
  const o = new URL(n.url), a = e instanceof Error;
  let i = 302, c;
  return e instanceof Response ? (c = new Headers(e.headers), e.headers.has("Location") && (c.set("Location", new URL(e.headers.get("Location"), o.origin + "").toString()), i = Rt(e))) : c = new Headers({ Location: new URL(n.headers.get("referer")).toString() }), e && c.append("Set-Cookie", `flash=${encodeURIComponent(JSON.stringify({ url: o.pathname + o.search, result: a ? e.message : e, thrown: r, error: a, input: [...t.slice(0, -1), [...t[t.length - 1].entries()]] }))}; Secure; HttpOnly;`), new Response(null, { status: i, headers: c });
}
let $;
function vt(e) {
  var _a;
  const n = new Headers(e.request.headers), t = ze(e.nativeEvent), r = e.response.headers.getSetCookie();
  n.delete("cookie");
  let o = false;
  return ((_a = e.nativeEvent.node) == null ? void 0 : _a.req) && (o = true, e.nativeEvent.node.req.headers.cookie = ""), r.forEach((a) => {
    if (!a) return;
    const { maxAge: i, expires: c, name: p, value: l } = parseSetCookie(a);
    if (i != null && i <= 0) {
      delete t[p];
      return;
    }
    if (c != null && c.getTime() <= Date.now()) {
      delete t[p];
      return;
    }
    t[p] = l;
  }), Object.entries(t).forEach(([a, i]) => {
    n.append("cookie", `${a}=${i}`), o && (e.nativeEvent.node.req.headers.cookie += `${a}=${i};`);
  }), n;
}
async function L(e, n) {
  let t, r = new URL(e.request.headers.get("referer")).toString();
  n instanceof Response && (n.headers.has("X-Revalidate") && (t = n.headers.get("X-Revalidate").split(",")), n.headers.has("Location") && (r = new URL(n.headers.get("Location"), new URL(e.request.url).origin + "").toString()));
  const o = nt(e);
  return o.request = new Request(r, { headers: vt(e) }), await provideRequestEvent(o, async () => {
    await gt(o), $ || ($ = (await import('../build/App-CnvwUZj5.mjs')).default), o.router.dataOnly = t || true, o.router.previousUrl = e.request.headers.get("referer");
    try {
      renderToString(() => {
        sharedConfig.context.event = o, $();
      });
    } catch (c) {
      console.log(c);
    }
    const a = o.router.data;
    if (!a) return n;
    let i = false;
    for (const c in a) a[c] === void 0 ? delete a[c] : i = true;
    return i && (n instanceof Response ? n.customBody && (a._$value = n.customBody()) : (a._$value = n, n = new Response(null, { status: 200 })), n.customBody = () => a, n.headers.set("X-Single-Flight", "true")), n;
  });
}
const Lt = eventHandler$1(bt);

var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, key + "" , value);
const te = isServer ? (e) => {
  const t = getRequestEvent();
  return t.response.status = e.code, t.response.statusText = e.text, onCleanup(() => !t.nativeEvent.handled && !t.complete && (t.response.status = 200)), null;
} : (e) => null;
var ne = ["<span", ' style="font-size:1.5em;text-align:center;position:fixed;left:0px;bottom:55%;width:100%;">500 | Internal Server Error</span>'];
const re = (e) => {
  let t = false;
  const n = catchError(() => e.children, (r) => {
    console.error(r), t = !!r;
  });
  return t ? [ssr(ne, ssrHydrationKey()), createComponent$1(te, { code: 500 })] : n;
};
var se = " ";
const oe = { style: (e) => ssrElement("style", e.attrs, () => e.children, true), link: (e) => ssrElement("link", e.attrs, void 0, true), script: (e) => e.attrs.src ? ssrElement("script", mergeProps(() => e.attrs, { get id() {
  return e.key;
} }), () => ssr(se), true) : null, noscript: (e) => ssrElement("noscript", e.attrs, () => escape(e.children), true) };
function ae(e, t) {
  let { tag: n, attrs: { key: r, ...o } = { key: void 0 }, children: s } = e;
  return oe[n]({ attrs: { ...o, nonce: t }, key: r, children: s });
}
var b = ["<script", ">", "<\/script>"], T = ["<script", ' type="module"', "><\/script>"];
const ie = ssr("<!DOCTYPE html>");
function ce(e) {
  const t = getRequestEvent(), n = t.nonce;
  return createComponent$1(NoHydration, { get children() {
    return [ie, createComponent$1(re, { get children() {
      return createComponent$1(e.document, { get assets() {
        return t.assets.map((r) => ae(r));
      }, get scripts() {
        return n ? [ssr(b, ssrHydrationKey() + ssrAttribute("nonce", escape(n, true), false), `window.manifest = ${JSON.stringify(t.manifest)}`), ssr(T, ssrHydrationKey(), ssrAttribute("src", escape(globalThis.MANIFEST.client.inputs[globalThis.MANIFEST.client.handler].output.path, true), false))] : [ssr(b, ssrHydrationKey(), `window.manifest = ${JSON.stringify(t.manifest)}`), ssr(T, ssrHydrationKey(), ssrAttribute("src", escape(globalThis.MANIFEST.client.inputs[globalThis.MANIFEST.client.handler].output.path, true), false))];
      } });
    } })];
  } });
}
function ue(e) {
  let t;
  const n = C(e), r = { duplex: "half", method: e.method, headers: e.headers };
  return e.node.req.body instanceof ArrayBuffer ? new Request(n, { ...r, body: e.node.req.body }) : new Request(n, { ...r, get body() {
    return t || (t = Re(e), t);
  } });
}
function le(e) {
  var _a;
  return (_a = e.web) != null ? _a : e.web = { request: ue(e), url: C(e) }, e.web.request;
}
function pe() {
  return $e();
}
const P = /* @__PURE__ */ Symbol("$HTTPEvent");
function de(e) {
  return typeof e == "object" && (e instanceof H3Event || (e == null ? void 0 : e[P]) instanceof H3Event || (e == null ? void 0 : e.__is_event__) === true);
}
function a(e) {
  return function(...t) {
    var _a;
    let n = t[0];
    if (de(n)) t[0] = n instanceof H3Event || n.__is_event__ ? n : n[P];
    else {
      if (!((_a = globalThis.app.config.server.experimental) == null ? void 0 : _a.asyncContext)) throw new Error("AsyncLocalStorage was not enabled. Use the `server.experimental.asyncContext: true` option in your app configuration to enable it. Or, pass the instance of HTTPEvent that you have as the first argument to the function.");
      if (n = pe(), !n) throw new Error("No HTTPEvent found in AsyncLocalStorage. Make sure you are using the function within the server runtime.");
      t.unshift(n);
    }
    return e(...t);
  };
}
const C = a(getRequestURL$1), he = a(getRequestIP), w = a(setResponseStatus$1), x = a(getResponseStatus), fe = a(getResponseStatusText), m = a(getResponseHeaders), H = a(getResponseHeader$1), ge = a(setResponseHeader$1), me = a(appendResponseHeader$1), ye = a(sendRedirect$1), Re = a(getRequestWebStream), Se = a(removeResponseHeader$1), Ee = a(le);
function ve() {
  var _a;
  return getContext("nitro-app", { asyncContext: !!((_a = globalThis.app.config.server.experimental) == null ? void 0 : _a.asyncContext), AsyncLocalStorage: AsyncLocalStorage });
}
function $e() {
  return ve().use().event;
}
const _ = [{ page: true, path: "/dashboard", filePath: "/Users/gaspaco/Downloads/MeloStudio/src/routes/dashboard.tsx" }, { page: true, path: "/forgot", filePath: "/Users/gaspaco/Downloads/MeloStudio/src/routes/forgot.tsx" }, { page: true, path: "/", filePath: "/Users/gaspaco/Downloads/MeloStudio/src/routes/index.tsx" }, { page: true, path: "/login", filePath: "/Users/gaspaco/Downloads/MeloStudio/src/routes/login.tsx" }, { page: true, path: "/signup", filePath: "/Users/gaspaco/Downloads/MeloStudio/src/routes/signup.tsx" }];
be(_.filter((e) => e.page));
function be(e) {
  function t(n, r, o, s) {
    const c = Object.values(n).find((i) => o.startsWith(i.id + "/"));
    return c ? (t(c.children || (c.children = []), r, o.slice(c.id.length)), n) : (n.push({ ...r, id: o, path: o.replace(/\([^)/]+\)/g, "").replace(/\/+/g, "/") }), n);
  }
  return e.sort((n, r) => n.path.length - r.path.length).reduce((n, r) => t(n, r, r.path, r.path), []);
}
function Te(e, t) {
  const n = xe.lookup(e);
  if (n && n.route) {
    const r = n.route, o = t === "HEAD" ? r.$HEAD || r.$GET : r[`$${t}`];
    if (o === void 0) return;
    const s = r.page === true && r.$component !== void 0;
    return { handler: o, params: n.params, isPage: s };
  }
}
function we(e) {
  return e.$HEAD || e.$GET || e.$POST || e.$PUT || e.$PATCH || e.$DELETE;
}
const xe = createRouter({ routes: _.reduce((e, t) => {
  if (!we(t)) return e;
  let n = t.path.replace(/\([^)/]+\)/g, "").replace(/\/+/g, "/").replace(/\*([^/]*)/g, (r, o) => `**:${o}`).split("/").map((r) => r.startsWith(":") || r.startsWith("*") ? r : encodeURIComponent(r)).join("/");
  if (/:[^/]*\?/g.test(n)) throw new Error(`Optional parameters are not supported in API routes: ${n}`);
  if (e[n]) throw new Error(`Duplicate API routes for "${n}" found at "${e[n].route.path}" and "${t.path}"`);
  return e[n] = { route: t }, e;
}, {}) }), S = "solidFetchEvent";
function He(e) {
  return { request: Ee(e), response: Pe(e), clientAddress: he(e), locals: {}, nativeEvent: e };
}
function Ae(e) {
  if (!e.context[S]) {
    const t = He(e);
    e.context[S] = t;
  }
  return e.context[S];
}
class qe {
  constructor(t) {
    __publicField(this, "event");
    this.event = t;
  }
  get(t) {
    const n = H(this.event, t);
    return Array.isArray(n) ? n.join(", ") : n || null;
  }
  has(t) {
    return this.get(t) !== null;
  }
  set(t, n) {
    return ge(this.event, t, n);
  }
  delete(t) {
    return Se(this.event, t);
  }
  append(t, n) {
    me(this.event, t, n);
  }
  getSetCookie() {
    const t = H(this.event, "Set-Cookie");
    return Array.isArray(t) ? t : [t];
  }
  forEach(t) {
    return Object.entries(m(this.event)).forEach(([n, r]) => t(Array.isArray(r) ? r.join(", ") : r, n, this));
  }
  entries() {
    return Object.entries(m(this.event)).map(([t, n]) => [t, Array.isArray(n) ? n.join(", ") : n])[Symbol.iterator]();
  }
  keys() {
    return Object.keys(m(this.event))[Symbol.iterator]();
  }
  values() {
    return Object.values(m(this.event)).map((t) => Array.isArray(t) ? t.join(", ") : t)[Symbol.iterator]();
  }
  [Symbol.iterator]() {
    return this.entries()[Symbol.iterator]();
  }
}
function Pe(e) {
  return { get status() {
    return x(e);
  }, set status(t) {
    w(e, t);
  }, get statusText() {
    return fe(e);
  }, set statusText(t) {
    w(e, x(e), t);
  }, headers: new qe(e) };
}
const Ce = /* @__PURE__ */ new Set([301, 302, 303, 307, 308]);
function _e(e) {
  return e.status && Ce.has(e.status) ? e.status : 302;
}
function ke(e, t, n = {}, r) {
  return eventHandler$1({ handler: (o) => {
    const s = Ae(o);
    return provideRequestEvent(s, async () => {
      const c = Te(new URL(s.request.url).pathname, s.request.method);
      if (c) {
        const h = await c.handler.import(), y = s.request.method === "HEAD" ? h.HEAD || h.GET : h[s.request.method];
        s.params = c.params || {}, sharedConfig.context = { event: s };
        const v = await y(s);
        if (v !== void 0) return v;
        if (s.request.method !== "GET") throw new Error(`API handler for ${s.request.method} "${s.request.url}" did not return a response.`);
        if (!c.isPage) return;
      }
      const i = await t(s), f = typeof n == "function" ? await n(i) : { ...n };
      f.mode, f.nonce && (i.nonce = f.nonce);
      {
        const h = renderToString(() => (sharedConfig.context.event = i, e(i)), f);
        if (i.complete = true, i.response && i.response.headers.get("Location")) {
          const y = _e(i.response);
          return ye(o, i.response.headers.get("Location"), y);
        }
        return h;
      }
    });
  } });
}
function Ie(e, t, n) {
  return ke(e, Me, t);
}
async function Me(e) {
  const t = globalThis.MANIFEST.client;
  return Object.assign(e, { manifest: await t.json(), assets: [...await t.inputs[t.handler].assets()], routes: [], complete: false, $islands: /* @__PURE__ */ new Set() });
}
var De = ['<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&amp;family=Great+Vibes&amp;display=swap" rel="stylesheet"><link rel="icon" type="image/svg+xml" href="/Icon.svg"><title>MeloStudio</title>', "</head>"], Oe = ["<html", ' lang="en">', '<body><div id="app">', "</div><!--$-->", "<!--/--></body></html>"];
const Be = Ie(() => createComponent$1(ce, { document: ({ assets: e, children: t, scripts: n }) => ssr(Oe, ssrHydrationKey(), createComponent$1(NoHydration, { get children() {
  return ssr(De, escape(e));
} }), escape(t), escape(n)) }));

const handlers = [
  { route: '', handler: _dXclHI, lazy: false, middleware: true, method: undefined },
  { route: '/_server', handler: Lt, lazy: false, middleware: true, method: undefined },
  { route: '/', handler: Be, lazy: false, middleware: true, method: undefined }
];

function createNitroApp() {
  const config = useRuntimeConfig();
  const hooks = createHooks();
  const captureError = (error, context = {}) => {
    const promise = hooks.callHookParallel("error", error, context).catch((error_) => {
      console.error("Error while capturing another error", error_);
    });
    if (context.event && isEvent(context.event)) {
      const errors = context.event.context.nitro?.errors;
      if (errors) {
        errors.push({ error, context });
      }
      if (context.event.waitUntil) {
        context.event.waitUntil(promise);
      }
    }
  };
  const h3App = createApp({
    debug: destr(false),
    onError: (error, event) => {
      captureError(error, { event, tags: ["request"] });
      return errorHandler(error, event);
    },
    onRequest: async (event) => {
      event.context.nitro = event.context.nitro || { errors: [] };
      const fetchContext = event.node.req?.__unenv__;
      if (fetchContext?._platform) {
        event.context = {
          _platform: fetchContext?._platform,
          // #3335
          ...fetchContext._platform,
          ...event.context
        };
      }
      if (!event.context.waitUntil && fetchContext?.waitUntil) {
        event.context.waitUntil = fetchContext.waitUntil;
      }
      event.fetch = (req, init) => fetchWithEvent(event, req, init, { fetch: localFetch });
      event.$fetch = (req, init) => fetchWithEvent(event, req, init, {
        fetch: $fetch
      });
      event.waitUntil = (promise) => {
        if (!event.context.nitro._waitUntilPromises) {
          event.context.nitro._waitUntilPromises = [];
        }
        event.context.nitro._waitUntilPromises.push(promise);
        if (event.context.waitUntil) {
          event.context.waitUntil(promise);
        }
      };
      event.captureError = (error, context) => {
        captureError(error, { event, ...context });
      };
      await nitroApp$1.hooks.callHook("request", event).catch((error) => {
        captureError(error, { event, tags: ["request"] });
      });
    },
    onBeforeResponse: async (event, response) => {
      await nitroApp$1.hooks.callHook("beforeResponse", event, response).catch((error) => {
        captureError(error, { event, tags: ["request", "response"] });
      });
    },
    onAfterResponse: async (event, response) => {
      await nitroApp$1.hooks.callHook("afterResponse", event, response).catch((error) => {
        captureError(error, { event, tags: ["request", "response"] });
      });
    }
  });
  const router = createRouter$1({
    preemptive: true
  });
  const nodeHandler = toNodeListener(h3App);
  const localCall = (aRequest) => callNodeRequestHandler(
    nodeHandler,
    aRequest
  );
  const localFetch = (input, init) => {
    if (!input.toString().startsWith("/")) {
      return globalThis.fetch(input, init);
    }
    return fetchNodeRequestHandler(
      nodeHandler,
      input,
      init
    ).then((response) => normalizeFetchResponse(response));
  };
  const $fetch = createFetch({
    fetch: localFetch,
    Headers: Headers$1,
    defaults: { baseURL: config.app.baseURL }
  });
  globalThis.$fetch = $fetch;
  h3App.use(createRouteRulesHandler({ localFetch }));
  for (const h of handlers) {
    let handler = h.lazy ? lazyEventHandler(h.handler) : h.handler;
    if (h.middleware || !h.route) {
      const middlewareBase = (config.app.baseURL + (h.route || "/")).replace(
        /\/+/g,
        "/"
      );
      h3App.use(middlewareBase, handler);
    } else {
      const routeRules = getRouteRulesForPath(
        h.route.replace(/:\w+|\*\*/g, "_")
      );
      if (routeRules.cache) {
        handler = cachedEventHandler(handler, {
          group: "nitro/routes",
          ...routeRules.cache
        });
      }
      router.use(h.route, handler, h.method);
    }
  }
  h3App.use(config.app.baseURL, router.handler);
  {
    const _handler = h3App.handler;
    h3App.handler = (event) => {
      const ctx = { event };
      return nitroAsyncContext.callAsync(ctx, () => _handler(event));
    };
  }
  const app = {
    hooks,
    h3App,
    router,
    localCall,
    localFetch,
    captureError
  };
  return app;
}
function runNitroPlugins(nitroApp2) {
  for (const plugin of plugins) {
    try {
      plugin(nitroApp2);
    } catch (error) {
      nitroApp2.captureError(error, { tags: ["plugin"] });
      throw error;
    }
  }
}
const nitroApp$1 = createNitroApp();
function useNitroApp() {
  return nitroApp$1;
}
runNitroPlugins(nitroApp$1);

const nitroApp = useNitroApp();
const localFetch = nitroApp.localFetch;
const closePrerenderer = () => nitroApp.hooks.callHook("close");
trapUnhandledNodeErrors();

export { Ft as F, closePrerenderer as c, localFetch as l };
//# sourceMappingURL=nitro.mjs.map
