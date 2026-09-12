import { useState, useEffect, useMemo, type ReactNode } from "react";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";

/*
  PUBLIC MARINETERREIN DASHBOARD — single kiosk page, 1080x1920.

  This is a starter component for the new public-facing repo. It's wired to
  MOCK DATA so you can preview it here; swap the marked sections for real
  fetch calls to your existing API once you scaffold the new project.

  ── THRESHOLD CONFIG ──────────────────────────────────────────────────
  All "good/not good" thresholds live in one place below (STATUS_SCALE,
  VISITOR_THRESHOLDS, WATER_TEMP_THRESHOLDS,
  WEATHER_THRESHOLDS) so you can tune numbers without touching render logic.
*/

type StatusKey = "light" | "moderate" | "busy" | "crowded";

// Shared 4-tier status scale (used for Visitors + Sound), your hex codes.
const STATUS_SCALE: Record<StatusKey, { label: string; color: string }> = {
  light: { label: "Light", color: "#FFCD32" },
  moderate: { label: "Moderate", color: "#F8931F" },
  busy: { label: "Busy", color: "#EF383A" },
  crowded: { label: "Crowded", color: "#B100F7" },
};
const STATUS_ORDER: StatusKey[] = ["light", "moderate", "busy", "crowded"];

// Per-camera visitor thresholds, from your "Adjusted Thresholds" table.
// Keyed by the same camera id used by /api/public/busyness.
type VisitorThresholds = { light: number; moderate: number; busy: number };
const VISITOR_THRESHOLDS: Record<string, VisitorThresholds> = {
  "MT-Picnic": { light: 36, moderate: 250, busy: 429 },
  "MT-Boardwalk": { light: 20, moderate: 160, busy: 300 },
  "MT-Shuttercam": { light: 45, moderate: 300, busy: 550 },
  "MT-Terrace": { light: 60, moderate: 430, busy: 780 },
};

function statusForCount(
  count: number,
  thresholds: VisitorThresholds,
): StatusKey {
  if (count < thresholds.light) return "light";
  if (count < thresholds.moderate) return "moderate";
  if (count < thresholds.busy) return "busy";
  return "crowded";
}

// PLACEHOLDER — no live noise standard maps directly onto instantaneous dB
// readings (RIVM/GGD's 50 dB guideline is an annual Lden average, not a
// live number). These are a practical starting scale — adjust freely.
// KNZB (Dutch swimming federation) open-water guidance: don't swim below
// 15C, wetsuit + cap recommended up to 18C.
type WaterStatus = "cold" | "caution" | "good";
const WATER_TEMP_THRESHOLDS = { cold: 15, caution: 18 };
const WATER_STATUS_COLORS: Record<WaterStatus, string> = {
  cold: "#EF383A",
  caution: "#F8931F",
  good: "#1D9E75", // PLACEHOLDER teal — you said no blue picked yet
};

function statusForWaterTemp(tempC: number): WaterStatus {
  if (tempC < WATER_TEMP_THRESHOLDS.cold) return "cold";
  if (tempC < WATER_TEMP_THRESHOLDS.caution) return "caution";
  return "good";
}

// Weather, by air temperature. Adjust freely — these are just sensible
// Dutch-climate bands (NL summers rarely exceed low 30s C).
type WeatherStatus = "cold" | "cool" | "warm" | "hot" | "too_hot";
const WEATHER_THRESHOLDS = { cold: 10, cool: 16, warm: 24, hot: 30 };
const WEATHER_STATUS_COLORS: Record<WeatherStatus, string> = {
  cold: "#378ADD",
  cool: "#1D9E75",
  warm: "#F8931F",
  hot: "#EF383A",
  too_hot: "#B100F7",
};

function statusForWeather(tempC: number): WeatherStatus {
  if (tempC < WEATHER_THRESHOLDS.cold) return "cold";
  if (tempC < WEATHER_THRESHOLDS.cool) return "cool";
  if (tempC < WEATHER_THRESHOLDS.warm) return "warm";
  if (tempC < WEATHER_THRESHOLDS.hot) return "hot";
  return "too_hot";
}

