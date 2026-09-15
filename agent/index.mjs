import { createServer } from "node:http";
import { readFile, writeFile, mkdir, rename, cp, rm, open, stat, readdir } from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, defineTool } from "@earendil-works/pi-coding-agent";
import OpenCC from "opencc-js";
import { Type } from "typebox";
import { isPrivateHost, normalizeText, safeUrl, whisperModelForService } from "./text.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const portFlag = process.argv.indexOf("--port");
const PORT = Number(portFlag >= 0 ? process.argv[portFlag + 1] : process.env.VIVOFLOW_AGENT_PORT || 8790);
const WHISPER_URL = process.env.VIVOFLOW_WHISPER_URL || "http://127.0.0.1:8792";
const CHATTTS_URL = process.env.VIVOFLOW_CHATTTS_URL || "http://127.0.0.1:8791";
const DEFAULT_OLLAMA = "http://127.0.0.1:11434";
const WHISPER_MODEL_SHA256 = {
  base: "60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe",
  small: "1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b",
  medium: "6c14d5adee5f86394037b4e4e8b59f1673b6cee10e3cf0b11bbdbee79c156208",
};
const WHISPER_ARCHIVE_SHA256 = {
  "whisper-bin-x64.zip": "a06889697e51436b80cd34f441c5d557dad55ffd9337e55e224cfdf4efd710a5",
  "whisper-cublas-12.4.0-bin-x64.zip": "5f42c4bc4a817d30aabaa12991d40db922387352875df06bf21ca2665ec7aeb1",
};
const DATA_ROOT = process.env.VIVOFLOW_AGENT_DATA || path.join(path.dirname(configPath()), "agent");
const sessions = new Map();
const activeRuns = new Map();
const children = [];
let chatttsProcess = null;
let whisperProcess = null;
let installJob = null;
const downloadJobs = new Map();
const downloadControllers = new Map();
const toSimplifiedChinese = OpenCC.Converter({ from: "tw", to: "cn" });

function trackChild(child, name) {
  child.on("error", (error) => console.warn(`${name}_process_error`, error.message));
  child.on("exit", (code, signal) => { if (code !== 0 && signal !== "SIGTERM") console.warn(`${name}_process_exit`, code, signal); });
  children.push(child);
  return child;
}

function startChatTts(python, script) {
  if (chatttsProcess && chatttsProcess.exitCode == null) return;
  chatttsProcess = trackChild(spawn(python, [script], { windowsHide: true, stdio: "ignore", env: { ...process.env, VIVOFLOW_CHATTTS_PORT: "8791", HF_HOME: path.join(DATA_ROOT, "huggingface") } }), "chattts");
  chatttsProcess.once("exit", () => { chatttsProcess = null; });
}

function startWhisper(binary, model, cfg) {
  if (whisperProcess && whisperProcess.exitCode == null) return;
  const args = ["--host", "127.0.0.1", "--port", "8792", "--model", model, "--language", "zh", "--no-timestamps", "--no-context"];
  if (cfg.agent_voice_device === "cpu") args.push("--no-gpu");
  whisperProcess = trackChild(spawn(binary, args, { windowsHide: true, stdio: "ignore" }), "whisper");
  whisperProcess.once("exit", () => { whisperProcess = null; });
}

function whisperBinaryName(cfg) {
  return cfg.agent_voice_device === "cuda" ? "whisper-server-cuda.exe" : "whisper-server.exe";
}

function whisperArchiveName(cfg) {
  return cfg.agent_voice_device === "cuda" ? "whisper-cublas-12.4.0-bin-x64.zip" : "whisper-bin-x64.zip";
}

function managedPythonPath() {
  return path.join(DATA_ROOT, ".venv", process.platform === "win32" ? "Scripts" : "bin", process.platform === "win32" ? "python.exe" : "python");
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    const append = (chunk) => { output = `${output}${chunk}`.slice(-8000); };
    child.stdout?.on("data", append);
    child.stderr?.on("data", append);
    child.on("error", reject);
    child.on("exit", (code, signal) => code === 0 ? resolve(output) : reject(new Error(`${path.basename(command)}_exit_${code ?? signal}\n${output}`)));
  });
}

function configPath() {
  return process.env.VIVOFLOW_CONFIG || path.join(process.env.LOCALAPPDATA || ROOT, "VivoFlow", "config.json");
}

async function readConfig() {
  try { return JSON.parse(await readFile(configPath(), "utf8")); } catch { return {}; }
}

