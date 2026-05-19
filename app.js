// Great-circle distance in miles between two lat/lon points.
function haversineMiles(a, b) {
  const R = 3958.7613;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Sample points along the great-circle path so the line curves on the map.
function greatCirclePoints(a, b, steps = 64) {
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;
  const lat1 = toRad(a.lat), lon1 = toRad(a.lon);
  const lat2 = toRad(b.lat), lon2 = toRad(b.lon);
  const d = 2 * Math.asin(Math.sqrt(
    Math.sin((lat2 - lat1) / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2
  ));
  if (d === 0) return [[a.lat, a.lon]];
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    const lat = Math.atan2(z, Math.sqrt(x * x + y * y));
    const lon = Math.atan2(y, x);
    points.push([toDeg(lat), toDeg(lon)]);
  }
  return points;
}

const map = L.map("map", { worldCopyJump: true }).setView([30, -30], 3);

L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  subdomains: "abcd",
  maxZoom: 19,
}).addTo(map);

function airportMarkerIcon(color) {
  return L.divIcon({
    className: "airport-marker",
    html: `<div style="width:10px;height:10px;background:${color};border:2px solid #0f172a;border-radius:50%;box-shadow:0 0 6px ${color};"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

const PAST_COLOR = "#38bdf8";
const UPCOMING_COLOR = "#fbbf24";

const pastAirports = new Set();
const allAirports = new Set();
const allLatLngs = [];
let flownMiles = 0;
let flownSegments = 0;
let pastTripCount = 0;
let upcomingTripCount = 0;

const tripList = document.getElementById("trip-list");

function edgeKey(a, b) {
  return [a, b].sort().join("|");
}

TRIPS.forEach((trip) => {
  const count = trip.count || 1;
  const upcoming = !!trip.upcoming;
  let legMiles = 0;
  let legSegments = 0;
  const drawnEdgesThisTrip = new Set();

  trip.legs.forEach((leg) => {
    for (let i = 0; i < leg.length - 1; i++) {
      const fromCode = leg[i];
      const toCode = leg[i + 1];
      const from = AIRPORTS[fromCode];
      const to = AIRPORTS[toCode];
      if (!from || !to) {
        console.warn(`Missing airport for ${fromCode} -> ${toCode}`);
        continue;
      }

      const miles = haversineMiles(from, to);
      legMiles += miles;
      legSegments += 1;
      allAirports.add(fromCode);
      allAirports.add(toCode);
      if (!upcoming) {
        pastAirports.add(fromCode);
        pastAirports.add(toCode);
      }

      const key = edgeKey(fromCode, toCode);
      if (!drawnEdgesThisTrip.has(key)) {
        drawnEdgesThisTrip.add(key);
        const path = greatCirclePoints(from, to);
        const polyOpts = {
          color: upcoming ? UPCOMING_COLOR : PAST_COLOR,
          weight: 2,
          opacity: upcoming ? 0.9 : 0.7,
        };
        if (upcoming) polyOpts.dashArray = "6 6";
        L.polyline(path, polyOpts).addTo(map).bindTooltip(
          `${fromCode} &harr; ${toCode}<br>${Math.round(miles).toLocaleString()} mi${upcoming ? " · upcoming" : ""}`
        );
        allLatLngs.push(...path);
      }
    }
  });

  const totalSegs = legSegments * count;
  const totalMi = legMiles * count;

  if (upcoming) {
    upcomingTripCount += count;
  } else {
    flownMiles += totalMi;
    flownSegments += totalSegs;
    pastTripCount += count;
  }

  const routeText = trip.legs.map((leg) => leg.join(" → ")).join("   …   ");
  const li = document.createElement("li");
  const countBadge = count > 1 ? ` <span class="badge">×${count}</span>` : "";
  const upcomingBadge = upcoming ? ` <span class="badge upcoming">upcoming</span>` : "";
  li.innerHTML = `
    <div class="route">${trip.label}${countBadge}${upcomingBadge}</div>
    <div class="path">${routeText}</div>
    <div class="meta">${totalSegs} segment${totalSegs === 1 ? "" : "s"} · ${Math.round(totalMi).toLocaleString()} mi</div>
  `;
  if (upcoming) li.classList.add("upcoming");
  tripList.appendChild(li);
});

allAirports.forEach((code) => {
  const a = AIRPORTS[code];
  const isPast = pastAirports.has(code);
  L.marker([a.lat, a.lon], { icon: airportMarkerIcon(isPast ? PAST_COLOR : UPCOMING_COLOR) })
    .addTo(map)
    .bindPopup(`<strong>${code}</strong><br>${a.name}<br>${a.city}${isPast ? "" : "<br><em>upcoming</em>"}`);
});

if (allLatLngs.length > 0) {
  map.fitBounds(L.latLngBounds(allLatLngs).pad(0.15));
}

document.getElementById("stat-flights").textContent = flownSegments;
document.getElementById("stat-trips").textContent = pastTripCount;
document.getElementById("stat-airports").textContent = pastAirports.size;
document.getElementById("stat-miles").textContent = Math.round(flownMiles).toLocaleString();
document.getElementById("stat-upcoming").textContent = upcomingTripCount;
