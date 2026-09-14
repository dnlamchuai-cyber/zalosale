// AI: Codex | WHY: Type the explicit catch-all option across the configuration UI.
// SPEC: docs/03_SPEC/SPEC-003.md
export interface HistoryCoverage {
  threadId: string;
  sourceName: string;
  complete: boolean;
  reason: string;
  received: number;
  oldestTs: number | null;
}

export interface ForwardConfig {
  windowMs: number;
  maxBatchItems: number;
  maxWaitMs: number;
  sendDelayMs: number;
  parallelSends: number;
  skipTextOnly: boolean;
  retries: number;
  historyGapMs: number;
}

export interface Area {
  matchAll?: boolean;
  keywords: string[];
  groupLink: string;
  id?: string;
  routingKey?: string;
  _threadId?: string;
  priceCondition?: {
    operator: "<" | ">" | "=";
    value: number;
  };
}

export interface FilterConfig {
  removePercentLines: boolean;
  removePriceLines: boolean;
}

export interface PriceRange {
  min: number;
  max: number;
}

export interface SourceGroupContact {
  admins: string;
  deputies: string;
  supportGroup: string;
  note: string;
}

export interface AppConfig {
  mode: "auto" | "manual";
  sourceGroups: string[];
  sourceGroupContacts?: Record<string, SourceGroupContact>;
  areas: Area[];
  deleteLines: string[];
  excludeKeywords: string[];
  filter: FilterConfig;
  priceRange: PriceRange | null;
  defaultArea: string | null;
  forward: ForwardConfig;
  ui?: { port?: number };
}

export interface AreaStatus {
  index: number;
  keywords: string[];
  link: string;
  resolved: boolean;
}

export interface AccountInfo {
  displayName: string;
  uid: string;
  avatar: string;
  phone: string;
}

export interface StatusData {
  ok: boolean;
  mode: "auto" | "manual";
  forwarded: number;
  startedAt: string;
  knownSources: { threadId: string; name: string }[];
  areas: AreaStatus[];
  loggedIn: boolean;
  accountInfo: AccountInfo | null;
}

export interface GroupInfo {
  name: string;
  id: string;
  avt?: string;
  avatar?: string;
  type?: number;
  subType?: number;
  isOwner?: boolean;
  isAdmin?: boolean;
  isManager?: boolean;
  totalMember?: number;
  creatorId?: string;
}

export interface AreaResolveResult {
  index: number;
  ok: boolean;
  groupId?: string;
  name?: string;
  error?: string;
}

export interface LogEntry {
  level: string;
  line: string;
}

export interface ScanPost {
  id: string;
  tid: string;
  name: string;
  areaName: string | null;
  detectedArea?: string | null;
  destinationNames: string[];
  kw: string;
  clean: string;
  photos: number;
  photoUrls: string[];
  price: number | null;
  commissionPercent: number | null;
  inPriceRange: boolean;
  status?: "pending" | "sent" | "duplicate" | "error" | "undetermined" | "no_images" | "text_only" | "media_only" | "missing_opening" | "missing_location" | "building_full";
  duplicateOf?: string;
  videoStatus?: "pending" | "sent" | "failed" | null;
  sentImages?: number;
  routingReason?: "dia-chi" | "gan" | "xe-buyt" | null;
  routingKeys?: string[];
  matchedRules?: Array<{ name: string; type: string }>;
  undetermined?: boolean;
  ts: number;
  clusterItems: ScanClusterItem[];
}

export interface ScanClusterItem {
  text: string;
  photoUrls: string[];
  ts: number;
}

export interface ScanProgress {
  running: boolean;
  current: number;
  total: number;
  sourceName: string;
  destinationName: string;
  imageCount: number;
  startedAt: number;
  stopRequested: boolean;
  stopped?: boolean;
  endedAt?: number;
}

export interface ScanResult {
  ok: boolean;
  scanId: string;
  range: string;
  groups: number;
  total: number;
  posts: ScanPost[];
  fullBuildings?: FullBuildingNotice[];
  progress?: ScanProgress | null;
}

export interface FullBuildingNotice {
  threadId: string;
  sourceName: string;
  key: string;
  label: string;
  text: string;
  status: "full";
}

export interface SentRoomDestination {
  id: string;
  name: string;
  sentCount: number;
  lastSentAt: number;
}

export interface SentRoomSummary {
  id: string;
  roomCode: string;
  latestContent: string;
  status: "unknown" | "available" | "reserved" | "rented";
  sourceGroups: Array<{ id: string; name: string }>;
  destinations: SentRoomDestination[];
  sentCount: number;
  lastSentAt: number;
}

export type LocationRuleType = "duong" | "ngo" | "phuong" | "dia-danh";
export type LocationRuleSource = "osm" | "manual" | "alias";

export interface LocationRule {
  id: string;
  name: string;
  normalizedName?: string;
  type: LocationRuleType;
  routingKeys: string[];
  enabled: boolean;
  source: LocationRuleSource;
  note?: string;
  updatedAt?: number;
}

export interface OsmPreviewRow {
  name: string;
  type: LocationRuleType;
  routingKeys: string[];
  source: "osm";
}

export interface CustomerProfile {
  id: string;
  name: string;
  phoneDisplay: string;
  phoneNormalized: string;
  createdAt: number;
  updatedAt: number;
}

export interface SearchRequest {
  id: string;
  customerId: string;
  title: string;
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface SearchZone {
  id: string;
  requestId: string;
  label: string;
  center: { latitude: number; longitude: number };
  radiusMeters: number;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface MapCandidate {
  latitude: number;
  longitude: number;
  displayName: string;
  importance: number | null;
}

export interface MapRoom {
  id: string;
  roomCode: string;
  address: string;
  latestContent: string;
  status: string;
  locationStatus: string;
  latitude: number | null;
  longitude: number | null;
}

export interface MapRoomsResult {
  requestId?: string | null;
  zones: SearchZone[];
  matchedRooms: Array<{ room: MapRoom; matchedZoneIds: string[] }>;
  unmatchedRooms: MapRoom[];
  unlocatedRooms: MapRoom[];
}
