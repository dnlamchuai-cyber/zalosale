// AI: OpenAI Codex
// WHY: Chỉ đưa tin mở cụm dài ở cuối lên đầu, còn mọi tin/ảnh khác giữ đúng thứ tự gửi.
// SPEC: SPEC-005 — sticker là ranh giới ưu tiên; tin mở cụm cuối có thể gộp các phòng trước đó.
import { EventEmitter } from "events";
import { classifyAreasDetailed } from "./classifier.js";
import { isStickerMessage } from "./closing-sticker.js";
import { buildingKeyFromText, buildingNoticeMatchesText, parseFullBuildingNotice } from "./full-building.js";
import { photoUrls } from "./media.js";
import { normalizeText } from "./processor.js";

const ROOM_LABEL_MAX_LENGTH = 100;
const KEYWORD_MESSAGE_MIN_LENGTH = 30;
const OPENING_MESSAGE_MIN_LENGTH = 120;
const STRUCTURED_ITEM_HARD_LIMIT = 100;
// WHY: đạt trần mà chưa có tin mở cụm thì giữ phòng chờ tin mở, quá số này mới xả cũ nhất (FIFO).
const ROOM_PREFIX_RETAIN_LIMIT = 50;
const LINK_PATTERN = /(?:https?:\/\/|www\.|zalo\.me\/g\/)[^\s]+/i;
const PHONE_PATTERN = /(?<!\d)(?:\+?84|0)(?:[\s().-]?\d){8,10}(?!\d)/;

function itemText(item) {
  return typeof item?.data?.content === "string" ? item.data.content.trim() : "";
}

export function isMediaItem(item) {
  return photoUrls(item).length > 0;
}

export function isRoomLabel(text) {
  const normalized = normalizeText(text);
  if (!normalized || normalized.length > ROOM_LABEL_MAX_LENGTH) return false;
  const hasPrice = /(?:^|\s)\d+(?:[.,]\d+)?\s*(?:tr|trieu)\s*\d*(?:\s|$)/.test(normalized);
  const hasRoom = /(?:^|[\s,;-])(?:p|phong)\s*\d{2,4}\b/.test(normalized);
  const hasPosition = /(?:^|\s)(?:truc|tang)\s*[a-z0-9]/.test(normalized);
  return hasPrice || hasRoom || hasPosition;
}

export function isCommissionHeader(text) {
  const normalized = normalizeText(text);
  const hasCode = /(?:^|\s)ma\s*:?\s*[a-z0-9]/.test(normalized);
  const hasPercent = /\d+\s*%/.test(text);
  return hasCode || hasPercent;
}

export function hasContactOrLink(text) {
  const value = String(text ?? "");
  return LINK_PATTERN.test(value) || PHONE_PATTERN.test(value);
}

function hasRoomDetail(text) {
  return /\b(?:phong|trong|gia|noi that|dich vu|thang may|studio|can ho)\b/i.test(normalizeText(text));
}

function hasAddress(text) {
  return /\b(?:dia chi|ngach|ngo|duong|pho|so\s+\d)\b/i.test(normalizeText(text));
}

function describeBuilding(text, areas, rules = []) {
  // WHY: Catch-all is a delivery rule, not evidence of a new building (SPEC-003).
  const detailed = classifyAreasDetailed(text, areas.filter((area) => area.matchAll !== true), null, rules);
  const destinations = detailed.destinations;
  const hasStructuredOpening = hasAddress(text) && hasRoomDetail(text);
  const hasKeywordAndDetail = destinations.length > 0
    && text.length >= KEYWORD_MESSAGE_MIN_LENGTH
    && (text.length < OPENING_MESSAGE_MIN_LENGTH || hasStructuredOpening);
  const isLong = text.length >= OPENING_MESSAGE_MIN_LENGTH && hasStructuredOpening;
  return { isBuilding: hasKeywordAndDetail || isLong, destinations, routeVia: detailed.reason, matchedRules: detailed.matchedRules };
}

