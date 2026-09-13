// Ai viết: Codex
// Tại sao: bản đồ là công cụ tìm khu vực/phòng độc lập, không buộc gắn với khách hay nhu cầu CRM.
// Link: docs/03_SPEC/SPEC-006_MapRadiusSearch.md + docs/04_PROMPTS/PROMPT-011_MapSearchUi.md

import { FormEvent, Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../api";
import type { MapCandidate, MapRoom, MapRoomsResult, SearchZone } from "../../types";

const LeafletMap = lazy(() => import("./LeafletMap").then((module) => ({ default: module.LeafletMap })));
const DEFAULT_CENTER = { latitude: 20.972, longitude: 105.778 };
const MIN_RADIUS_METERS = 200;
const MAX_RADIUS_METERS = 20_000;
const RECOMMENDED_ZONES: SearchZone[] = [
  { id: "preset-ga-ha-dong", requestId: "", label: "Ga Hà Đông – Nguyễn Thái Học – Yết Kiêu – Quang Trung", center: { latitude: 20.972, longitude: 105.778 }, radiusMeters: 1_800, enabled: true, createdAt: 0, updatedAt: 0 },
  { id: "preset-mo-lao", requestId: "", label: "Mỗ Lao – Vũ Trọng Khánh – Nguyễn Văn Lộc – Trần Phú", center: { latitude: 20.985, longitude: 105.786 }, radiusMeters: 1_800, enabled: true, createdAt: 0, updatedAt: 0 },
  { id: "preset-phung-khoang", requestId: "", label: "Phùng Khoang – Trung Văn – giáp Nguyễn Trãi", center: { latitude: 20.998, longitude: 105.789 }, radiusMeters: 2_000, enabled: true, createdAt: 0, updatedAt: 0 },
];

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function makeZoneId() {
  return `map-zone-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function MapSearchPanel() {
  const [addressQuery, setAddressQuery] = useState("");
  const [candidates, setCandidates] = useState<MapCandidate[]>([]);
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [radiusMeters, setRadiusMeters] = useState(2_000);
  const [label, setLabel] = useState("");
  const [zones, setZones] = useState<SearchZone[]>([]);
  const [mapData, setMapData] = useState<MapRoomsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [locatingRoomId, setLocatingRoomId] = useState("");
  const [roomAddressDrafts, setRoomAddressDrafts] = useState<Record<string, string>>({});

  const loadMapData = useCallback(async (nextZones: SearchZone[]) => {
    try {
      const response = await api.mapRoomsForZones(nextZones.map(({ label: zoneLabel, center: zoneCenter, radiusMeters: zoneRadius, enabled }) => ({
        label: zoneLabel, center: zoneCenter, radiusMeters: zoneRadius, enabled,
      })));
      setMapData(response);
      return response;
    } catch (loadError) {
      setError(errorMessage(loadError, "Không tải được dữ liệu phòng"));
      throw loadError;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadMapData([]).catch(() => undefined); }, [loadMapData]);

  async function searchAddress(event: FormEvent) {
    event.preventDefault();
    setWorking(true); setError(""); setCandidates([]);
    try { setCandidates((await api.geocodeMap(addressQuery)).candidates); }
    catch (searchError) { setError(errorMessage(searchError, "Không tìm được địa chỉ; bạn vẫn có thể bấm trực tiếp trên bản đồ")); }
    finally { setWorking(false); }
  }

  async function addZone(event: FormEvent) {
    event.preventDefault();
    if (label.trim().length < 2 || zones.length >= 10) return;
    const timestamp = Date.now();
    const nextZone: SearchZone = { id: makeZoneId(), requestId: "", label: label.trim(), center, radiusMeters, enabled: true, createdAt: timestamp, updatedAt: timestamp };
    const nextZones = [...zones, nextZone];
    setWorking(true); setError(""); setNotice("");
    try {
      await loadMapData(nextZones);
      setZones(nextZones);
      setLabel("");
      setNotice("Đã thêm vùng tìm phòng");
    } catch (saveError) {
      setError(errorMessage(saveError, "Không thêm được vùng"));
    } finally { setWorking(false); }
  }

  async function applyRecommendedZones() {
    setWorking(true); setError(""); setNotice("");
    try {
      const nextZones = RECOMMENDED_ZONES.map((zone) => ({ ...zone, createdAt: Date.now(), updatedAt: Date.now() }));
      await loadMapData(nextZones);
      setZones(nextZones);
      setCenter(nextZones[0].center);
      setLabel("");
      setNotice("Đã khoanh 3 cụm, ưu tiên từ gần đến xa");
    } catch (presetError) {
      setError(errorMessage(presetError, "Không tải được 3 cụm gợi ý"));
    } finally { setWorking(false); }
  }

  async function locateRoom(room: MapRoom, addressOverride?: string) {
    const address = (addressOverride ?? room.address).trim();
    if (!address) return;
    setLocatingRoomId(room.id); setError(""); setNotice("");
    try {
      const response = await api.resolveRoomLocation(room.id, address);
      await loadMapData(zones);
      setNotice(response.location.status === "located" ? `Đã định vị ${room.roomCode}` : `${room.roomCode}: ${response.location.status}`);
    } catch (locationError) {
      setError(errorMessage(locationError, `Không định vị được ${room.roomCode}`));
    } finally { setLocatingRoomId(""); }
  }

  async function backfillAddresses() {
    setWorking(true); setError(""); setNotice("");
    try {
      const response = await api.backfillRoomAddresses();
      await loadMapData(zones);
      setNotice(`Đã nhận diện địa chỉ cho ${response.updated} tin`);
    } catch (backfillError) {
      setError(errorMessage(backfillError, "Không thể nhận diện địa chỉ lúc này"));
    } finally { setWorking(false); }
  }

  async function locateAllRooms() {
    const rooms = (mapData?.unlocatedRooms || []).filter((room) => room.address.trim());
    if (!rooms.length) {
      setNotice("Không có tin nào có địa chỉ để định vị");
      return;
    }
    setWorking(true); setError(""); setNotice(`Đang định vị 0/${rooms.length} tin...`);
    let located = 0;
    let unresolved = 0;
    try {
      for (const [index, room] of rooms.entries()) {
        setLocatingRoomId(room.id);
        setNotice(`Đang định vị ${index + 1}/${rooms.length}: ${room.roomCode}`);
        try {
          const response = await api.resolveRoomLocation(room.id, room.address.trim(), { selectFirst: true });
          if (response.location.status === "located") located += 1;
          else unresolved += 1;
        } catch {
          unresolved += 1;
        }
      }
      await loadMapData(zones);
      setNotice(`Đã định vị ${located}/${rooms.length} tin${unresolved ? `; ${unresolved} tin cần kiểm tra lại` : ""}`);
    } finally {
      setLocatingRoomId("");
      setWorking(false);
    }
  }

  const activeZones = useMemo(() => zones.filter((zone) => zone.enabled !== false), [zones]);

  return (
    <section className="panel map-search-panel" aria-labelledby="map-search-title">
      <h2 id="map-search-title">🗺 Tìm phòng theo vùng bản đồ</h2>
      <p className="hint">Bấm trực tiếp trên bản đồ hoặc tìm địa chỉ, chỉnh bán kính rồi thêm nhiều vùng để lọc phòng.</p>
      {loading && <p role="status" className="map-state">Đang tải dữ liệu phòng...</p>}
      {!loading && (
        <>
          <div className="map-search-grid">
            <div>
              <button className="preset-button" type="button" onClick={() => void applyRecommendedZones()} disabled={working}>Dùng 3 cụm gợi ý quanh Ga Hà Đông</button>
              <button className="secondary-button" type="button" onClick={() => void backfillAddresses()} disabled={working}>Nhận diện địa chỉ từ nội dung đã quét</button>
              <button className="secondary-button" type="button" onClick={() => void locateAllRooms()} disabled={working || !mapData?.unlocatedRooms.some((room) => room.address.trim())}>Quét tất cả tin chưa định vị</button>
              <form className="map-address-search" onSubmit={searchAddress}>
                <label className="field"><span>Tìm địa chỉ để đặt tâm</span><input value={addressQuery} onChange={(event) => setAddressQuery(event.target.value)} maxLength={160} placeholder="Ngõ 7 Nguyễn Thái Học" /></label>
                <button className="mini" type="submit" disabled={working || addressQuery.trim().length < 2}>Tìm</button>
              </form>
              {candidates.length > 0 && <div className="map-candidates" aria-label="Kết quả địa chỉ">{candidates.map((candidate, index) => <button className="candidate-button" type="button" key={`${candidate.latitude}-${candidate.longitude}`} onClick={() => { setCenter({ latitude: candidate.latitude, longitude: candidate.longitude }); if (!label) setLabel(candidate.displayName.slice(0, 160)); }}>{index + 1}. {candidate.displayName}</button>)}</div>}
              <form className="map-zone-form" onSubmit={addZone}>
                <label className="field"><span>Nhãn vùng</span><input value={label} onChange={(event) => setLabel(event.target.value)} maxLength={160} placeholder="Ga Hà Đông" /></label>
                <label className="field"><span>Bán kính: {radiusMeters.toLocaleString("vi-VN")} m</span><input type="range" min={MIN_RADIUS_METERS} max={MAX_RADIUS_METERS} step={100} value={radiusMeters} onChange={(event) => setRadiusMeters(Number(event.target.value))} /></label>
                <button className="primary" type="submit" disabled={working || label.trim().length < 2 || zones.length >= 10}>+ Thêm vùng</button>
              </form>
              <p className="hint">Đã có {activeZones.length}/10 vùng. Chọn tâm bằng cách bấm trên bản đồ nếu không tìm được địa chỉ.</p>
            </div>
            <Suspense fallback={<div className="map-loading" role="status">Đang tải bản đồ...</div>}><LeafletMap center={center} radiusMeters={radiusMeters} zones={activeZones} rooms={mapData?.matchedRooms || []} onPick={setCenter} /></Suspense>
          </div>
          {notice && <p className="map-state" role="status">{notice}</p>}
          {error && <p className="map-state error" role="alert">{error}</p>}
          {mapData && <div className="map-room-lists"><div><strong>Phòng trong vùng ({mapData.matchedRooms.length})</strong><ul>{mapData.matchedRooms.map(({ room }) => <li key={room.id}>{room.roomCode} · {room.address || "Chưa có địa chỉ"}</li>)}</ul></div><div><strong>Chưa khớp vùng ({mapData.unmatchedRooms.length})</strong><ul>{mapData.unmatchedRooms.map((room) => <li key={room.id}>{room.roomCode}</li>)}</ul></div><div><strong>Chưa định vị ({mapData.unlocatedRooms.length})</strong><ul>{mapData.unlocatedRooms.map((room) => { const address = roomAddressDrafts[room.id] ?? room.address; return <li key={room.id}><span>{room.roomCode} · </span>{room.address ? room.address : <input className="room-address-input" value={address} onChange={(event) => setRoomAddressDrafts((current) => ({ ...current, [room.id]: event.target.value }))} placeholder="Nhập địa chỉ tin" aria-label={`Địa chỉ ${room.roomCode}`} />} <button className="mini" type="button" onClick={() => void locateRoom(room, address)} disabled={working || locatingRoomId !== room.id && locatingRoomId !== "" || !address.trim()}>{locatingRoomId === room.id ? "Đang định vị..." : "Định vị"}</button></li>; })}</ul></div></div>}
        </>
      )}
    </section>
  );
}
