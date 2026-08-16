'use client';

import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CATEGORY_META, type ActivityCategory, type GeoPoint } from '@/lib/types';
import { boundsOf } from '@/lib/services/geo';

export interface MapPoint {
  id: string;
  name: string;
  category: ActivityCategory;
  location: GeoPoint;
  dayIndex?: number;
  time?: string;
  address?: string;
  notes?: string;
  priceLabel?: string;
  mapsUrl: string;
  /** Rendered smaller — used for wishlist places that aren't scheduled yet. */
  muted?: boolean;
}

/** Coloured pin built from the category palette; no image assets involved. */
function pinIcon(category: ActivityCategory, label: string | undefined, muted: boolean) {
  const meta = CATEGORY_META[category];
  const size = muted ? 26 : 32;
  const html = `
    <div style="
      width:${size}px;height:${size}px;border-radius:50% 50% 50% 8%;
      transform:rotate(45deg);
      background:${meta.color};
      border:2px solid rgba(255,255,255,.92);
      box-shadow:0 2px 6px rgba(0,0,0,.35);
      display:grid;place-items:center;
      opacity:${muted ? 0.82 : 1};
    ">
      <span style="transform:rotate(-45deg);font-size:${muted ? 12 : 14}px;line-height:1">${meta.emoji}</span>
    </div>
    ${
      label
        ? `<div style="
        position:absolute;top:-7px;inset-inline-start:-7px;
        min-width:17px;height:17px;padding:0 4px;border-radius:9px;
        background:var(--bg-elevated);color:var(--text);
        border:1.5px solid ${meta.color};
        font-size:10px;font-weight:700;line-height:14px;text-align:center;
        direction:ltr;
      ">${label}</div>`
        : ''
    }`;

  return L.divIcon({
    html,
    className: 'trip-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size + 4],
  });
}

function FitBounds({ points, routeKey }: { points: GeoPoint[]; routeKey: string }) {
  const map = useMap();
  useEffect(() => {
    const bounds = boundsOf(points);
    if (!bounds) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 12);
      return;
    }
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 13 });
    // routeKey changes whenever the visible set changes, which is exactly when
    // the viewport should be recomputed.
  }, [map, routeKey, points]);
  return null;
}

/** Leaflet needs a nudge when its container is sized after mount. */
function InvalidateOnMount() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 120);
    const onResize = () => map.invalidateSize();
    window.addEventListener('resize', onResize);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', onResize);
    };
  }, [map]);
  return null;
}

export default function TripMap({
  points,
  route,
  className,
  onSelect,
}: {
  points: MapPoint[];
  /** Ordered stops for the trip route line. */
  route?: GeoPoint[];
  className?: string;
  onSelect?: (id: string) => void;
}) {
  const coords = useMemo(() => points.map((p) => p.location), [points]);
  const center = useMemo<[number, number]>(() => {
    if (coords.length === 0) return [39.9, 21.8];
    return [coords[0].lat, coords[0].lng];
  }, [coords]);

  const routeKey = useMemo(
    () => points.map((p) => p.id).join('|') + `#${route?.length ?? 0}`,
    [points, route]
  );

  return (
    <MapContainer
      center={center}
      zoom={7}
      scrollWheelZoom
      className={className}
      style={{ height: '100%', width: '100%' }}
      attributionControl
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        maxZoom={19}
      />

      {route && route.length > 1 && (
        <Polyline
          positions={route.map((p) => [p.lat, p.lng] as [number, number])}
          pathOptions={{
            color: '#1d67f0',
            weight: 3,
            opacity: 0.65,
            dashArray: '7 9',
            lineCap: 'round',
          }}
        />
      )}

      {points.map((point) => (
        <Marker
          key={point.id}
          position={[point.location.lat, point.location.lng]}
          icon={pinIcon(
            point.category,
            point.dayIndex !== undefined ? String(point.dayIndex) : undefined,
            !!point.muted
          )}
          eventHandlers={onSelect ? { click: () => onSelect(point.id) } : undefined}
        >
          <Popup>
            <div className="p-3" dir="rtl">
              <div className="flex items-start gap-2">
                <span className="text-base leading-none mt-0.5" aria-hidden>
                  {CATEGORY_META[point.category].emoji}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-[14px] leading-snug">{point.name}</p>
                  {point.address && (
                    <p className="text-[11.5px] text-muted mt-0.5">{point.address}</p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 mt-2">
                {point.dayIndex !== undefined && (
                  <span className="px-1.5 py-0.5 rounded-md bg-brand-soft text-brand text-[11px] font-medium">
                    יום {point.dayIndex}
                  </span>
                )}
                {point.time && (
                  <span className="px-1.5 py-0.5 rounded-md bg-subtle text-muted text-[11px] font-medium ltr-nums">
                    {point.time}
                  </span>
                )}
                {point.priceLabel && (
                  <span className="px-1.5 py-0.5 rounded-md bg-subtle text-muted text-[11px] font-medium ltr-nums">
                    {point.priceLabel}
                  </span>
                )}
              </div>

              {point.notes && (
                <p className="text-[11.5px] text-muted mt-2 leading-relaxed line-clamp-3">
                  {point.notes}
                </p>
              )}

              <a
                href={point.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2.5 flex items-center justify-center h-9 rounded-lg bg-brand text-brand-contrast text-[12.5px] font-semibold no-underline"
              >
                פתיחה ב-Google Maps
              </a>
            </div>
          </Popup>
        </Marker>
      ))}

      <FitBounds points={coords} routeKey={routeKey} />
      <InvalidateOnMount />
    </MapContainer>
  );
}