function ollamaBase(cfg) {
  const raw = String(cfg.agent_ollama_url || DEFAULT_OLLAMA).trim();
  try {
    const url = new URL(raw);
    return /^https?:$/.test(url.protocol) && url.hostname ? raw.replace(/\/$/, "") : DEFAULT_OLLAMA;
  } catch { return DEFAULT_OLLAMA; }
}

function json(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "content-length": Buffer.byteLength(body) });
  res.end(body);
}

function normalizeChineseText(value) {
  return normalizeText(toSimplifiedChinese(String(value || "")));
}

async function bodyBuffer(req, limit = 8 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error("request_too_large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function bodyJson(req) {
  const raw = await bodyBuffer(req, 2 * 1024 * 1024);
  return raw.length ? JSON.parse(raw.toString("utf8")) : {};
}

function writeNdjson(res, value) {
  if (!res.writableEnded && !res.destroyed) res.write(`${JSON.stringify(value)}\n`);
}

async function assertInternet(settings) {
  if (settings.internetEnabled !== true) throw new Error("internet_disabled");
  const current = await readConfig();
  if (current.agent_internet_enabled !== true) throw new Error("internet_disabled");
}

function requestSignal(signal, timeoutMs) {
  const timeout = AbortSignal.timeout(timeoutMs);
  if (!signal) return timeout;
  if (typeof AbortSignal.any === "function") return AbortSignal.any([signal, timeout]);
  return timeout;
}

async function fetchPublic(input, options = {}) {
  let url = safeUrl(input);
  const { timeoutMs = 10000, signal, ...init } = options;
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    await assertPublicTarget(url);
    const response = await fetch(url, { ...init, redirect: "manual", signal: requestSignal(signal, timeoutMs) });
    if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
      await response.body?.cancel();
      url = safeUrl(new URL(response.headers.get("location"), url).toString());
      continue;
    }
    return { response, url };
  }
  throw new Error("too_many_redirects");
}

async function assertPublicTarget(url) {
  if (isPrivateHost(url.hostname)) throw new Error("unsafe_url");
  // Check DNS answers as well as the textual hostname so a public-looking
  // name cannot be used to reach loopback, private, link-local, or mapped
  // addresses. Every redirect calls this function again.
  try {
    const records = await lookup(url.hostname, { all: true, verbatim: true });
    if (!records.length || records.some((record) => isPrivateHost(record.address))) throw new Error("unsafe_url");
  } catch (error) {
    if (error instanceof Error && error.message === "unsafe_url") throw error;
    throw new Error("dns_lookup_failed");
  }
}

async function readTextLimited(response, limit) {
  if (!response.body) return { text: "", truncated: false };
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  let truncated = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const remaining = limit - size;
      if (remaining <= 0) { truncated = true; await reader.cancel(); break; }
      const chunk = value.byteLength > remaining ? value.subarray(0, remaining) : value;
      chunks.push(Buffer.from(chunk));
      size += chunk.byteLength;
      if (chunk.byteLength < value.byteLength) { truncated = true; await reader.cancel(); break; }
    }
  } finally { reader.releaseLock(); }
  return { text: Buffer.concat(chunks).toString("utf8"), truncated };
}

function toolError(error) {
  throw new Error(`工具执行失败：${error instanceof Error ? error.message : String(error)}`);
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_match, code) => {
      const numeric = Number(code);
      return Number.isInteger(numeric) && numeric >= 0 && numeric <= 0x10ffff ? String.fromCodePoint(numeric) : "";
    });
}

function searchResultUrl(raw) {
  const redirect = new URL(decodeHtml(raw), "https://duckduckgo.com");
  const target = redirect.searchParams.get("uddg");
  return target ? safeUrl(target).toString() : safeUrl(redirect.toString()).toString();
}

