const $ = (id) => document.getElementById(id);

let state = { config: null };

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function api(path, opts) {
  const res = await fetch(path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function note(el, text, kind) {
  el.textContent = text;
  el.className = "note " + (kind || "");
}

/* ---------- tabs ---------- */
document.querySelectorAll(".tab").forEach((btn) =>
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b === btn));
    document.querySelectorAll(".tabpane").forEach((p) => p.classList.toggle("active", p.id === "tab-" + btn.dataset.tab));
  })
);

/* ---------- mode ---------- */
$("modeSelect").addEventListener("change", async () => {
  try {
    await api("/api/control", { method: "POST", body: JSON.stringify({ action: "mode", mode: $("modeSelect").value }) });
    note($("cfgResult"), "Đã đổi mode: " + $("modeSelect").value, "ok");
    loadStatus();
  } catch (e) {
    note($("cfgResult"), e.message, "err");
  }
});

/* ---------- config form ---------- */
const splitList = (v) => v.split(/\r?\n|,/).map((s) => s.trim()).filter(Boolean);

async function loadConfig() {
  state.config = (await api("/api/config")).config;
  fillConfigForm();
  fillAreaForm();
}

function fillConfigForm() {
  const c = state.config;
  $("cfgSources").value = (c.sourceGroups || []).join("\n");
  $("cfgDeleteLines").value = (c.deleteLines || []).join("\n");
  $("cfgExclude").value = (c.excludeKeywords || []).join("\n");
  $("cfgDefaultArea").value = c.defaultArea ?? "";
  $("cfgFltPercent").checked = !!c.filter?.removePercentLines;
  $("cfgFltPrice").checked = !!c.filter?.removePriceLines;
  $("cfgWinMs").value = c.forward.windowMs;
  $("cfgMaxItems").value = c.forward.maxBatchItems;
  $("cfgMaxWait").value = c.forward.maxWaitMs;
  $("cfgSendDelay").value = c.forward.sendDelayMs;
  $("cfgRetries").value = c.forward.retries;
  $("cfgHistGap").value = c.forward.historyGapMs;
  $("modeSelect").value = c.mode;
}

function collectConfig() {
  const c = state.config || {};
  return {
    ...c,
    mode: $("modeSelect").value,
    sourceGroups: splitList($("cfgSources").value),
    deleteLines: splitList($("cfgDeleteLines").value),
    excludeKeywords: splitList($("cfgExclude").value),
    defaultArea: $("cfgDefaultArea").value.trim() || null,
    filter: {
      removePercentLines: $("cfgFltPercent").checked,
      removePriceLines: $("cfgFltPrice").checked,
    },
    forward: {
      ...(c.forward || {}),
      windowMs: +$("cfgWinMs").value,
      maxBatchItems: +$("cfgMaxItems").value,
      maxWaitMs: +$("cfgMaxWait").value,
      sendDelayMs: +$("cfgSendDelay").value,
      retries: +$("cfgRetries").value,
      historyGapMs: +$("cfgHistGap").value,
    },
  };
}

async function doSave(raw) {
  const res = await api("/api/config", { method: "POST", body: JSON.stringify(raw) });
  state.config = res.config;
}

$("btnSaveCfg").addEventListener("click", async () => {
  try {
    await doSave(collectConfig());
    note($("cfgResult"), "Đã lưu cấu hình ✓ (có hiệu lực ngay)", "ok");
  } catch (e) {
    note($("cfgResult"), e.message, "err");
  }
});

/* ---------- areas ---------- */
let areaInfo = {}; // index -> {name, groupId} sau khi resolve

function fillAreaForm() {
  const box = $("areaRows");
  box.innerHTML = "";
  (state.config?.areas || []).forEach((a, i) => box.appendChild(areaRow(a, i)));
  renderAreaInfo();
}

function areaRow(a, i) {
  const div = document.createElement("div");
  div.className = "area-row";
  div.innerHTML = `
    <input class="a-kw" placeholder="Từ khoá, cách nhau bằng dấu phẩy" value="${esc((a.keywords || []).join(", "))}" />
    <input class="a-link" placeholder="Link nhóm đích (https://zalo.me/g/...)" value="${esc(a.groupLink || "")}" />
    <input class="a-id" placeholder="ID (nếu cần)" value="${esc(a.id || "")}" />
    <button class="ghost a-del" title="Xoá khu vực">🗑</button>
    <div class="a-res"></div>`;
  div.querySelector(".a-del").addEventListener("click", () => {
    state.config.areas.splice(i, 1);
    delete areaInfo[i];
    fillAreaForm();
  });
  return div;
}

