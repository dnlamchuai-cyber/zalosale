// Ai viết: Codex — tách trạng thái lọc khỏi màn quét
// Tại sao: giữ ScanReviewPanel tập trung vào quét/gửi, còn điều kiện lọc có thể kiểm thử độc lập
// Link: PROMPT-006 — xem, lọc và gửi cụm tin theo đúng thứ tự

import { useMemo, useState } from "react";
import type { ScanPost } from "../types";
import type { ScanSort } from "./ScanFilters";

function normalizeSearch(value: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function useScanFilters(posts: ScanPost[]) {
  const [sourceFilter, setSourceFilter] = useState("");
  const [keywordFilter, setKeywordFilter] = useState("");
  const [contentFilter, setContentFilter] = useState("");
  const [mediaFilter, setMediaFilter] = useState("");
  const [commissionFilter, setCommissionFilter] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [commissionMin, setCommissionMin] = useState("");
  const [sort, setSort] = useState<ScanSort>("oldest");

  const filteredEntries = useMemo(() => posts
    .map((post, index) => ({ post, index }))
    .filter(({ post }) => {
      const searchable = normalizeSearch(`${post.clean} ${post.name} ${post.kw}`);
      const minPrice = priceMin === "" ? null : Number(priceMin);
      const maxPrice = priceMax === "" ? null : Number(priceMax);
      const minCommission = commissionMin === "" ? null : Number(commissionMin);
      return (!sourceFilter || post.name === sourceFilter)
        && (!keywordFilter || post.destinationNames.includes(keywordFilter))
        && (!contentFilter || searchable.includes(normalizeSearch(contentFilter)))
        && (!mediaFilter || (mediaFilter === "yes") === ((post.photoUrls?.length ?? 0) > 0))
        && (!commissionFilter || (commissionFilter === "yes") === (post.commissionPercent != null))
        && (minPrice == null || (post.price != null && post.price >= minPrice))
        && (maxPrice == null || (post.price != null && post.price <= maxPrice))
        && (minCommission == null || (post.commissionPercent != null && post.commissionPercent >= minCommission));
    })
    .sort((left, right) => {
      if (sort === "oldest") return left.post.ts - right.post.ts;
      if (sort === "source") return left.post.name.localeCompare(right.post.name, "vi") || right.post.ts - left.post.ts;
      if (sort === "price-high") return (right.post.price ?? -1) - (left.post.price ?? -1);
      if (sort === "price-low") return (left.post.price ?? Infinity) - (right.post.price ?? Infinity);
      if (sort === "commission-high") return (right.post.commissionPercent ?? -1) - (left.post.commissionPercent ?? -1);
      return right.post.ts - left.post.ts;
    }), [posts, sourceFilter, keywordFilter, contentFilter, mediaFilter, commissionFilter, priceMin, priceMax, commissionMin, sort]);

  const resetFilters = () => {
    setSourceFilter("");
    setKeywordFilter("");
    setContentFilter("");
    setMediaFilter("");
    setCommissionFilter("");
    setPriceMin("");
    setPriceMax("");
    setCommissionMin("");
    setSort("oldest");
  };

  return {
    sourceFilter, setSourceFilter, keywordFilter, setKeywordFilter, contentFilter, setContentFilter,
    mediaFilter, setMediaFilter, commissionFilter, setCommissionFilter,
    priceMin, setPriceMin, priceMax, setPriceMax, commissionMin, setCommissionMin,
    sort, setSort, filteredEntries, resetFilters,
  };
}