// Real GPS coordinates + display labels for each camera zone.
type LocationMeta = { label: string; lat: number; lon: number };
const LOCATIONS: Record<string, LocationMeta> = {
  "MT-Picnic": { label: "Voorwerf", lat: 52.372257, lon: 4.916313 },
  "MT-Boardwalk": { label: "Boardwalk", lat: 52.372800, lon: 4.915086 },
  "MT-Shuttercam": { label: "Kadewest", lat: 52.373600, lon: 4.914824 },
  "MT-Terrace": { label: "Terrace Homeland", lat: 52.373050, lon: 4.9165 },
};

const MAP_BOUNDS: [[number, number], [number, number]] = [
  [
    Math.min(...Object.values(LOCATIONS).map((l) => l.lat)) - 0.0003,
    Math.min(...Object.values(LOCATIONS).map((l) => l.lon)) - 0.0005,
  ],
  [
    Math.max(...Object.values(LOCATIONS).map((l) => l.lat)) + 0.0003,
    Math.max(...Object.values(LOCATIONS).map((l) => l.lon)) + 0.0005,
  ],
];

// One PNG per busyness tier, swapped in on the map marker per-location.
const MARKER_ICON_SIZE = 115;

const STATUS_COLORS: Record<StatusKey, string> = {
  light: "#01ADEF",
  moderate: "#016991",
  busy: "#1A4B57",
  crowded: "#6A0E3F",
};

function buildMarkerIcon(
  status: StatusKey,
  count: number | null,
  label: string
): L.DivIcon {
  return L.divIcon({
    className: "mt-marker-icon",
    html: `
      <div style="
        width:${MARKER_ICON_SIZE}px;
        height:${MARKER_ICON_SIZE}px;
        border-radius:50%;
        background:${STATUS_COLORS[status]};
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        text-align:center;
        color:#ffffff;
        box-shadow:0 2px 6px rgba(0,0,0,0.25);
        font-family:Overpass, sans-serif;
      ">
        <div style="
          font-size:14px;
          font-weight:500;
          line-height:1.1;
          padding:0 8px;
        ">
          ${label}
        </div>

        <div style="
          font-size:32px;
          font-weight:800;
          line-height:1.1;
          margin:4px 0;
        ">
          ${count ?? "-"}
        </div>

        <div style="
          font-size:13px;
          font-weight:400;
          text-transform:capitalize;
          line-height:1.1;
        ">
          ${status}
        </div>
      </div>
    `,
    iconSize: [MARKER_ICON_SIZE, MARKER_ICON_SIZE],
    iconAnchor: [MARKER_ICON_SIZE / 2, MARKER_ICON_SIZE / 2 + 20],
  });
}

// Per-location visitor counts. Starts null (rendered as "-" on the map)
// until the first successful /api/public/busyness poll fills them in.
type LocationData = { count: number | null };
const INITIAL_LOCATIONS: Record<string, LocationData> = {
  "MT-Picnic": { count: null },
  "MT-Boardwalk": { count: null },
  "MT-Shuttercam": { count: null },
  "MT-Terrace": { count: null },
};
const INITIAL_WEATHER_CONDITION = "partly-cloudy";

type DashboardData = {
  locations: Record<string, LocationData>;
  waterTempC: number | null;
  weather: { tempC: number | null; condition: string };
  soundDb: number | null;
  currentVisitors: number | null;
  swimWaterVerdict: string | null;
};

type LiveSummary = {
  currentVisitors: number;
  soundDb: number | null;
  waterTempC: number | null;
  weatherTempC: number | null;
  swimWaterVerdict: string | null;
  generatedAt: string;
};

type BusynessRow = { id: string; label: string; count: number };
type BusynessResponse = { rows: BusynessRow[]; fetchedAt: string };

const LIVE_SUMMARY_URL = "/api/public/live-summary";
const BUSYNESS_URL = "/api/public/busyness";
const REFRESH_INTERVAL_MS = 60 * 1000;