function renderAreaInfo() {
  document.querySelectorAll("#areaRows .area-row").forEach((row, i) => {
    const info = areaInfo[i];
    const el = row.querySelector(".a-res");
    if (!el) return;
    if (!info) {
      el.textContent = "";
      return;
    }
    if (info.ok) {
      el.textContent = `✓ ${info.name} — ID: ${info.groupId}`;
      el.className = "a-res ok";
    } else {
      el.textContent = `✗ ${info.error || "không resolve được"}`;
      el.className = "a-res err";
    }
  });
}

async function resolveAreas() {
  const btn = $("btnResolveAreas");
  btn.disabled = true;
  btn.textContent = "Đang kiểm tra…";
  try {
    await doSave(state.config);
    const r = await api("/api/control", { method: "POST", body: JSON.stringify({ action: "resolve" }) });
    areaInfo = {};
    for (const a of r.areas || []) areaInfo[a.index] = a;
    renderAreaInfo();
    note($("areaResult"), "Đã kiểm tra xong — tên nhóm thật hiện dưới từng khu vực ✓", "ok");
  } catch (e) {
    note($("areaResult"), "✗ " + e.message, "err");
  } finally {
    btn.disabled = false;
    btn.textContent = "🔎 Kiểm tra link → tên nhóm";
  }
}

$("btnResolveAreas").addEventListener("click", resolveAreas);

$("btnAddArea").addEventListener("click", () => {
  state.config.areas.push({ keywords: [], groupLink: "", id: "" });
  fillAreaForm();
});

$("btnSaveAreas").addEventListener("click", async () => {
  const rows = [...document.querySelectorAll("#areaRows .area-row")];
  state.config.areas = rows.map((r) => ({
    keywords: splitList(r.querySelector(".a-kw").value),
    groupLink: r.querySelector(".a-link").value.trim(),
    id: r.querySelector(".a-id").value.trim() || undefined,
  }));
  try {
    await doSave(state.config);
    note($("areaResult"), "Đã lưu khu vực ✓ (có hiệu lực ngay)", "ok");
    loadStatus();
  } catch (e) {
    note($("areaResult"), e.message, "err");
  }
});

/* ---------- status ---------- */
async function loadStatus() {
  try {
    const s = await api("/api/status");
    $("stMode").textContent = s.mode;
    $("stForwarded").textContent = s.forwarded;
    $("stUptime").textContent = Math.round((Date.now() - new Date(s.startedAt).getTime()) / 60000) + " phút";
    $("stSources").textContent = (s.knownSources || []).length;
    $("modeSelect").value = s.mode;
    const loggedIn = !!s.loggedIn;
    $("loginState").textContent = loggedIn ? "✔ Đã đăng nhập" : "✘ Chưa đăng nhập (bấm Đăng nhập lại)";
    $("loginState").className = "note " + (loggedIn ? "ok" : "err");
    $("connDot").className = "dot " + (loggedIn ? "online" : "err");
    $("connText").textContent = loggedIn ? "bot đã đăng nhập" : "chưa đăng nhập";
  } catch (e) {
    $("connDot").className = "dot err";
    $("connText").textContent = e.message;
  }
}

/* ---------- phiên đăng nhập: logout / relogin ---------- */
$("btnLogout").addEventListener("click", async () => {
  if (!confirm("Đăng xuất? Bot sẽ ngắt kết nối, cần đăng nhập lại để chạy tiếp.")) return;
  try {
    await api("/api/control", { method: "POST", body: JSON.stringify({ action: "logout" }) });
    note($("loginState"), "Đã đăng xuất ✓", "ok");
    $("qrOverlay").classList.add("hidden");
    loadStatus();
  } catch (e) {
    note($("loginState"), e.message, "err");
  }
});

$("btnRelogin").addEventListener("click", async () => {
  try {
    await api("/api/control", { method: "POST", body: JSON.stringify({ action: "relogin" }) });
    $("qrOverlay").classList.add("hidden");
    note($("loginState"), "Đang đăng nhập lại — ưu tiên phiên đã lưu, nếu không được sẽ hiện QR mới", "ok");
    loadStatus();
  } catch (e) {
    note($("loginState"), e.message, "err");
  }
});

$("btnNetCheck").addEventListener("click", async () => {
  try {
    const r = await api("/api/control", { method: "POST", body: JSON.stringify({ action: "netcheck" }) });
    $("netResult").innerHTML = "<b>Kiểm tra mạng tới Zalo:</b><br/>" + r.lines.map(esc).join("<br/>");
    $("netResult").className = "note " + (r.lines.some((l) => l.includes("KHÔNG")) ? "err" : "ok");
  } catch (e) {
    note($("netResult"), e.message, "err");
  }
});

