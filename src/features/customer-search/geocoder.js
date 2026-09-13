// Ai viết: Codex
// Tại sao: cô lập Nominatim, rate-limit và timeout để không làm bẩn service/route bằng I/O ngoài.
// Link: docs/03_SPEC/SPEC-006_MapRadiusSearch.md + docs/04_PROMPTS/PROMPT-010_RoomLocationResolution.md

const MAX_RESPONSE_BYTES = 1_000_000; // WHY: chặn phản hồi bất thường từ dịch vụ ngoài.
const DEFAULT_TIMEOUT_MS = 10_000; // WHY: thao tác định vị không được giữ request vô hạn.
const DEFAULT_MIN_INTERVAL_MS = 1_000; // WHY: tuân thủ tối đa 1 request/giây của Nominatim.

function geocoderError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseCandidates(payload) {
  if (!Array.isArray(payload)) return [];
  return payload.flatMap((item) => {
    const latitude = Number(item?.lat);
    const longitude = Number(item?.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return [];
    return [{
      latitude,
      longitude,
      displayName: typeof item.display_name === "string" ? item.display_name.slice(0, 300) : "",
      importance: Number.isFinite(Number(item.importance)) ? Number(item.importance) : null,
    }];
  });
}

function parsePhotonCandidates(payload) {
  if (!Array.isArray(payload?.features)) return [];
  return payload.features.flatMap((feature) => {
    const coordinates = feature?.geometry?.coordinates;
    const longitude = Number(coordinates?.[0]);
    const latitude = Number(coordinates?.[1]);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return [];
    const properties = feature.properties || {};
    const displayName = [properties.name, properties.street, properties.city, properties.state]
      .filter((value) => typeof value === "string" && value.trim()).join(", ").slice(0, 300);
    return [{ latitude, longitude, displayName, importance: null }];
  });
}

export function normalizeAddress(address) {
  return String(address).normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("vi-VN");
}

export function createNominatimGeocoder({
  fetcher = globalThis.fetch,
  userAgent = process.env.NOMINATIM_USER_AGENT || "zaloSALE/0.1 (local room finder)",
  minIntervalMs = DEFAULT_MIN_INTERVAL_MS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  now = () => Date.now(),
  sleep = wait,
} = {}) {
  if (typeof fetcher !== "function") throw geocoderError("GEOCODER_UNAVAILABLE", "Không có kết nối geocoder");
  let lastRequestAt = 0;
  let queue = Promise.resolve();

  async function request(address) {
    const elapsed = now() - lastRequestAt;
    if (elapsed < minIntervalMs) await sleep(minIntervalMs - elapsed);
    lastRequestAt = now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=1&q=${encodeURIComponent(address)}`;
      const response = await fetcher(url, { headers: { Accept: "application/json", "User-Agent": userAgent }, signal: controller.signal });
      if (response.status === 429) throw geocoderError("RATE_LIMITED", "Geocoder đang giới hạn truy cập");
      if (!response.ok) throw geocoderError("GEOCODER_FAILED", "Geocoder không phản hồi hợp lệ");
      const text = typeof response.text === "function" ? await response.text() : JSON.stringify(await response.json());
      if (Buffer.byteLength(text, "utf8") > MAX_RESPONSE_BYTES) throw geocoderError("GEOCODER_FAILED", "Phản hồi geocoder quá lớn");
      return parseCandidates(JSON.parse(text));
    } catch (error) {
      const primaryError = error?.name === "AbortError"
        ? geocoderError("TIMEOUT", "Geocoder hết thời gian chờ")
        : error?.code ? error : geocoderError("GEOCODER_FAILED", "Không thể định vị địa chỉ");
      try {
        const fallbackController = new AbortController();
        const fallbackTimeout = setTimeout(() => fallbackController.abort(), timeoutMs);
        const fallbackUrl = `https://photon.komoot.io/api/?limit=5&q=${encodeURIComponent(address)}`;
        try {
          const fallbackResponse = await fetcher(fallbackUrl, { headers: { Accept: "application/json", "User-Agent": userAgent }, signal: fallbackController.signal });
          const fallbackText = typeof fallbackResponse.text === "function" ? await fallbackResponse.text() : JSON.stringify(await fallbackResponse.json());
          if (!fallbackResponse.ok || Buffer.byteLength(fallbackText, "utf8") > MAX_RESPONSE_BYTES) throw primaryError;
          return parsePhotonCandidates(JSON.parse(fallbackText));
        } finally {
          clearTimeout(fallbackTimeout);
        }
      } catch {
        throw primaryError;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  function geocode(address) {
    const run = queue.then(() => request(address));
    queue = run.catch(() => {});
    return run;
  }

  return { geocode };
}