function createTools(settings, defaultCity) {
  const datetime = defineTool({
    name: "get_current_datetime", label: "当前时间", description: "获取当前日期、时间、星期和时区。", parameters: Type.Object({ timezone: Type.Optional(Type.String()) }),
    execute: async (_id, params) => {
      try {
        const now = new Date();
        const timezone = params?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
        let formatted;
        let actualTimezone = timezone;
        let dateFormatter;
        let timeFormatter;
        try {
          dateFormatter = new Intl.DateTimeFormat("zh-CN", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", weekday: "long" });
          timeFormatter = new Intl.DateTimeFormat("zh-CN", { timeZone: timezone, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
          formatted = new Intl.DateTimeFormat("zh-CN", { timeZone: timezone, dateStyle: "full", timeStyle: "long" }).format(now);
        }
        catch {
          actualTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
          dateFormatter = new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", weekday: "long" });
          timeFormatter = new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
          formatted = new Intl.DateTimeFormat("zh-CN", { dateStyle: "full", timeStyle: "long" }).format(now);
        }
        const dateParts = Object.fromEntries(dateFormatter.formatToParts(now).map(({ type, value }) => [type, value]));
        const timeParts = Object.fromEntries(timeFormatter.formatToParts(now).map(({ type, value }) => [type, value]));
        return { content: [{ type: "text", text: JSON.stringify({ iso: now.toISOString(), timezone: actualTimezone, date: dateParts.year && dateParts.month && dateParts.day ? `${dateParts.year}-${dateParts.month}-${dateParts.day}` : dateFormatter.format(now), time: [timeParts.hour, timeParts.minute, timeParts.second].filter(Boolean).join(":"), weekday: dateParts.weekday || "", formatted }) }], details: {} };
      } catch (error) { return toolError(error); }
    },
  });
  const weather = defineTool({
    name: "get_current_weather", label: "当前天气", description: "获取指定城市的当前天气；没有城市时使用默认城市。", parameters: Type.Object({ city: Type.Optional(Type.String()) }),
    execute: async (_id, params, signal) => {
      try {
        await assertInternet(settings);
        const city = normalizeText(params?.city || settings.defaultCity || defaultCity);
        if (!city) return { content: [{ type: "text", text: "未提供城市，请先询问用户所在城市。" }], details: {} };
        const geo = await fetchPublic(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=zh&format=json`, { signal });
        if (!geo.response.ok) throw new Error(`geocoding_http_${geo.response.status}`);
        const location = (await geo.response.json()).results?.[0];
        if (!location) throw new Error("city_not_found");
        const weatherResponse = await fetchPublic(`https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=auto`, { signal });
        if (!weatherResponse.response.ok) throw new Error(`weather_http_${weatherResponse.response.status}`);
        return { content: [{ type: "text", text: JSON.stringify({ city: location.name, country: location.country, current: (await weatherResponse.response.json()).current, source: { name: "Open-Meteo", geocoding: geo.url.toString(), forecast: weatherResponse.url.toString() } }) }], details: {} };
      } catch (error) { return toolError(error); }
    },
  });
  const search = defineTool({
    name: "web_search", label: "网页搜索", description: "搜索公开网页并返回标题、链接和摘要。", parameters: Type.Object({ query: Type.String() }),
    execute: async (_id, params, signal) => {
      try {
        await assertInternet(settings);
        const query = normalizeText(params?.query);
        if (!query) throw new Error("query_required");
        const { response } = await fetchPublic(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, { headers: { accept: "text/html" }, signal });
        const html = (await readTextLimited(response, 2_000_000)).text;
        if (response.status !== 200 || /captcha|unusual traffic|机器人验证|automated queries|anomaly-modal|challenge-form|bots use duckduckgo/i.test(html)) throw new Error(`search_unavailable_${response.status}`);
        const results = [...html.matchAll(/result__a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?result__snippet[^>]*>([\s\S]*?)<\/a>/gi)].slice(0, 8).flatMap((match) => {
          try {
            return [{ url: searchResultUrl(match[1]), title: decodeHtml(match[2].replace(/<[^>]+>/g, "").trim()), snippet: decodeHtml(match[3].replace(/<[^>]+>/g, "").trim()) }];
          } catch { return []; }
        });
        return { content: [{ type: "text", text: JSON.stringify(results) }], details: {} };
      } catch (error) { return toolError(error); }
    },
  });
  const webfetch = defineTool({
    name: "webfetch", label: "读取网页", description: "读取一个公开 HTTP(S) 网页的正文。", parameters: Type.Object({ url: Type.String() }),
    execute: async (_id, params, signal) => {
      try {
        await assertInternet(settings);
        const { response, url } = await fetchPublic(params?.url, { headers: { accept: "text/html,text/plain,application/xhtml+xml" }, signal });
        if (!response.ok) throw new Error(`webfetch_http_${response.status}`);
        const raw = await readTextLimited(response, 2_000_000);
        const title = decodeHtml((raw.text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()).slice(0, 240);
        const text = decodeHtml(raw.text.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
        return { content: [{ type: "text", text: JSON.stringify({ url: url.toString(), title, content: text.slice(0, 12000), truncated: raw.truncated || text.length > 12000 }) }], details: {} };
      } catch (error) { return toolError(error); }
    },
  });
  return [datetime, weather, search, webfetch];
}

async function createSession(sessionId, cfg) {
  const modelName = cfg.agent_ollama_model || "llama3.1:8b";
  const ollama = ollamaBase(cfg);
  const settings = { internetEnabled: Boolean(cfg.agent_internet_enabled), defaultCity: normalizeText(cfg.agent_default_city || "") };
  await mkdir(DATA_ROOT, { recursive: true });
  const modelsPath = path.join(DATA_ROOT, ".models.json");
  await writeFile(modelsPath, JSON.stringify({ providers: { ollama: { baseUrl: `${ollama}/v1`, api: "openai-completions", apiKey: "ollama", compat: { supportsDeveloperRole: false, supportsReasoningEffort: false }, models: [{ id: modelName, name: modelName, input: ["text"], contextWindow: 32768, maxTokens: 4096 }] } } }));
  const modelRuntime = await ModelRuntime.create({ modelsPath });
  const model = modelRuntime.getModel("ollama", modelName);
  if (!model) throw new Error(`ollama_model_unavailable:${modelName}`);
  const cfgLoader = new DefaultResourceLoader({ cwd: ROOT, agentDir: ROOT, noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true, systemPrompt: "你是 VivoFlow 的中文个人助理。用简体中文回答，先调用准确的工具再回答。联网资料必须在回答中附上来源链接。只把最终答复正文用于语音播报，回答简洁、自然，不要复述工具 JSON。" });
  await cfgLoader.reload();
  const session = (await createAgentSession({ model, modelRuntime, resourceLoader: cfgLoader, sessionManager: SessionManager.inMemory(), noTools: "builtin", customTools: createTools(settings, cfg.agent_default_city || "") })).session;
  const item = { session, cfg, modelName, ollama, settings };
  sessions.set(sessionId, item);
  return item;
}

async function chat(req, res) {
  const payload = await bodyJson(req);
  const sessionId = normalizeText(payload.sessionId) || randomUUID();
  const message = normalizeText(payload.message);
  if (!message) return json(res, 400, { error: "message_required" });
  const cfg = await readConfig();
  const modelName = cfg.agent_ollama_model || "llama3.1:8b";
  const ollama = ollamaBase(cfg);
  if (activeRuns.has(sessionId)) return json(res, 409, { error: "session_busy" });
  const modelAvailable = await isModelAvailable(ollama, modelName);
  if (modelAvailable === false) return json(res, 503, { error: "ollama_model_unavailable", model: modelName });
  const toolSupport = await modelSupportsTools(ollama, modelName);
  if (toolSupport === false) return json(res, 422, { error: "model_tool_calls_unsupported", model: modelName });
  let item = sessions.get(sessionId);
  if (!item || item.modelName !== modelName || item.ollama !== ollama) {
    await item?.session.dispose();
    try {
      item = await createSession(sessionId, { ...cfg, agent_internet_enabled: payload.internetEnabled == null ? cfg.agent_internet_enabled === true : payload.internetEnabled === true });
    } catch (error) {
      return json(res, 503, { error: error instanceof Error ? error.message : String(error), model: modelName });
    }
  }
  item.settings.internetEnabled = payload.internetEnabled == null ? cfg.agent_internet_enabled === true : payload.internetEnabled === true;
  item.settings.defaultCity = normalizeText(cfg.agent_default_city || "");
  res.writeHead(200, { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "transfer-encoding": "chunked" });
  const turnId = randomUUID();
  const startedAt = performance.now();
  let firstTextMs = null;
  const write = (event) => writeNdjson(res, { sessionId, turnId, ...event });
  const unsubscribe = item.session.subscribe((event) => {
    if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
      if (firstTextMs == null) firstTextMs = Math.round(performance.now() - startedAt);
      write({ type: "delta", delta: event.assistantMessageEvent.delta });
    }
    else if (event.type === "tool_execution_start") write({ type: "tool_start", tool: event.toolName });
    else if (event.type === "tool_execution_end") write({ type: "tool_end", tool: event.toolName, error: event.isError, errorText: event.isError ? event.result?.content?.find((part) => part.type === "text")?.text : undefined });
  });
  activeRuns.set(sessionId, item.session);
  write({ type: "start", startedAt: Date.now() });
  let settled = false;
  res.on("close", () => { if (!settled) void item.session.abort(); });
  try {
    await item.session.prompt(message);
    write({ type: "metrics", metrics: { firstTextMs, totalMs: Math.round(performance.now() - startedAt) } });
    write({ type: "end" });
  } catch (error) {
    write({ type: "error", error: error instanceof Error ? error.message : String(error) });
  } finally {
    settled = true;
    activeRuns.delete(sessionId);
    unsubscribe();
    res.end();
  }
}

async function transcribe(req, res) {
  const startedAt = performance.now();
  try {
    const audio = await bodyBuffer(req, 30 * 1024 * 1024);
    const form = new FormData();
    form.append("file", new Blob([audio], { type: "audio/wav" }), "speech.wav");
    form.append("response_format", "json");
    form.append("language", "zh");
    const response = await fetch(`${WHISPER_URL}/inference`, { method: "POST", body: form, signal: AbortSignal.timeout(45000) });
    if (!response.ok) throw new Error(`whisper_http_${response.status}`);
    const result = await response.json();
    json(res, 200, { text: normalizeChineseText(result.text), language: "zh-CN", durationMs: Math.round(performance.now() - startedAt) });
  } catch (error) { json(res, 503, { error: error instanceof Error ? error.message : String(error) }); }
}

async function tts(req, res) {
  const startedAt = performance.now();
  try {
    const payload = await bodyJson(req);
    const response = await fetch(`${CHATTTS_URL}/synthesize`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: normalizeText(payload.text), device: payload.device || "auto" }), signal: AbortSignal.timeout(120000) });
    const data = Buffer.from(await response.arrayBuffer());
    res.writeHead(response.ok ? 200 : 503, { "content-type": response.headers.get("content-type") || "audio/wav", "cache-control": "no-store", "content-length": data.length, "x-vivoflow-tts-ms": String(Math.round(performance.now() - startedAt)) });
    res.end(data);
  } catch (error) { json(res, 503, { error: error instanceof Error ? error.message : String(error) }); }
}

async function clearSession(req, res) {
  const sessionId = normalizeText((await bodyJson(req)).sessionId);
  const running = activeRuns.get(sessionId);
  if (running) await running.abort();
  const item = sessions.get(sessionId);
  if (item) {
    await item.session.dispose();
    sessions.delete(sessionId);
  }
  return json(res, 200, { ok: true });
}

async function health() {
  const cfg = await readConfig();
  const checks = await Promise.allSettled([fetch(`${ollamaBase(cfg)}/api/tags`, { signal: AbortSignal.timeout(1500) }), fetch(`${WHISPER_URL}/health`, { signal: AbortSignal.timeout(1500) }), fetch(`${CHATTTS_URL}/health`, { signal: AbortSignal.timeout(1500) })]);
  const probe = async (result, requireReady = false) => {
    if (result.status !== "fulfilled" || !result.value.ok) return { ok: false, payload: {} };
    const payload = await result.value.json().catch(() => ({}));
    return { ok: !requireReady || payload.ready === true || payload.loaded === true || payload.status === "ok", payload };
  };
  const ollama = await probe(checks[0]);
  const whisper = await probe(checks[1], true);
  const chattts = await probe(checks[2], true);
  const modelName = cfg.agent_ollama_model || "llama3.1:8b";
  let ollamaModel = null;
  if (ollama.ok) {
    const listedModels = Array.isArray(ollama.payload.models) ? ollama.payload.models : null;
    ollamaModel = listedModels
      ? listedModels.some((model) => (model?.name || model?.model) === modelName)
      : await isModelAvailable(ollamaBase(cfg), modelName);
  }
  const missing = [
    !ollama.ok ? "ollama" : null,
    ollamaModel === false ? `ollama_model:${modelName}` : null,
    !whisper.ok ? "whisper" : null,
    !chattts.ok ? "chattts" : null,
  ].filter(Boolean);
  const whisperModels = Object.fromEntries(
    ["base", "small", "medium"].map((name) => [
      name,
      existsSync(path.join(DATA_ROOT, "whisper", "models", `ggml-${name}.bin`)),
    ]),
  );
  const whisperBinary = existsSync(path.join(DATA_ROOT, "whisper", whisperBinaryName(cfg)));
  return {
    ready: missing.length === 0,
    node: true,
    nodeVersion: process.version,
    ollama: ollama.ok,
    ollamaModel,
    whisper: whisper.ok,
    whisperBinary,
    whisperModels,
    chattts: chattts.ok,
    chatttsRuntime: existsSync(managedPythonPath()),
    chatttsDevice: chattts.payload.device,
    model: modelName,
    missing,
  };
}

async function models(_req, res) {
  const cfg = await readConfig();
  try {
    const base = ollamaBase(cfg);
    const response = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return json(res, 503, { error: `ollama_http_${response.status}` });
    const payload = await response.json();
    const listed = Array.isArray(payload.models) ? payload.models : [];
    const enriched = await Promise.all(listed.map(async (model) => ({ ...model, supportsTools: await modelSupportsTools(base, model.name || model.model) })));
    return json(res, 200, { ...payload, models: enriched });
  } catch (error) {
    return json(res, 503, { error: error instanceof Error ? error.message : String(error) });
  }
}

async function ollamaTest(_req, res) {
  const cfg = await readConfig();
  const url = ollamaBase(cfg);
  try {
    const response = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return json(res, 503, { ok: false, error: `ollama_http_${response.status}`, url });
    const payload = await response.json();
    return json(res, 200, { ok: true, url, models: Array.isArray(payload.models) ? payload.models.length : 0 });
  } catch (error) {
    return json(res, 503, { ok: false, error: error instanceof Error ? error.message : String(error), url });
  }
}

async function modelSupportsTools(base, modelName) {
  if (!modelName) return null;
  try {
    const response = await fetch(`${base}/api/show`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: modelName }), signal: AbortSignal.timeout(3000) });
    if (!response.ok) return null;
    const payload = await response.json();
    const capabilities = payload.capabilities || payload.model_info?.capabilities;
    return Array.isArray(capabilities) ? capabilities.includes("tools") : null;
  } catch { return null; }
}

async function isModelAvailable(base, modelName) {
  try {
    const response = await fetch(`${base}/api/show`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: modelName }), signal: AbortSignal.timeout(3000) });
    if (response.status === 404) return false;
    return response.ok ? true : null;
  } catch { return null; }
}

async function download(service, signal) {
  const existing = downloadJobs.get(service);
  if (existing?.status === "running") return { ok: false, service, error: "download_in_progress", ...existing };
  const job = { id: randomUUID(), service, status: "running", phase: "starting", received: 0, total: null, error: "" };
  downloadJobs.set(service, job);
  const cfg = await readConfig();
  if (service === "chattts") {
    try {
      job.phase = "chattts";
      const response = await fetch(`${CHATTTS_URL}/prepare`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ device: cfg.agent_voice_device || "auto" }), signal: requestSignal(signal, 30 * 60 * 1000) });
      const result = { ok: response.ok, service, ...(await response.json()) };
      job.status = result.ok ? "completed" : "failed";
      job.error = result.ok ? "" : String(result.error || "chattts_prepare_failed");
      return { ...result, ...job };
    } catch (error) {
      job.status = "failed"; job.error = error instanceof Error ? error.message : String(error);
      return { ok: false, service, error: job.error, ...job };
    }
  }
  let whisperModel = null;
  try { whisperModel = whisperModelForService(service, cfg.agent_whisper_model); }
  catch (error) {
    job.status = "failed"; job.phase = "error"; job.error = error instanceof Error ? error.message : String(error);
    return { ok: false, service, error: job.error, ...job };
  }
  if (whisperModel) {
    const model = whisperModel;
    const destination = path.join(DATA_ROOT, "whisper", "models", `ggml-${model}.bin`);
    // Pin the model repository revision alongside its SHA-256 so a future
    // upstream replacement cannot silently change the downloaded weights.
    const url = `https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-${model}.bin?download=true`;
    try {
      job.phase = "model";
      const onProgress = ({ received, total }) => { job.received = received; job.total = total; };
      await mkdir(path.dirname(destination), { recursive: true });
      await downloadToFile(url, destination, { signal, sha256: WHISPER_MODEL_SHA256[model], onProgress });
      const binary = path.join(DATA_ROOT, "whisper", whisperBinaryName(cfg));
      if (!existsSync(binary)) { job.phase = "binary"; await downloadWhisperBinary(binary, signal, onProgress); }
      if (!process.env.VIVOFLOW_DISABLE_WHISPER) startWhisper(binary, destination, cfg);
      job.status = "completed"; job.phase = "ready";
      return { ok: true, service, model, path: destination, binary, ...job };
    } catch (error) {
      job.status = "failed"; job.phase = "error"; job.error = error instanceof Error ? error.message : String(error);
      return { ok: false, service, model, error: job.error, ...job };
    }
  }
  job.status = "failed"; job.phase = "error"; job.error = "unknown_service";
  return { ok: false, service, error: job.error, ...job };
}

async function installEnvironment() {
  if (installJob?.status === "running") return installJob;
  const job = { id: randomUUID(), status: "running", phase: "starting", message: "", error: "" };
  installJob = job;
  void (async () => {
    try {
      await mkdir(DATA_ROOT, { recursive: true });
      const venv = path.join(DATA_ROOT, ".venv");
      const python = managedPythonPath();
      if (!existsSync(python)) {
        job.phase = "python";
        job.message = "正在创建 Python 3.11 虚拟环境";
        const uv = process.env.VIVOFLOW_UV || "uv";
        try {
          await runCommand(uv, ["venv", "--python", "3.11", venv]);
        } catch {
          await rm(venv, { recursive: true, force: true }).catch(() => {});
          const fallback = process.env.VIVOFLOW_PYTHON
            ? [[process.env.VIVOFLOW_PYTHON, ["-m", "venv", venv]]]
            : process.platform === "win32"
              ? [["py", ["-3.11", "-m", "venv", venv]], ["python", ["-m", "venv", venv]]]
              : [["python3", ["-m", "venv", venv]], ["python", ["-m", "venv", venv]]];
          let created = false;
          let lastError;
          for (const [command, args] of fallback) {
            try {
              await runCommand(command, args);
              created = true;
              break;
            } catch (error) {
              lastError = error;
              await rm(venv, { recursive: true, force: true }).catch(() => {});
            }
          }
          if (!created) throw lastError || new Error("python_3_11_unavailable");
        }
      }
      job.phase = "packages";
      job.message = "正在安装 ChatTTS 依赖";
      const requirements = path.join(ROOT, "requirements.txt");
      const uv = process.env.VIVOFLOW_UV || "uv";
      try {
        await runCommand(uv, ["pip", "install", "--python", python, "-r", requirements]);
      } catch {
        await runCommand(python, ["-m", "pip", "install", "-r", requirements]);
      }
      if (existsSync(path.join(ROOT, "chattts_service.py")) && !process.env.VIVOFLOW_DISABLE_CHATTTS) {
        if (chatttsProcess && chatttsProcess.exitCode == null) {
          const previous = chatttsProcess;
          chatttsProcess = null;
          previous.kill();
          await new Promise((resolve) => { previous.once("exit", resolve); setTimeout(resolve, 2000); });
        }
        startChatTts(python, path.join(ROOT, "chattts_service.py"));
      }
      job.status = "completed";
      job.phase = "ready";
      job.message = "运行环境已准备完成";
    } catch (error) {
      job.status = "failed";
      job.phase = "error";
      job.error = error instanceof Error ? error.message : String(error);
      job.message = "运行环境安装失败";
    }
  })();
  return job;
}

async function downloadToFile(url, destination, { signal, sha256, onProgress } = {}) {
  const temporary = `${destination}.part`;
  let offset = 0;
  try {
    if (sha256 && existsSync(destination)) {
      if (await sha256File(destination) === sha256) return;
      // Keep the currently enabled artifact available while a replacement is
      // downloaded.  The verified .part file is enabled with rename below;
      // a failed or cancelled download therefore cannot remove a good copy.
    }
    offset = await stat(temporary).then((value) => value.size).catch(() => 0);
    const headers = offset ? { range: `bytes=${offset}-` } : undefined;
    let response = await fetch(url, { headers, signal: requestSignal(signal, 30 * 60 * 1000) });
    const range = response.headers.get("content-range");
    if (offset && (response.status !== 206 || !range?.startsWith(`bytes ${offset}-`))) {
      offset = 0;
      await response.body?.cancel();
      response = await fetch(url, { signal: requestSignal(signal, 30 * 60 * 1000) });
    }
    if (!response.ok || !response.body) throw new Error(`download_http_${response.status}`);
    const contentLength = Number(response.headers.get("content-length"));
    const total = Number.isFinite(contentLength) && contentLength > 0 ? contentLength + offset : null;
    const handle = await open(temporary, offset ? "a" : "w");
    try {
      let received = offset;
      for await (const chunk of response.body) {
        await handle.write(chunk);
        received += chunk.byteLength;
        onProgress?.({ received, total });
      }
    } finally { await handle.close(); }
    if (sha256) {
      const actual = await sha256File(temporary);
      if (actual !== sha256) {
        await rm(temporary, { force: true });
        throw new Error("download_checksum_mismatch");
      }
    }
    await rename(temporary, destination);
  } catch (error) {
    if (error instanceof Error && error.message === "download_checksum_mismatch") await rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}

async function sha256File(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

async function downloadWhisperBinary(destination, signal, onProgress) {
  const cfg = await readConfig();
  const archiveName = whisperArchiveName(cfg);
  const archive = path.join(DATA_ROOT, "whisper", archiveName);
  const unpacked = path.join(DATA_ROOT, "whisper", "unpacked");
  await downloadToFile(`https://github.com/ggml-org/whisper.cpp/releases/download/v1.8.7/${archiveName}`, archive, { signal, sha256: WHISPER_ARCHIVE_SHA256[archiveName], onProgress });
  await mkdir(unpacked, { recursive: true });
  if (process.platform === "win32") {
    await new Promise((resolve, reject) => {
      const quote = (value) => `'${String(value).replace(/'/g, "''")}'`;
      const command = `Expand-Archive -LiteralPath ${quote(archive)} -DestinationPath ${quote(unpacked)} -Force`;
      const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], { windowsHide: true, stdio: "ignore" });
      child.on("error", reject); child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`expand_archive_${code}`)));
    });
  } else {
    await new Promise((resolve, reject) => { const child = spawn("unzip", ["-o", archive, "-d", unpacked], { stdio: "ignore" }); child.on("error", reject); child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`unzip_${code}`))); });
  }
  const extracted = path.join(unpacked, "Release", "whisper-server.exe");
  if (!existsSync(extracted)) throw new Error("whisper_server_missing_from_archive");
  // The executable depends on the ggml/SDL/CUDA DLLs shipped beside it in
  // Release.  Copy the complete runtime set next to the selected executable;
  // copying only whisper-server.exe would start successfully on some machines
  // and then fail with a missing DLL on the target host.
  const releaseDir = path.dirname(extracted);
  const targetDir = path.dirname(destination);
  for (const entry of await readdir(releaseDir)) {
    await cp(path.join(releaseDir, entry), path.join(targetDir, entry), { recursive: true, force: true });
  }
  await cp(extracted, destination);
}