function useLiveData(): DashboardData {
  const [data, setData] = useState<DashboardData>({
    locations: INITIAL_LOCATIONS,
    waterTempC: null,
    weather: { tempC: null, condition: INITIAL_WEATHER_CONDITION },
    soundDb: null,
    currentVisitors: null,
    swimWaterVerdict: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const [summaryRes, busynessRes] = await Promise.all([
          fetch(LIVE_SUMMARY_URL),
          fetch(BUSYNESS_URL),
        ]);
        if (!summaryRes.ok)
          throw new Error(`live-summary returned ${summaryRes.status}`);
        if (!busynessRes.ok)
          throw new Error(`busyness returned ${busynessRes.status}`);
        const summary: LiveSummary = await summaryRes.json();
        const busyness: BusynessResponse = await busynessRes.json();
        if (cancelled) return;

        setData((prev) => {
          const locations = { ...prev.locations };
          for (const row of busyness.rows) {
            locations[row.id] = { ...locations[row.id], count: row.count };
          }
          return {
            locations,
            waterTempC: summary.waterTempC ?? prev.waterTempC,
            weather: {
              ...prev.weather,
              tempC: summary.weatherTempC ?? prev.weather.tempC,
            },
            soundDb: summary.soundDb ?? prev.soundDb,
            currentVisitors: summary.currentVisitors ?? prev.currentVisitors,
            swimWaterVerdict: summary.swimWaterVerdict ?? prev.swimWaterVerdict,
          };
        });
      } catch (err) {
        console.error("Failed to load live data:", err);
      }
    }

    poll();
    const intervalId = window.setInterval(poll, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  return data;
}

function StatCard({
  icon,
  label,
  value,
  color,
  valueFontSize,
  iconMargin,
  valueMarginTop,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  color: string;
  valueFontSize?: number;
  iconMargin?: number;
  valueMarginTop?: number;
}) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 20,
        padding: "20px 18px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 500, color: "#2B3A44", textAlign: "center" }}>
        {label}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: 128,
          lineHeight: 1,
          color,
          marginTop: iconMargin ?? -17,
          marginBottom: iconMargin ?? -17,
        }}
      >
        {icon}
      </div>

      <div
        style={{
          fontSize: valueFontSize ?? 48,
          fontWeight: 700,
          color: "#2b3a44",
          marginTop: valueMarginTop ?? 4,
          textAlign: "center",
        }}
      >
        {value}
      </div>
    </div>
  );
}

// Tier styling + pictograms match zwemwater.nl's own legend (blue swim
// icons for the two "safe-ish" levels, orange for caution, red for the
// ban) -- this intentionally diverges from the internal dashboard's
// 5-color SWIM_VERDICT_COLORS (OperationsDashboard.tsx uses a
// green->dark-red gradient). Icons are the actual zwemwater.nl-style PNGs,
// placed under public/INFO Screen SVGs/Swim Status/.
const SWIM_VERDICT_STYLE: Record<string, { color: string; icon: string }> = {
  "In orde": { color: "#0284c7", icon: "status-goed.svg" },
  "Nader onderzoek": { color: "#0284c7", icon: "status-nader_onderzoek.svg" },
  "Waarschuwing": { color: "#ea580c", icon: "status-waarschuwing.svg" },
  // Merged tier: Zwemverbod and Negatief zwemadvies both render as the
  // same "don't swim" icon/label on the public screen. The internal
  // dashboard (OperationsDashboard.tsx) still tracks them separately.
  "Negatief zwemadvies": { color: "#ea580c", icon: "status-zwemverbod.svg" },
  "Zwemverbod": { color: "#ea580c", icon: "status-zwemverbod.svg" },
};

const UNKNOWN_SWIM_STYLE = { color: "#94A3B8", icon: "status-unknown.svg" };