function newState(threadId) {
  return {
    threadId,
    buildingContext: null,
    buildingKey: null,
    fullBuildingKey: null,
    fullBuildingNotice: null,
    active: null,
    pending: [],
    // WHY: Giữ các phòng liền trước tin mở cụm để có thể đưa duy nhất tin
    // mở cụm ở cuối lên đầu, nhưng vẫn bảo toàn thứ tự text/ảnh của từng phòng.
    roomPrefix: [],
    sequence: 0,
    contextSequence: 0,
    stickerDelimited: false,
    // WHY: sticker sau cụm mở không xóa ngữ cảnh ngay — chùm ảnh sau sticker vẫn
    // ăn theo cụm mở; tin chữ tới sẽ chốt cụm cũ rồi xử lý độc lập (vote 2026-09-11).
    contextStale: false,
    timer: null,
  };
}

/** State machine theo từng nhóm nguồn; mọi emit luôn đồng bộ và đúng sequence. */
export class Batcher extends EventEmitter {
  constructor({ windowMs, maxBatchItems, maxWaitMs, areas = [], defaultArea = null, rules = [] }) {
    super();
    this.windowMs = windowMs;
    this.maxBatchItems = maxBatchItems;
    this.maxWaitMs = maxWaitMs;
    this.areas = areas;
    this.defaultArea = defaultArea;
    this.rules = Array.isArray(rules) ? rules : [];
    this.batches = new Map();
    this.fullBuildings = new Map();
    this.fullBuildingNotices = [];
  }

  add(threadId, item) {
    const id = String(threadId);
    const state = this.batches.get(id) ?? newState(id);
    this.batches.set(id, state);
    clearTimeout(state.timer);
    if (isStickerMessage(item?.data ?? item)) {
      this.startStickerSegment(state);
      return;
    }
    const text = itemText(item);
    const fullNotice = text ? parseFullBuildingNotice(text) : null;
    if (fullNotice) {
      this.markBuildingFull(state, fullNotice);
      return;
    }
    if (state.contextStale && text) {
      // Tin chữ sau sticker: chốt chùm ảnh của cụm cũ (giữ ngữ cảnh), rồi xử lý tin mới độc lập.
      this.flushOpen(state);
      state.buildingContext = null;
      state.buildingKey = null;
      state.contextStale = false;
    }
    const building = text ? describeBuilding(text, this.areas, this.rules) : { isBuilding: false, destinations: [], routeVia: null, matchedRules: [] };
    const startsBuilding = building.isBuilding;
    if (state.fullBuildingKey) {
      const sameBuilding = !startsBuilding
        || (buildingKeyFromText(text) === state.fullBuildingKey
          && buildingNoticeMatchesText(text, state.fullBuildingNotice, { requireName: true }));
      if (sameBuilding) {
        this.schedule(state);
        return;
      }
      state.fullBuildingKey = null;
      state.fullBuildingNotice = null;
    }
    if (text && (hasContactOrLink(text) || text.length >= OPENING_MESSAGE_MIN_LENGTH) && !startsBuilding) {
      this.schedule(state);
      return;
    }
    if (startsBuilding) this.startBuilding(state, item, building);
    else if (text && isCommissionHeader(text)) this.startLead(state, item);
    // Khi đã có tòa đang mở, P101/P404 và mọi ảnh sau nó chỉ là phần của
    // cùng cụm; không được xem chúng là một tin mở cụm mới.
    else if (state.buildingContext) this.appendItem(state, item);
    else if (text && isRoomLabel(text)) this.startRoom(state, item);
    else this.appendItem(state, item);
    const itemLimit = state.stickerDelimited || state.buildingContext
      ? STRUCTURED_ITEM_HARD_LIMIT
      : this.maxBatchItems;
    if (this.openItemCount(state) >= itemLimit) this.flushCap(state);
    this.schedule(state);
  }