/* ---------- quét danh sách nhóm (frontend) ---------- */
const PAGE_SIZE = 20;
let groupList = [];
let page = 0;
const selected = new Set();

async function loadGroups() {
  const btn = $("btnGroups");
  btn.disabled = true;
  btn.textContent = "Đang quét…";
  try {
    const g = (await api("/api/groups")).groups || [];
    groupList = g;
    page = 0;
    selected.clear();
    renderGroups();
    note($("groupsNote"), g.length ? `Quét xong: ${g.length} nhóm` : "Không lấy được nhóm nào (xem tab Nhật ký)", "ok");
  } catch (e) {
    note($("groupsNote"), "✗ " + e.message, "err");
  } finally {
    btn.disabled = false;
    btn.textContent = "Tải danh sách";
  }
}

function pageSlice() {
  return groupList.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
}

function cleanGroupName(name) {
  return String(name || "").replace(/\s*\[(đích|nói chung|bot đang tham gia|chưa vào được nhóm)\]$/i, "").trim();
}

function nameKey(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function renderGroups() {
  const tb = document.querySelector("#groupsTable tbody");
  tb.innerHTML = "";
  const rows = pageSlice();
  const srcNames = (state.config?.sourceGroups || []).map(nameKey).filter((s) => s && s.length >= 3);
  rows.forEach((gr, i) => {
    const idx = page * PAGE_SIZE + i;
    const name = String(gr.name || "?");
    const clean = nameKey(cleanGroupName(name));
    const isSrc =
      clean.length >= 3 && srcNames.some((s) => clean.includes(s) || s.includes(clean));
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="checkbox" class="chk-g" data-idx="${idx}" ${selected.has(idx) ? "checked" : ""} /></td>
      <td>${idx + 1}</td>
      <td>${esc(name)}${isSrc ? '<span class="badge">nguồn</span>' : ""}</td>
      <td><code>${esc(gr.id)}</code> <button class="btn-mini cp" data-id="${esc(String(gr.id))}">copy</button></td>
      <td><button class="btn-mini fwd" data-thread="${esc(String(gr.id))}">Chuyển tiếp ➜</button> <span class="note r"></span></td>`;
    tr.querySelector(".cp").addEventListener("click", (ev) => navigator.clipboard?.writeText(ev.currentTarget.dataset.id));
    tr.querySelector(".fwd").addEventListener("click", async (ev) => {
      const btn = ev.currentTarget;
      const resEl = btn.nextElementSibling;
      btn.disabled = true;
      try {
        const r = await api("/api/control", {
          method: "POST",
          body: JSON.stringify({ action: "forward", threadId: btn.dataset.thread, ...rangePayload() }),
        });
        resEl.textContent = `✓ ${r.total} bài${r.range ? " (" + r.range + ")" : ""}`;
        resEl.className = "note ok r";
      } catch (e) {
        resEl.textContent = "✗ " + e.message;
        resEl.className = "note err r";
      } finally {
        btn.disabled = false;
      }
    });
    tb.appendChild(tr);
  });
  updatePager();
  updateAddSrcBtn();
}

function updatePager() {
  const pages = Math.max(1, Math.ceil(groupList.length / PAGE_SIZE));
  $("pageInfo").textContent = `${page + 1} / ${pages} (${groupList.length} nhóm)`;
  $("btnPrevPage").disabled = page <= 0;
  $("btnNextPage").disabled = page >= pages - 1;
  const slice = pageSlice();
  $("chkAllPage").checked = slice.length > 0 && slice.every((_, i) => selected.has(page * PAGE_SIZE + i));
}

function updateAddSrcBtn() {
  $("btnAddSrc").textContent = `➕ Thêm vào nhóm nguồn (${selected.size})`;
  $("btnAddSrc").disabled = !selected.size;
}

$("chkAllPage").addEventListener("change", (ev) => {
  pageSlice().forEach((_, i) => {
    const idx = page * PAGE_SIZE + i;
    if (ev.target.checked) selected.add(idx);
    else selected.delete(idx);
  });
  renderGroups();
});

document.querySelector("#groupsTable tbody").addEventListener("change", (ev) => {
  if (!ev.target.classList.contains("chk-g")) return;
  const idx = Number(ev.target.dataset.idx);
  if (ev.target.checked) selected.add(idx);
  else selected.delete(idx);
  updatePager();
  updateAddSrcBtn();
});

$("btnPrevPage").addEventListener("click", () => {
  page = Math.max(0, page - 1);
  renderGroups();
});

$("btnNextPage").addEventListener("click", () => {
  page = Math.min(Math.max(1, Math.ceil(groupList.length / PAGE_SIZE)) - 1, page + 1);
  renderGroups();
});

$("btnAddSrc").addEventListener("click", async () => {
  const names = [...selected]
    .sort((a, b) => a - b)
    .map((i) => cleanGroupName(groupList[i]?.name) || String(groupList[i]?.id || ""))
    .filter(Boolean);
  const cur = new Set((state.config?.sourceGroups || []).map((s) => s.trim()));
  for (const n of names) if (n) cur.add(n);
  state.config.sourceGroups = [...cur];
  try {
    await doSave(state.config);
    note($("groupsNote"), `Đã thêm ${names.length} nhóm vào "Nhóm nguồn" ✓ (có hiệu lực ngay)`, "ok");
    selected.clear();
    fillConfigForm();
    renderGroups();
    loadStatus();
  } catch (e) {
    note($("groupsNote"), e.message, "err");
  }
});

$("btnGroups").addEventListener("click", loadGroups);

/* ---------- forward theo khoảng ngày ---------- */
function rangePayload() {
  return {
    from: $("fwdFrom").value || undefined,
    to: $("fwdTo").value || undefined,
  };
}

$("btnForward").addEventListener("click", async () => {
  try {
    const r = await api("/api/control", {
      method: "POST",
      body: JSON.stringify({ action: "forward", ...rangePayload() }),
    });
    note($("fwdResult"), `✓ ${r.total} bài từ ${r.groups} nhóm (${r.range})`, "ok");
  } catch (e) {
    note($("fwdResult"), "✗ " + e.message, "err");
  }
});

/* ---------- logs ---------- */
function appendLog({ level, line }) {
  const l = document.createElement("div");
  l.className = level;
  l.textContent = line;
  const box = $("logBox");
  box.appendChild(l);
  while (box.children.length > 500) box.firstChild.remove();
  box.scrollTop = box.scrollHeight;
}

async function loadLogs() {
  const d = await api("/api/logs");
  $("logBox").innerHTML = "";
  d.logs.forEach(appendLog);
}

$("btnClearLogs").addEventListener("click", () => ($("logBox").innerHTML = ""));

/* ---------- SSE ---------- */
function connectEvents() {
  const es = new EventSource("/api/events");
  es.onopen = () => {
    $("connDot").className = "dot online";
    $("connText").textContent = "giao diện online";
  };
  es.onerror = () => {
    $("connDot").className = "dot err";
    $("connText").textContent = "mất kết nối — đang thử lại…";
  };
  es.addEventListener("log", (ev) => appendLog(JSON.parse(ev.data)));
  es.addEventListener("qr", (ev) => {
    const qr = JSON.parse(ev.data).qr;
    $("qrImg").src = qr.startsWith("data:") ? qr : "data:image/png;base64," + qr;
    $("qrOverlay").classList.remove("hidden");
    $("qrStatus").textContent = "Mở Zalo → Biểu tượng quét mã → quét ảnh này";
    $("connDot").className = "dot";
    $("connText").textContent = "chờ quét QR…";
  });
  es.addEventListener("scan", () => {
    $("qrStatus").textContent = "Đã quét ✓ — mở Zalo trên điện thoại và bấm XÁC NHẬN đăng nhập";
  });
  es.addEventListener("login", () => {
    $("qrOverlay").classList.add("hidden");
    loadStatus();
  });
  es.addEventListener("ready", () => {
    $("qrOverlay").classList.add("hidden");
    loadStatus();
  });
}

/* ---------- init ---------- */
function startQrPoll() {
  const showQr = (q, loggedIn) => {
    if (loggedIn) {
      $("qrOverlay").classList.add("hidden");
      return false;
    }
    if (q) {
      $("qrImg").src = q.startsWith("data:") ? q : "data:image/png;base64," + q;
      $("qrOverlay").classList.remove("hidden");
    }
    return true;
  };
  const tick = async () => {
    try {
      const r = await api("/api/qr");
      if (!showQr(r.qr, r.loggedIn)) clearInterval(timer);
    } catch {
      // bỏ qua nếu mạng tạm lỗi
    }
  };
  tick();
  const timer = setInterval(tick, 3000);
}

(async function init() {
  connectEvents();
  try {
    await loadConfig();
  } catch (e) {
    note($("cfgResult"), "Lỗi tải config: " + e.message, "err");
  }
  startQrPoll();
  loadStatus();
  loadLogs();
  loadGroups();
  $("fwdTo").value = new Date().toISOString().slice(0, 10);
})();