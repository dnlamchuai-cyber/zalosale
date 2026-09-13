// Ai viết: Codex
// Tại sao: tách đúng dòng địa chỉ khỏi nội dung tin để geocoder không nhận cả phần giá/tiện ích.
// Link: docs/03_SPEC/SPEC-006_MapRadiusSearch.md

const ADDRESS_MARKER_PATTERN = /(?:dia\s*chi|d\/c|dc|vi\s*tri)\s*[:\-]?/i;
const ADDRESS_PREFIX_PATTERN = /(?:ngo|ngach|hem|duong|pho|so\s+\d|kdt|khu\s+do\s+thi|chung\s+cu)\b/i;

function normalizeAddressLine(line) {
  const withoutLeadingMarks = line.replace(/^[^\p{L}\p{N}]*/u, "").trim();
  const marker = withoutLeadingMarks.match(/^(?:địa\s*chỉ|dia\s*chi|đc|dc|d\/c|vị\s*trí|vi\s*tri)\s*[:\-]?\s*/iu);
  if (marker) return trimAddressDescription(withoutLeadingMarks.slice(marker[0].length).trim());
  const prefix = withoutLeadingMarks.match(/(?:^|\s)(ngõ|ngo|ngách|ngach|hẻm|hem|đường|duong|phố|pho|số\s+\d|so\s+\d|kđt|kdt|khu\s+đô\s+thị|khu\s+do\s+thi|chung\s+cư|chung\s+cu)(?=\s|$)/iu);
  return prefix ? trimAddressDescription(withoutLeadingMarks.slice(prefix.index + (prefix[0].startsWith(" ") ? 1 : 0)).trim()) : trimAddressDescription(withoutLeadingMarks);
}

function trimAddressDescription(address) {
  return address.split(/\s+[–—]\s+/u)[0].trim();
}

export function extractRoomAddress(content) {
  const lines = String(content || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const markerLines = lines.filter((line) => {
    const normalized = line.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d");
    return ADDRESS_MARKER_PATTERN.test(normalized);
  });
  if (markerLines.length) return normalizeAddressLine(markerLines[markerLines.length - 1]).slice(0, 300);
  const prefixLine = lines.find((line) => ADDRESS_PREFIX_PATTERN.test(line.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d")));
  return prefixLine ? normalizeAddressLine(prefixLine).slice(0, 300) : "";
}