  startBuilding(state, item, building) {
    const destinations = building.destinations;
    const bufferedRooms = !state.buildingContext ? state.roomPrefix.flat() : [];
    const canPrefix = state.active?.segmentType === "generic"
      || state.active?.segmentType === "lead"
      || state.active?.segmentType === "room";
    const activePrefix = !state.buildingContext && canPrefix ? state.active.items : [];
    const prefix = [...bufferedRooms, ...activePrefix];
    const moveOpeningToFront = state.stickerDelimited
      || bufferedRooms.length > 0
      || state.active?.segmentType === "room";
    if (prefix.length) {
      state.active = null;
      state.roomPrefix = [];
    }
    else this.flushOpen(state);
    const buildingKey = buildingKeyFromText(itemText(item));
    state.contextSequence += 1;
    state.buildingKey = buildingKey;
    state.contextStale = false;
    state.buildingContext = {
      id: `${state.threadId}:${state.contextSequence}`,
      destinations,
      buildingKey,
      routeVia: building.routeVia || null,
      matchedRules: (building.matchedRules || []).map((r) => ({ name: r.name, type: r.type })),
    };
    const items = moveOpeningToFront && prefix.length ? [item, ...prefix] : [...prefix, item];
    state.active = { segmentType: "building", items };
  }

  startStickerSegment(state) {
    const openHasText =
      (state.active?.items || []).some((item) => itemText(item)) ||
      state.pending.some((item) => itemText(item)) ||
      state.roomPrefix.some((items) => items.some((item) => itemText(item)));
    // Sticker giữa chùm chỉ-có-ảnh: bỏ qua, gom tiếp (vote 2026-09-11).
    // Sticker kề tin có chữ vẫn là ranh giới hết bài (SPEC-005).
    // Giữ cờ stickerDelimited để tin mở tới sau vẫn được đưa lên đầu (BIZ-004 BR2).
    if (!openHasText) {
      state.stickerDelimited = true;
      return;
    }
    this.flushOpen(state);
    // GIỮ buildingContext cho chùm ảnh sau sticker (ăn theo cụm mở); tin chữ
    // tới sẽ chốt cụm cũ (xem add()) rồi xử lý độc lập.
    if (state.buildingContext) state.contextStale = true;
    state.active = null;
    state.pending = [];
    state.stickerDelimited = true;
  }

  startLead(state, item) {
    this.flushOpen(state);
    state.buildingContext = null;
    state.buildingKey = null;
    state.contextStale = false;
    state.active = { segmentType: "lead", items: [item] };
  }

  startRoom(state, item) {
    // Ảnh lẻ ngay trước nhãn phòng (không chữ, không ngữ cảnh mở) là ảnh của phòng đó.
    let leadingPhotos = [];
    if (!state.buildingContext && state.active?.segmentType === "generic"
      && !(state.active.items || []).some((it) => itemText(it))) {
      leadingPhotos = state.active.items;
      state.active = null;
    }
    if (!state.buildingContext && state.active?.segmentType === "room") {
      state.roomPrefix.push(state.active.items);
      state.active = { segmentType: "room", items: [...leadingPhotos, item] };
      return;
    }
    this.flushOpen(state);
    if (!state.buildingContext) state.buildingKey = null;
    state.active = { segmentType: "room", items: [...leadingPhotos, item] };
  }

  appendItem(state, item) {
    if (state.active?.segmentType === "lead") {
      state.active.items.push(item);
      return;
    }
    if (state.active?.segmentType === "room") {
      state.active.items.push(item);
      return;
    }
    if (state.active?.segmentType === "building") {
      state.active.items.push(item);
      return;
    }
    if (state.active?.segmentType === "building" || state.buildingContext) {
      state.pending.push(item);
      return;
    }
    state.active ??= { segmentType: "generic", items: [] };
    state.active.items.push(item);
  }

  emitActive(state) {
    if (!state.active?.items.length) return;
    state.sequence += 1;
    const context = state.buildingContext;
    const metadata = {
      segmentType: state.active.segmentType,
      buildingContextId: context?.id ?? null,
      buildingKey: context?.buildingKey ?? state.buildingKey ?? null,
      inheritedDestinations: context?.destinations ?? [],
      inheritedRouteVia: context?.routeVia ?? null,
      inheritedMatchedRules: context?.matchedRules ?? [],
      sequence: state.sequence,
    };
    Object.defineProperty(state.active.items, "batchMeta", {
      value: metadata,
      enumerable: false,
      configurable: true,
    });
    this.emit("batch", {
      threadId: state.threadId,
      items: state.active.items,
      ...metadata,
    });
    state.active = null;
  }

