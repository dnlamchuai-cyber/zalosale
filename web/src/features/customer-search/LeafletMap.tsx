// Ai viết: Codex
// Tại sao: bọc Leaflet ở một chunk lazy để màn quét bình thường không tải bản đồ.
// Link: docs/03_SPEC/SPEC-006_MapRadiusSearch.md + docs/04_PROMPTS/PROMPT-010_RoomLocationResolution.md

import { useEffect, useState } from "react";
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { MapRoom, SearchZone } from "../../types";

interface LeafletMapProps {
  center: { latitude: number; longitude: number };
  radiusMeters: number;
  zones: SearchZone[];
  rooms: Array<{ room: MapRoom; matchedZoneIds: string[] }>;
  onPick: (point: { latitude: number; longitude: number }) => void;
}

const markerIcon = L.divIcon({ className: "room-map-marker", html: "<span>🏠</span>", iconSize: [28, 28], iconAnchor: [14, 14] });

const OSM_TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const CARTO_TILES = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

function BaseMapLayer() {
  const [tileProvider, setTileProvider] = useState<"osm" | "carto">("osm");
  const url = tileProvider === "osm" ? OSM_TILES : CARTO_TILES;
  const attribution = tileProvider === "osm"
    ? "&copy; OpenStreetMap contributors"
    : "&copy; OpenStreetMap contributors &copy; CARTO";
  return <TileLayer attribution={attribution} url={url} eventHandlers={{ tileerror: () => setTileProvider("carto") }} />;
}

function MapClickPicker({ onPick }: { onPick: LeafletMapProps["onPick"] }) {
  useMapEvents({ click: (event) => onPick({ latitude: event.latlng.lat, longitude: event.latlng.lng }) });
  return null;
}

function Recenter({ center }: { center: LeafletMapProps["center"] }) {
  const map = useMap();
  useEffect(() => { map.setView([center.latitude, center.longitude]); }, [center.latitude, center.longitude, map]);
  return null;
}

export function LeafletMap({ center, radiusMeters, zones, rooms, onPick }: LeafletMapProps) {
  return (
    <MapContainer center={[center.latitude, center.longitude]} zoom={13} scrollWheelZoom className="room-map-canvas" aria-label="Bản đồ chọn vùng tìm trọ">
      <BaseMapLayer />
      <MapClickPicker onPick={onPick} />
      <Recenter center={center} />
      {zones.filter((zone) => zone.enabled).map((zone) => (
        <Circle key={zone.id} center={[zone.center.latitude, zone.center.longitude]} radius={zone.radiusMeters} pathOptions={{ color: "#0068ff", fillOpacity: 0.12 }} />
      ))}
      <Circle center={[center.latitude, center.longitude]} radius={radiusMeters} pathOptions={{ color: "#07a35f", fillOpacity: 0.08, dashArray: "6 5" }} />
      {rooms.map(({ room, matchedZoneIds }) => (
        <Marker key={room.id} position={[room.latitude as number, room.longitude as number]} icon={markerIcon}>
          <Popup><strong>{room.roomCode}</strong><br />{room.address || "Chưa có địa chỉ"}<br /><small>{matchedZoneIds.length} vùng khớp</small></Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
