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

const map = L.map("map", { worldCopyJump: true }).setView([30, -70], 4);

L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  subdomains: "abcd",
  maxZoom: 19,
}).addTo(map);

const airportIcon = L.divIcon({
  className: "airport-marker",
  html: '<div style="width:10px;height:10px;background:#38bdf8;border:2px solid #0f172a;border-radius:50%;box-shadow:0 0 6px #38bdf8;"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const visitedAirports = new Set();
const allLatLngs = [];
let totalMiles = 0;
let totalSegments = 0;

const tripList = document.getElementById("trip-list");

FLIGHTS.forEach((flight, idx) => {
  const from = AIRPORTS[flight.from];
  const to = AIRPORTS[flight.to];
  if (!from || !to) {
    console.warn(`Missing airport for flight ${flight.from} -> ${flight.to}`);
    return;
  }

  const segments = flight.roundTrip ? 2 : 1;
  const miles = haversineMiles(from, to) * segments;
  totalSegments += segments;
  totalMiles += miles;
  visitedAirports.add(flight.from);
  visitedAirports.add(flight.to);

  const path = greatCirclePoints(from, to);
  L.polyline(path, {
    color: "#38bdf8",
    weight: 2,
    opacity: 0.85,
  }).addTo(map).bindTooltip(
    `${flight.from} &harr; ${flight.to}<br>${Math.round(miles).toLocaleString()} mi${flight.roundTrip ? " (round trip)" : ""}`
  );
  allLatLngs.push(...path);

  const li = document.createElement("li");
  li.innerHTML = `
    <div class="route">${flight.from} &rarr; ${flight.to}${flight.roundTrip ? '<span class="badge">RT</span>' : ""}</div>
    <div class="meta">${from.city} &mdash; ${to.city}<br>${Math.round(miles).toLocaleString()} mi total</div>
  `;
  tripList.appendChild(li);
});

visitedAirports.forEach((code) => {
  const a = AIRPORTS[code];
  L.marker([a.lat, a.lon], { icon: airportIcon })
    .addTo(map)
    .bindPopup(`<strong>${code}</strong><br>${a.name}<br>${a.city}`);
});

if (allLatLngs.length > 0) {
  map.fitBounds(L.latLngBounds(allLatLngs).pad(0.15));
}

document.getElementById("stat-flights").textContent = totalSegments;
document.getElementById("stat-trips").textContent = FLIGHTS.length;
document.getElementById("stat-airports").textContent = visitedAirports.size;
document.getElementById("stat-miles").textContent = Math.round(totalMiles).toLocaleString();
