import { isIP } from "node:net";

const IGNORED_WAKE_CHAR = /[\s，。！？、,.!?；;：“”‘’'"`~·]/;

export function normalizeText(value) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
}

export function normalizeWakeText(value) {
  return String(value || "").toLocaleLowerCase().replace(/[\s，。！？、,.!?；;：“”‘’'"`~·]/g, "");
}

export function removeWakeWord(text, wakeWord) {
  const source = String(text || "");
  const normalized = normalizeWakeText(source);
  const normalizedWake = normalizeWakeText(wakeWord);
  if (!normalizedWake) return null;
  const index = normalized.indexOf(normalizedWake);
  if (index < 0) return null;
  let normalizedOffset = 0;
  let start = -1;
  let end = -1;
  for (let offset = 0; offset < source.length;) {
    const codePoint = source.codePointAt(offset);
    if (codePoint == null) break;
    const char = String.fromCodePoint(codePoint);
    const width = char.length;
    if (!IGNORED_WAKE_CHAR.test(char)) {
      if (normalizedOffset === index) start = offset;
      normalizedOffset += char.toLocaleLowerCase().length;
      if (start >= 0 && normalizedOffset >= index + normalizedWake.length) {
        end = offset + width;
        break;
      }
    }
    offset += width;
  }
  if (start < 0 || end < 0) return null;
  return source.slice(end).replace(/^[\s，。！？、,.!?；;：“”‘’'"`~·]+/, "").trim();
}

function privateIpv4(host) {
  const octets = host.split(".").map(Number);
  if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) return false;
  const [first, second] = octets;
  return first === 0 || first === 10 || first === 127 || (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) || (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) || (first === 198 && (second === 18 || second === 19));
}

export function isPrivateHost(input) {
  const host = String(input || "").replace(/^\[|\]$/g, "").toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;
  // URL parsers accept integer and abbreviated IPv4 spellings that can map to
  // loopback/private addresses. Only accept a numeric host when it is a full,
  // valid IPv4 address and then apply the private-range check below.
  if (/^\d+(?:\.\d+){0,3}$/.test(host)) {
    if (host.split(".").length !== 4 || !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return true;
  }
  if (/^0x[0-9a-f]+$/i.test(host)) return true;
  const version = isIP(host);
  if (version === 4) return privateIpv4(host);
  if (version === 6) {
    if (host === "::" || host === "::1" || host.startsWith("fc") || host.startsWith("fd") || /^fe[89ab]/.test(host)) return true;
    if (host.startsWith("::ffff:")) return privateIpv4(host.slice(7));
  }
  return false;
}

export function safeUrl(input) {
  const url = new URL(String(input));
  if (!/^https?:$/.test(url.protocol) || isPrivateHost(url.hostname)) throw new Error("unsafe_url");
  return url;
}