function SwimIcon({ file, size = 56 }: { file: string; size?: number }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}INFO Screen SVGs/Swim Status/${file}`}
      alt=""
      style={{ width: size, height: size, flexShrink: 0, objectFit: "contain" }}
    />
  );
}

export default function PublicDashboard() {
  const data = useLiveData();

  const visitorStatuses = useMemo(
    () =>
      Object.entries(data.locations).map(([id, loc]) => ({
        id,
        label: LOCATIONS[id]?.label ?? id,
        lat: LOCATIONS[id]?.lat ?? 0,
        lon: LOCATIONS[id]?.lon ?? 0,
        ...loc,
        status:
          loc.count !== null
            ? statusForCount(loc.count, VISITOR_THRESHOLDS[id])
            : "light",
        count: loc.count,
      })),
    [data.locations],
  );

  // "Average status" across locations: map each status to its ordinal
  // (0-3), average, round to nearest tier.
  const avgStatusKey = useMemo<StatusKey>(() => {
    const avgIndex =
      visitorStatuses.reduce(
        (sum, l) => sum + STATUS_ORDER.indexOf(l.status),
        0,
      ) / visitorStatuses.length;
    return STATUS_ORDER[Math.round(avgIndex)];
  }, [visitorStatuses]);

  const PLACEHOLDER_COLOR = "#94A3B8";
  const waterStatus =
    data.waterTempC !== null ? statusForWaterTemp(data.waterTempC) : null;
  const weatherStatus =
    data.weather.tempC !== null ? statusForWeather(data.weather.tempC) : null;
  const visitorsDisplay =
    data.currentVisitors !== null ? String(data.currentVisitors) : "–";
  const waterTempDisplay =
    data.waterTempC !== null ? `${data.waterTempC.toFixed(1)} C` : "–";
  const weatherDisplay =
    data.weather.tempC !== null ? `${data.weather.tempC} C` : "–";
  const swimVerdict = data.swimWaterVerdict;
  const swimStyle = swimVerdict
    ? SWIM_VERDICT_STYLE[swimVerdict] ?? UNKNOWN_SWIM_STYLE
    : UNKNOWN_SWIM_STYLE;
  const swimColor = swimStyle.color;
  const swimDisplay = swimVerdict ?? "Onbekend";

  const isEmbed = new URLSearchParams(window.location.search).get("embed") === "1";

  useEffect(() => {
    if (!isEmbed) return;
    const prevBodyBg = document.body.style.background;
    const prevHtmlBg = document.documentElement.style.background;
    document.body.style.background = "transparent";
    document.documentElement.style.background = "transparent";
    return () => {
      document.body.style.background = prevBodyBg;
      document.documentElement.style.background = prevHtmlBg;
    };
  }, [isEmbed]);

  const statCards = (
    <div
      className="public-dashboard-grid"
      style={{
        position: "relative",
        zIndex: 1,
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 24,
      }}
    >
      <StatCard
        icon={
          <img
            src={`${import.meta.env.BASE_URL}INFO Screen SVGs/Current Visitors Logo.svg`}
            alt="Current visitors"
            style={{ width: 118, height: 118 }}
          />
        }
        label="Actuele bezoekers"
        value={visitorsDisplay}
        color={
          data.currentVisitors !== null
            ? STATUS_SCALE[avgStatusKey].color
            : PLACEHOLDER_COLOR
        }
      />
      <StatCard
        icon={
          <img
            src={`${import.meta.env.BASE_URL}INFO Screen SVGs/Current water temp logo.svg`}
            alt="Water temperature"
            style={{ width: 118, height: 118 }}
          />
        }
        label="Actuele watertemperatuur"
        value={waterTempDisplay}
        color={
          waterStatus ? WATER_STATUS_COLORS[waterStatus] : PLACEHOLDER_COLOR
        }
      />
      <StatCard
        icon={
          <img
            src={`${import.meta.env.BASE_URL}INFO Screen SVGs/Current air temperature logo.svg`}
            alt="Air temperature"
            style={{ width: 118, height: 118 }}
          />
        }
        label="Actuele luchttemperatuur"
        value={weatherDisplay}
        color={
          weatherStatus
            ? WEATHER_STATUS_COLORS[weatherStatus]
            : PLACEHOLDER_COLOR
        }
      />
      <StatCard
        icon={<SwimIcon file={swimStyle.icon} size={92} />}
        label="Zwemwaterstatus"
        value={swimDisplay}
        color={swimColor}
        valueFontSize={34}
        iconMargin={-12}
        valueMarginTop={8}
      />
    </div>
  );

  if (isEmbed) {
    return (
      <div
        style={{
          background: "transparent",
          padding: 24,
          boxSizing: "border-box",
          fontFamily:
            '"Overpass", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <style>{`
          @media (max-width: 420px) {
            .public-dashboard-grid {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
        {statCards}
      </div>
    );
  }

  return (
    <div
      style={{
        width: 1080,
        height: 1920,
        padding: "56px 48px",
        overflow: "visible",
        position: "relative",
        zIndex: 1,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        fontFamily:
          '"Overpass", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <img
        src={`${import.meta.env.BASE_URL}INFO Screen SVGs/Screen Background.svg`}
        alt=""
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          marginTop: -56,
          marginLeft: -48,
          marginRight: -48,
          paddingTop: 28,
          paddingLeft: 48,
          paddingRight: 48,
        }}
      >
        <div
          style={{
            position: "relative",
            zIndex: 1,
            marginBottom: 24,
            padding: "8px 4px",
            display: "flex",
            alignItems: "center",
            gap: 20,
          }}
        >
          <img
            src={`${import.meta.env.BASE_URL}INFO Screen SVGs/marineterrein LIVE logo.svg`}
            alt="Marineterrein LIVE"
            style={{
              height: 150,
              width: "auto",
              display: "block",
              transform: "translateY(4px)",
            }}
          />
        </div>

        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 24,
          }}
        >
          <StatCard
            icon={
              <img
                src={`${import.meta.env.BASE_URL}INFO Screen SVGs/Current Visitors Logo.svg`}
                alt="Current visitors"
                style={{ width: 118, height: 118 }}
              />
            }
            label="Actuele bezoekers"
            value={visitorsDisplay}
            color={
              data.currentVisitors !== null
                ? STATUS_SCALE[avgStatusKey].color
                : PLACEHOLDER_COLOR
            }
          />
          <StatCard
            icon={
              <img
                src={`${import.meta.env.BASE_URL}INFO Screen SVGs/Current water temp logo.svg`}
                alt="Water temperature"
                style={{ width: 118, height: 118 }}
              />
            }
            label="Actuele watertemperatuur"
            value={waterTempDisplay}
            color={
              waterStatus ? WATER_STATUS_COLORS[waterStatus] : PLACEHOLDER_COLOR
            }
          />
          <StatCard
            icon={
              <img
                src={`${import.meta.env.BASE_URL}INFO Screen SVGs/Current air temperature logo.svg`}
                alt="Air temperature"
                style={{ width: 118, height: 118 }}
              />
            }
            label="Actuele luchttemperatuur"
            value={weatherDisplay}
            color={
              weatherStatus
                ? WEATHER_STATUS_COLORS[weatherStatus]
                : PLACEHOLDER_COLOR
            }
          />
          <StatCard
            icon={<SwimIcon file={swimStyle.icon} size={92} />}
            label="Zwemwaterstatus"
            value={swimDisplay}
            color={swimColor}
            valueFontSize={34}
            iconMargin={-12}
            valueMarginTop={8}
          />
        </div>
      </div>

      <div
        style={{
          marginTop: 24,
          background: "#fff",
          borderRadius: 20,
          padding: 24,
          height: 790,
          display: "flex",
          flexDirection: "column",
	  zIndex: 2,
        }}
      >
        <div
          style={{
            position: "relative",
            flex: 1,
            borderRadius: 14,
            overflow: "hidden",
          }}
        >
          <MapContainer
            bounds={MAP_BOUNDS}
            boundsOptions={{
              paddingTopLeft: [180, 350],
              paddingBottomRight: [180, 70],
            }}
            style={{ width: "100%", height: "100%" }}
            zoomControl={false}
            dragging={false}
            scrollWheelZoom={false}
            doubleClickZoom={false}
            attributionControl={false}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=cb1_2ajx_1_ffa26773f61de818a407c46e"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            />
            {visitorStatuses.map((loc) => (
              <Marker
                key={loc.id}
                position={[loc.lat, loc.lon]}
                icon={buildMarkerIcon(loc.status, loc.count, loc.label)}
              />
            ))}
          </MapContainer>
        </div>
      </div>

      <div
        style={{
          marginTop: 24,
          background: "#fff",
          borderRadius: 20,
          padding: "18px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
          fontSize: 34,
          color: "#2b3a44",
          position: "relative",
          zIndex: 3,
          minHeight: 110,
        }}
      >
        <span>
          Visit <span style={{ color: "#1D9E75" }}>data.marineterrein.nl</span>{" "}
          for more info
        </span>
        <img
          src={`${import.meta.env.BASE_URL}tappstone-qr.png`}
          alt="QR code for data.marineterrein.nl"
          style={{ width: 80, height: 80, borderRadius: 8 }}
        />
      </div>

      <div
        style={{
          marginTop: -65,
          marginLeft: -48,
          marginRight: -48,
          marginBottom: -56,
          height: 160,
          minHeight: 160,
          background: "#1A4B57",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            color: "#ffffff",
            fontSize: 18,
            position: "relative",
            zIndex: 4,
            transform: "translateY(36px)",
          }}
        >
          <span>Powered by</span>
          <img
            src={`${import.meta.env.BASE_URL}INFO Screen SVGs/Tapp Logo - White.svg`}
            alt="TAPP"
            style={{
              height: "40px",
              display: "block",
              transform: "translateY(4px)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