  emitPending(state) {
    if (!state.pending.length) return;
    // Pending chỉ tồn tại khi đang trong ngữ cảnh cụm mở → giữ metadata để không thành cụm mồ côi.
    state.active = { segmentType: state.buildingContext ? "building" : "generic", items: state.pending };
    state.pending = [];
    this.emitActive(state);
  }

  flushOpen(state) {
    if (state.active?.segmentType === "building" && state.pending.length) {
      state.active.items.push(...state.pending);
      state.pending = [];
    }
    if (!state.buildingContext && state.roomPrefix.length) {
      const active = state.active;
      state.active = null;
      for (const items of state.roomPrefix) {
        state.active = { segmentType: "room", items };
        this.emitActive(state);
      }
      state.roomPrefix = [];
      state.active = active;
    }
    this.emitActive(state);
    this.emitPending(state);
  }

  /**
   * Đạt trần tin: đang trong cụm mở thì xả bình thường; nhãn phòng/hoa hồng chưa
   * có tin mở thì dồn vào hàng chờ tin mở (tối đa 50 tin, quá thì xả cũ nhất FIFO);
   * tin thường (generic) xả ngay như cũ để không kẹt dòng chảy live.
   */
  flushCap(state) {
    if (state.buildingContext || state.active?.segmentType === "building") {
      this.flushOpen(state);
      return;
    }
    if (state.active?.segmentType === "room" || state.active?.segmentType === "lead") {
      if (state.active?.items.length) {
        state.roomPrefix.push(state.active.items);
        state.active = null;
      }
      this.enforcePrefixBound(state);
      return;
    }
    // Ảnh lẻ tràn trong lúc đang chờ tin mở thì giữ chung; không có gì chờ thì xả ngay.
    if (state.active?.items.length && state.roomPrefix.length) {
      state.roomPrefix.push(state.active.items);
      state.active = null;
      this.enforcePrefixBound(state);
      return;
    }
    this.emitActive(state);
  }

  /** Giữ tối đa 50 tin chờ tin mở; quá thì xả phòng cũ nhất (FIFO), không mất tin. */
  enforcePrefixBound(state) {
    while (state.roomPrefix.length && this.prefixItemCount(state) > ROOM_PREFIX_RETAIN_LIMIT) {
      const oldest = state.roomPrefix.shift();
      state.active = { segmentType: "room", items: oldest };
      this.emitActive(state);
      state.active = null;
    }
  }

  prefixItemCount(state) {
    return state.roomPrefix.reduce((total, items) => total + items.length, 0);
  }

  openItemCount(state) {
    const bufferedRoomCount = this.prefixItemCount(state);
    return bufferedRoomCount + (state.active?.items.length ?? 0) + state.pending.length;
  }

  schedule(state) {
    if (!this.openItemCount(state)) return;
    const structured = state.stickerDelimited || state.buildingContext || state.active?.segmentType !== "generic";
    const wait = structured ? this.maxWaitMs : Math.min(this.windowMs, this.maxWaitMs);
    state.timer = setTimeout(() => {
      this.flushOpen(state);
      state.timer = null;
    }, wait);
    if (state.timer.unref) state.timer.unref();
  }

  flush(threadId) {
    const id = String(threadId);
    const state = this.batches.get(id);
    if (!state) return;
    clearTimeout(state.timer);
    this.flushOpen(state);
    this.batches.delete(id);
  }

  flushAll() {
    for (const id of [...this.batches.keys()]) this.flush(id);
  }

  markBuildingFull(state, notice) {
    state.buildingContext = null;
    state.buildingKey = null;
    state.contextStale = false;
    state.active = null;
    state.pending = [];
    state.roomPrefix = [];
    state.fullBuildingKey = notice.key;
    state.fullBuildingNotice = notice;
    const scopeKey = `${state.threadId}|${notice.key}`;
    this.fullBuildings.set(scopeKey, notice);
    const fullNotice = { threadId: state.threadId, ...notice };
    this.fullBuildingNotices.push(fullNotice);
    this.emit("building-full", fullNotice);
  }

  isBuildingFull(threadId, buildingKey, text = "") {
    const key = String(buildingKey || "");
    if (!key) return false;
    const notice = this.fullBuildings.get(`${String(threadId)}|${key}`);
    return Boolean(notice && buildingNoticeMatchesText(text, notice));
  }
}
