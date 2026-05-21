/**
 * MapAreaEditor — Interactive Leaflet map for drawing CAP v1.2 area geometries.
 *
 * Supports:
 *   1. Closed polygon — click to place vertices, double-click to close ring.
 *      Output format: "lat,lon lat,lon ... lat,lon" (first == last, space-separated)
 *   2. Circle — click center, drag to set radius.
 *      Output format: "lat,lon radius_km" (CAP v1.2 circle element)
 *
 * The component manages its own Leaflet instance via useEffect and exposes
 * drawn shapes through the `onShapesChange` callback.
 */

import { useEffect, useRef, useCallback } from "react";
import type { Map as LeafletMap, FeatureGroup as LeafletFeatureGroup } from "leaflet";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DrawnShape {
  id: string;
  type: "polygon" | "circle";
  /** CAP-formatted string: polygon = "lat,lon lat,lon ...", circle = "lat,lon radius" */
  capValue: string;
  /** Human-readable label */
  label: string;
}

interface MapAreaEditorProps {
  shapes: DrawnShape[];
  onShapesChange: (shapes: DrawnShape[]) => void;
  /** Initial map center [lat, lon]. Defaults to Singapore. */
  center?: [number, number];
  /** Initial zoom level. */
  zoom?: number;
}

// ─── CAP format helpers ───────────────────────────────────────────────────────