async function startManagedServices() {
  const managedPython = managedPythonPath();
  const python = process.env.VIVOFLOW_PYTHON || (existsSync(managedPython) ? managedPython : "python");
  const chatttsScript = path.join(ROOT, "chattts_service.py");
  if (existsSync(chatttsScript) && !process.env.VIVOFLOW_DISABLE_CHATTTS) {
    startChatTts(python, chatttsScript);
  }
  const cfg = await readConfig();
  const whisper = process.env.VIVOFLOW_WHISPER_BIN || path.join(DATA_ROOT, "whisper", whisperBinaryName(cfg));
  const model = path.join(DATA_ROOT, "whisper", "models", `ggml-${["base", "small", "medium"].includes(cfg.agent_whisper_model) ? cfg.agent_whisper_model : "small"}.bin`);
  if (existsSync(whisper) && existsSync(model) && !process.env.VIVOFLOW_DISABLE_WHISPER) {
    startWhisper(whisper, model, cfg);
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);
    if (req.method === "GET" && url.pathname === "/health") return json(res, 200, await health());
    if (req.method === "GET" && url.pathname === "/models") return models(req, res);
    if (req.method === "GET" && url.pathname === "/ollama/test") return ollamaTest(req, res);
    if (req.method === "GET" && url.pathname === "/install/status") return json(res, 200, installJob || { status: "idle" });
    if (req.method === "POST" && url.pathname === "/install") return json(res, 202, await installEnvironment());
    if (req.method === "POST" && url.pathname === "/chat") return chat(req, res);
    if (req.method === "POST" && url.pathname === "/cancel") { const session = activeRuns.get((await bodyJson(req)).sessionId); if (session) await session.abort(); return json(res, 200, { ok: true }); }
    if (req.method === "POST" && url.pathname === "/clear") return clearSession(req, res);
    if (req.method === "POST" && url.pathname === "/transcribe") return transcribe(req, res);
    if (req.method === "POST" && url.pathname === "/tts") return tts(req, res);
    if (req.method === "GET" && url.pathname.startsWith("/download-status/")) {
      const service = url.pathname.slice("/download-status/".length);
      return json(res, 200, downloadJobs.get(service) || { service, status: "idle" });
    }
    if (req.method === "POST" && url.pathname.startsWith("/download-cancel/")) {
      const service = url.pathname.slice("/download-cancel/".length);
      downloadControllers.get(service)?.abort();
      return json(res, 200, { ok: true, service });
    }
    if (req.method === "POST" && url.pathname.startsWith("/download/")) {
      const service = url.pathname.slice("/download/".length);
      const running = downloadJobs.get(service);
      if (running?.status === "running") return json(res, 409, { ok: false, service, error: "download_in_progress", ...running });
      const controller = new AbortController();
      downloadControllers.set(service, controller);
      res.on("close", () => { if (!res.writableEnded) controller.abort(); });
      let result;
      try {
        result = await download(service, controller.signal);
      } finally {
        if (downloadControllers.get(service) === controller) downloadControllers.delete(service);
      }
      return json(res, result.ok ? 200 : 503, result);
    }
    return json(res, 404, { error: "not_found" });
  } catch (error) { json(res, 400, { error: error instanceof Error ? error.message : String(error) }); }
});

server.listen(PORT, "127.0.0.1");
void startManagedServices().catch((error) => console.warn("managed_services_error", error instanceof Error ? error.message : String(error)));
process.on("SIGTERM", () => { for (const child of children) child.kill(); server.close(() => process.exit(0)); });
