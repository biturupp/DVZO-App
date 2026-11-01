import { useEffect } from 'react';
import { Circle, CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import type { LatLon } from '../domain/geo';
import type { Stop } from '../domain/types';

/** Landeskarte von swisstopo (frei nutzbar, Quelle angeben). */
const SWISSTOPO = 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg';
const DEFAULT_CENTER: [number, number] = [47.38, 8.97];

function FitBounds({ stops, fitKey }: { stops: Stop[]; fitKey: string }) {
  const map = useMap();
  useEffect(() => {
    if (stops.length === 1) map.setView([stops[0].lat, stops[0].lon], 15, { animate: false });
    else if (stops.length > 1) map.fitBounds(L.latLngBounds(stops.map((s) => [s.lat, s.lon])), { padding: [30, 30], animate: false });
    // nur neu einpassen, wenn sich Linie/Kurs ändert, nicht bei jeder Bewegung
  }, [fitKey, map]);
  return null;
}

function ClickHandler({ onClick }: { onClick: (p: LatLon) => void }) {
  useMapEvents({ click: (e) => onClick({ lat: e.latlng.lat, lon: e.latlng.lng }) });
  return null;
}

interface Props {
  stops: Stop[];
  color: string;
  fitKey: string;
  vehicle?: LatLon | null;
  onMapClick?: (p: LatLon) => void;
  height?: number;
}

export function MapView({ stops, color, fitKey, vehicle, onMapClick, height = 320 }: Props) {
  return (
    <div className={`map${onMapClick ? ' pick' : ''}`} style={{ height }}>
      <MapContainer center={DEFAULT_CENTER} zoom={13} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
        <TileLayer url={SWISSTOPO} attribution='&copy; <a href="https://www.swisstopo.admin.ch">swisstopo</a>' maxZoom={19} maxNativeZoom={18} />
        <FitBounds stops={stops} fitKey={fitKey} />
        {onMapClick && <ClickHandler onClick={onMapClick} />}
        <Polyline positions={stops.map((s) => [s.lat, s.lon])} pathOptions={{ color, weight: 5, opacity: 0.85 }} />
        {stops.map((s) => (
          <Circle key={`r-${s.id}`} center={[s.lat, s.lon]} radius={s.radius || 200} pathOptions={{ color, weight: 1, dashArray: '4 3', fillOpacity: 0.1 }} />
        ))}
        {stops.map((s, i) => (
          <CircleMarker key={s.id} center={[s.lat, s.lon]} radius={7} pathOptions={{ color: '#14201a', weight: 2.5, fillColor: '#ffffff', fillOpacity: 1 }}>
            <Tooltip direction="top" offset={[0, -6]} permanent={stops.length <= 8}>
              {i + 1}. {s.name}
            </Tooltip>
          </CircleMarker>
        ))}
        {vehicle && (
          <CircleMarker center={[vehicle.lat, vehicle.lon]} radius={10} pathOptions={{ color: '#14201a', weight: 2, fillColor: '#e3a21a', fillOpacity: 1 }}>
            <Tooltip direction="bottom">Fahrzeug</Tooltip>
          </CircleMarker>
        )}
      </MapContainer>
    </div>
  );
}