function polygonToCAP(latlngs: Array<{ lat: number; lng: number }>): string {
  // CAP polygon: space-separated "lat,lon" pairs, first == last (closed ring)
  const pts = latlngs.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`);
  // Ensure closed ring
  if (pts.length > 0 && pts[0] !== pts[pts.length - 1]) {
    pts.push(pts[0]);
  }
  return pts.join(" ");
}

function circleToCAP(center: { lat: number; lng: number }, radiusMeters: number): string {
  // CAP circle: "lat,lon radius_km"
  const radiusKm = (radiusMeters / 1000).toFixed(3);
  return `${center.lat.toFixed(5)},${center.lng.toFixed(5)} ${radiusKm}`;
}

function nanoid8(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MapAreaEditor({
  shapes,
  onShapesChange,
  center = [1.3521, 103.8198], // Singapore default
  zoom = 11,
}: MapAreaEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const drawnItemsRef = useRef<LeafletFeatureGroup | null>(null);
  // Keep a stable ref to the latest onShapesChange to avoid stale closures
  const onShapesChangeRef = useRef(onShapesChange);
  onShapesChangeRef.current = onShapesChange;
  const shapesRef = useRef(shapes);
  shapesRef.current = shapes;

  const addShape = useCallback((shape: DrawnShape) => {
    const next = [...shapesRef.current, shape];
    onShapesChangeRef.current(next);
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Dynamically import Leaflet to avoid SSR issues
    let L: typeof import("leaflet");
    let cleanup = false;

    (async () => {
      const leaflet = await import("leaflet");
      L = leaflet.default ?? leaflet;
      await import("leaflet-draw");

      if (cleanup || !containerRef.current) return;

      // Fix default marker icon paths broken by bundlers
      // @ts-ignore
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      // Inject Leaflet CSS
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }
      if (!document.getElementById("leaflet-draw-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-draw-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.css";
        document.head.appendChild(link);
      }

      // Create map
      const map = L.map(containerRef.current!, {
        center,
        zoom,
        zoomControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // FeatureGroup to store drawn layers
      const drawnItems = new L.FeatureGroup();
      drawnItems.addTo(map);
      drawnItemsRef.current = drawnItems;

      // Draw control — polygon and circle only
      const drawControl = new (L.Control as any).Draw({
        edit: {
          featureGroup: drawnItems,
          edit: false, // disable edit toolbar to keep UX simple
          remove: false,
        },
        draw: {
          polygon: {
            allowIntersection: true,
            showArea: true,
            shapeOptions: {
              color: "#3b82f6",
              fillColor: "#3b82f6",
              fillOpacity: 0.15,
              weight: 2,
            },
            guideLayers: [],
            snapDistance: 20,
          },
          circle: {
            shapeOptions: {
              color: "#f59e0b",
              fillColor: "#f59e0b",
              fillOpacity: 0.15,
              weight: 2,
            },
            showRadius: true,
            metric: true,
            feet: false,
          },
          // Disable all other draw types
          polyline: false,
          rectangle: false,
          marker: false,
          circlemarker: false,
        },
      });
      map.addControl(drawControl);

      // Handle draw:created event
      map.on((L as any).Draw.Event.CREATED, (e: any) => {
        const layer = e.layer;
        const type: string = e.layerType;
        drawnItems.addLayer(layer);

        let shape: DrawnShape;
        const id = nanoid8();

        if (type === "polygon") {
          const latlngs: Array<{ lat: number; lng: number }> = layer.getLatLngs()[0];
          const capValue = polygonToCAP(latlngs);
          const ptCount = latlngs.length;
          shape = {
            id,
            type: "polygon",
            capValue,
            label: `Polygon (${ptCount} vertices)`,
          };
        } else if (type === "circle") {
          const center = layer.getLatLng();
          const radiusMeters: number = layer.getRadius();
          const capValue = circleToCAP(center, radiusMeters);
          const radiusKm = (radiusMeters / 1000).toFixed(2);
          shape = {
            id,
            type: "circle",
            capValue,
            label: `Circle (r = ${radiusKm} km)`,
          };
        } else {
          return;
        }

        // Attach the shape id to the layer for removal tracking
        (layer as any)._capShapeId = id;
        addShape(shape);
      });

      mapRef.current = map;
    })();

    return () => {
      cleanup = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        drawnItemsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount once only

  // Sync incoming shapes prop to Leaflet layers (e.g. when parent re-renders with existing shapes)
  // We only add layers for shapes that are not already on the map
  useEffect(() => {
    if (!mapRef.current || !drawnItemsRef.current) return;
    (async () => {
      const leaflet = await import("leaflet");
      const L = leaflet.default ?? leaflet;
      const existing = new Set<string>();
      drawnItemsRef.current!.eachLayer((layer: any) => {
        if (layer._capShapeId) existing.add(layer._capShapeId);
      });
      for (const shape of shapes) {
        if (existing.has(shape.id)) continue;
        try {
          if (shape.type === "polygon") {
            const pairs = shape.capValue.trim().split(" ").map((p) => {
              const [lat, lng] = p.split(",").map(Number);
              return [lat, lng] as [number, number];
            });
            const layer = L.polygon(pairs, {
              color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 0.15, weight: 2,
            }) as any;
            layer._capShapeId = shape.id;
            drawnItemsRef.current!.addLayer(layer);
          } else if (shape.type === "circle") {
            const parts = shape.capValue.trim().split(" ");
            if (parts.length === 2) {
              const [latStr, lngStr] = parts[0].split(",");
              const radiusKm = parseFloat(parts[1]);
              const layer = L.circle([parseFloat(latStr), parseFloat(lngStr)], {
                radius: radiusKm * 1000,
                color: "#f59e0b", fillColor: "#f59e0b", fillOpacity: 0.15, weight: 2,
              }) as any;
              layer._capShapeId = shape.id;
              drawnItemsRef.current!.addLayer(layer);
            }
          }
        } catch (_) { /* ignore malformed shapes */ }
      }
      // Remove layers for shapes that were deleted from the prop
      const shapeIds = new Set(shapes.map((s) => s.id));
      const toRemove: any[] = [];
      drawnItemsRef.current!.eachLayer((layer: any) => {
        if (layer._capShapeId && !shapeIds.has(layer._capShapeId)) toRemove.push(layer);
      });
      toRemove.forEach((layer) => drawnItemsRef.current!.removeLayer(layer));
    })();
  }, [shapes]);

  // Remove a shape: remove from drawnItems layer group and call onShapesChange
  const removeShape = useCallback((id: string) => {
    if (drawnItemsRef.current) {
      drawnItemsRef.current.eachLayer((layer: any) => {
        if (layer._capShapeId === id) {
          drawnItemsRef.current!.removeLayer(layer);
        }
      });
    }
    onShapesChangeRef.current(shapesRef.current.filter((s) => s.id !== id));
  }, []);

  return (
    <div className="space-y-3">
      {/* Map container */}
      <div
        ref={containerRef}
        className="w-full rounded-xl border border-border overflow-hidden"
        style={{ height: "420px", background: "#1a1a2e" }}
      />

      {/* Draw instructions */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground px-1">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-blue-500/60 border border-blue-400" />
          <strong className="text-foreground">Polygon:</strong> click vertices → double-click to close
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full bg-amber-500/60 border border-amber-400" />
          <strong className="text-foreground">Circle:</strong> click center → drag to set radius
        </span>
      </div>

      {/* Drawn shapes list */}
      {shapes.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Drawn Shapes ({shapes.length})
          </p>
          {shapes.map((shape) => (
            <div
              key={shape.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                      shape.type === "polygon"
                        ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                        : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    }`}
                  >
                    {shape.type === "polygon" ? "⬡ Polygon" : "◎ Circle"}
                  </span>
                  <span className="text-xs text-muted-foreground">{shape.label}</span>
                </div>
                <code className="block text-xs text-foreground/70 font-mono truncate max-w-full">
                  {shape.capValue.length > 80
                    ? shape.capValue.slice(0, 77) + "…"
                    : shape.capValue}
                </code>
              </div>
              <button
                type="button"
                onClick={() => removeShape(shape.id)}
                className="shrink-0 text-muted-foreground hover:text-destructive transition-colors mt-0.5"
                title="Remove shape"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14H6L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4h6v2" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {shapes.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">
          No shapes drawn yet. Use the toolbar on the map to draw a polygon or circle.
        </p>
      )}
    </div>
  );
}
