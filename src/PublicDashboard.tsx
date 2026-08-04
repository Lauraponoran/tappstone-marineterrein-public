import { useState, useEffect, useMemo, type ReactNode } from "react";

/*
  PUBLIC MARINETERREIN DASHBOARD — single kiosk page, 1080x1920.

  This is a starter component for the new public-facing repo. It's wired to
  MOCK DATA so you can preview it here; swap the marked sections for real
  fetch calls to your existing API once you scaffold the new project.

  ── THRESHOLD CONFIG ──────────────────────────────────────────────────
  All "good/not good" thresholds live in one place below (STATUS_SCALE,
  VISITOR_THRESHOLDS, SOUND_THRESHOLDS, WATER_TEMP_THRESHOLDS,
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
type VisitorThresholds = { light: number; moderate: number; busy: number };
const VISITOR_THRESHOLDS: Record<string, VisitorThresholds> = {
  "MT-Picnic/Voorwerf": { light: 36, moderate: 250, busy: 429 },
};

function statusForCount(count: number, thresholds: VisitorThresholds): StatusKey {
  if (count < thresholds.light) return "light";
  if (count < thresholds.moderate) return "moderate";
  if (count < thresholds.busy) return "busy";
  return "crowded";
}

// PLACEHOLDER — no live noise standard maps directly onto instantaneous dB
// readings (RIVM/GGD's 50 dB guideline is an annual Lden average, not a
// live number). These are a practical starting scale — adjust freely.
const SOUND_THRESHOLDS = { light: 55, moderate: 65, busy: 80 };

function statusForSound(db: number): StatusKey {
  if (db < SOUND_THRESHOLDS.light) return "light";
  if (db < SOUND_THRESHOLDS.moderate) return "moderate";
  if (db < SOUND_THRESHOLDS.busy) return "busy";
  return "crowded";
}

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

// MOCK DATA — replace with your real API calls (same endpoints as the
// private dashboard; add a thin /api/public/* layer if you want to limit
// what's exposed).
type LocationData = { count: number; x: number; y: number };
const MOCK_LOCATIONS: Record<string, LocationData> = {
  "MT-Picnic/Voorwerf": { count: 180, x: 34, y: 30 },
};
const MOCK_WATER_TEMP = 17.4;
const MOCK_WEATHER = { tempC: 22, condition: "partly-cloudy" };
const MOCK_SOUND_DB = 60;

type DashboardData = {
  locations: Record<string, LocationData>;
  waterTempC: number;
  weather: { tempC: number; condition: string };
  soundDb: number;
};

type LiveSummary = {
  currentVisitors: number;
  soundDb: number | null;
  waterTempC: number | null;
  weatherTempC: number | null;
  generatedAt: string;
};

const LIVE_SUMMARY_URL = "/api/public/live-summary";
const REFRESH_INTERVAL_MS = 60 * 1000;

function useLiveData(): DashboardData {
  const [data, setData] = useState<DashboardData>({
    locations: MOCK_LOCATIONS,
    waterTempC: MOCK_WATER_TEMP,
    weather: MOCK_WEATHER,
    soundDb: MOCK_SOUND_DB,
  });

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(LIVE_SUMMARY_URL);
        if (!res.ok) throw new Error(`live-summary returned ${res.status}`);
        const summary: LiveSummary = await res.json();
        if (cancelled) return;

        setData((prev) => ({
          // MT-Picnic/Voorwerf is the one location shown on the map for now;
          // its count is set to the combined total until per-camera live
          // counts are available.
          locations: {
            "MT-Picnic/Voorwerf": {
              ...prev.locations["MT-Picnic/Voorwerf"],
              count: summary.currentVisitors,
            },
          },
          waterTempC: summary.waterTempC ?? prev.waterTempC,
          weather: {
            ...prev.weather,
            tempC: summary.weatherTempC ?? prev.weather.tempC,
          },
          soundDb: summary.soundDb ?? prev.soundDb,
        }));
      } catch (err) {
        console.error("Failed to load live summary:", err);
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
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 20,
        padding: "28px 20px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
      }}
    >
      <div style={{ fontSize: 40, color, lineHeight: 1 }}>{icon}</div>
      <div style={{ fontSize: 17, color: "#5a6b78" }}>{label}</div>
      <div style={{ fontSize: 34, fontWeight: 700, color: "#2b3a44" }}>{value}</div>
    </div>
  );
}

export default function PublicDashboard() {
  const data = useLiveData();

  const visitorStatuses = useMemo(
    () =>
      Object.entries(data.locations).map(([name, loc]) => ({
        name,
        ...loc,
        status: statusForCount(loc.count, VISITOR_THRESHOLDS[name]),
      })),
    [data.locations]
  );

  const totalVisitors = visitorStatuses.reduce((sum, l) => sum + l.count, 0);

  // "Average status" across locations: map each status to its ordinal
  // (0-3), average, round to nearest tier.
  const avgStatusKey = useMemo<StatusKey>(() => {
    const avgIndex =
      visitorStatuses.reduce((sum, l) => sum + STATUS_ORDER.indexOf(l.status), 0) /
      visitorStatuses.length;
    return STATUS_ORDER[Math.round(avgIndex)];
  }, [visitorStatuses]);

  const waterStatus = statusForWaterTemp(data.waterTempC);
  const soundStatus = statusForSound(data.soundDb);
  const weatherStatus = statusForWeather(data.weather.tempC);

  return (
    <div
      style={{
        width: 1080,
        height: 1920,
        background: "#EAF1F5",
        padding: "56px 48px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <StatCard
          icon="👥"
          label="Current visitors"
          value={totalVisitors}
          color={STATUS_SCALE[avgStatusKey].color}
        />
        <StatCard
          icon="🌡️"
          label="Water temp"
          value={`${data.waterTempC.toFixed(1)} C`}
          color={WATER_STATUS_COLORS[waterStatus]}
        />
        <StatCard
          icon="⛅"
          label="Weather"
          value={`${data.weather.tempC} C`}
          color={WEATHER_STATUS_COLORS[weatherStatus]}
        />
        <StatCard
          icon="🔊"
          label="Sound"
          value={`${Math.round(data.soundDb)} dB`}
          color={STATUS_SCALE[soundStatus].color}
        />
      </div>

      <div
        style={{
          marginTop: 24,
          background: "#fff",
          borderRadius: 20,
          padding: "18px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 17,
          color: "#2b3a44",
        }}
      >
        <span>
          Visit <span style={{ color: "#1D9E75" }}>data.marineterrein.nl</span> for more
          info
        </span>
        <div style={{ width: 44, height: 44, background: "#eee", borderRadius: 6 }} />
      </div>

      <div
        style={{
          marginTop: 24,
          background: "#fff",
          borderRadius: 20,
          padding: 24,
          flex: 1,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ textAlign: "center", fontSize: 20, color: "#2b3a44", marginBottom: 16 }}>
          Busyness
        </div>
        <div
          style={{
            position: "relative",
            flex: 1,
            borderRadius: 14,
            background: "#dfe6ea",
            overflow: "hidden",
          }}
        >
          {visitorStatuses.map((loc) => (
            <div
              key={loc.name}
              title={`${loc.name}: ${loc.count} (${STATUS_SCALE[loc.status].label})`}
              style={{
                position: "absolute",
                left: `${loc.x}%`,
                top: `${loc.y}%`,
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: STATUS_SCALE[loc.status].color,
                transform: "translate(-50%, -50%)",
                opacity: 0.85,
              }}
            />
          ))}
        </div>
      </div>

      <div style={{ textAlign: "center", marginTop: 20, color: "#8a97a1", fontSize: 15 }}>
        Powered by <b>tapp.</b>
      </div>
    </div>
  );
}
