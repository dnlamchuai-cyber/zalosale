export interface ForwardConfig {
  windowMs: number;
  maxBatchItems: number;
  maxWaitMs: number;
  sendDelayMs: number;
  retries: number;
  historyGapMs: number;
}

export interface Area {
  keywords: string[];
  groupLink: string;
  id?: string;
  _threadId?: string;
}

export interface FilterConfig {
  removePercentLines: boolean;
  removePriceLines: boolean;
}

export interface PriceRange {
  min: number;
  max: number;
}

export interface AppConfig {
  mode: "auto" | "manual";
  sourceGroups: string[];
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
  kw: string;
  clean: string;
  photos: number;
  price: number | null;
  inPriceRange: boolean;
  ts: number;
}

export interface ScanResult {
  ok: boolean;
  scanId: string;
  range: string;
  groups: number;
  total: number;
  posts: ScanPost[];
}
