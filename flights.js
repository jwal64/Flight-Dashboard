// Airport database: IATA code -> { name, city, lat, lon }
const AIRPORTS = {
  HPN: { name: "Westchester County Airport", city: "White Plains, NY", lat: 41.0670, lon: -73.7076 },
  FLL: { name: "Fort Lauderdale-Hollywood Intl", city: "Fort Lauderdale, FL", lat: 26.0742, lon: -80.1506 },
  EWR: { name: "Newark Liberty Intl", city: "Newark, NJ", lat: 40.6925, lon: -74.1687 },
  PUJ: { name: "Punta Cana Intl", city: "Punta Cana, DR", lat: 18.5674, lon: -68.3634 },
  CUN: { name: "Cancún Intl", city: "Cancún, MX", lat: 21.0365, lon: -86.8771 },
  LGA: { name: "LaGuardia", city: "New York, NY", lat: 40.7769, lon: -73.8740 },
  GSP: { name: "Greenville-Spartanburg Intl", city: "Greer, SC", lat: 34.8957, lon: -82.2189 },
  DCA: { name: "Reagan National", city: "Washington, DC", lat: 38.8512, lon: -77.0402 },
  CLT: { name: "Charlotte Douglas Intl", city: "Charlotte, NC", lat: 35.2140, lon: -80.9431 },
  PHL: { name: "Philadelphia Intl", city: "Philadelphia, PA", lat: 39.8744, lon: -75.2424 },
  IAD: { name: "Washington Dulles Intl", city: "Dulles, VA", lat: 38.9531, lon: -77.4565 },
  AMS: { name: "Amsterdam Schiphol", city: "Amsterdam, NL", lat: 52.3086, lon: 4.7639 },
  CDG: { name: "Paris Charles de Gaulle", city: "Paris, FR", lat: 49.0097, lon: 2.5479 },
  JFK: { name: "John F. Kennedy Intl", city: "New York, NY", lat: 40.6413, lon: -73.7781 },
  PMO: { name: "Palermo Falcone-Borsellino", city: "Palermo, IT", lat: 38.1810, lon: 13.0991 },
  FCO: { name: "Rome Fiumicino", city: "Rome, IT", lat: 41.8003, lon: 12.2389 },
  BCN: { name: "Barcelona-El Prat", city: "Barcelona, ES", lat: 41.2974, lon: 2.0833 },
  VCE: { name: "Venice Marco Polo", city: "Venice, IT", lat: 45.5053, lon: 12.3519 },
  LIS: { name: "Lisbon Humberto Delgado", city: "Lisbon, PT", lat: 38.7813, lon: -9.1359 },
  RAK: { name: "Marrakesh Menara", city: "Marrakesh, MA", lat: 31.6069, lon: -8.0363 },
  MXP: { name: "Milan Malpensa", city: "Milan, IT", lat: 45.6306, lon: 8.7281 },
  BLQ: { name: "Bologna Guglielmo Marconi", city: "Bologna, IT", lat: 44.5354, lon: 11.2887 },
  NCE: { name: "Nice Côte d'Azur", city: "Nice, FR", lat: 43.6584, lon: 7.2159 },
  FAO: { name: "Faro", city: "Faro, PT", lat: 37.0144, lon: -7.9659 },
  SJU: { name: "San Juan Luis Muñoz Marín", city: "San Juan, PR", lat: 18.4394, lon: -66.0018 },
  NAP: { name: "Naples Intl", city: "Naples, IT", lat: 40.8860, lon: 14.2908 },
};

// Each trip has one or more "legs". A leg is a sequence of airports flown
// without a non-flight break. Optional fields:
//   count: integer, default 1 — multiply stats for repeated identical trips
//   upcoming: true — mark as planned (dashed line, excluded from flown stats)
const TRIPS = [
  { legs: [["HPN", "FLL", "HPN"]], label: "Fort Lauderdale" },
  { legs: [["EWR", "PUJ", "EWR"]], label: "Punta Cana" },
  { legs: [["EWR", "CUN", "EWR"]], label: "Cancún" },
  { legs: [["LGA", "GSP", "LGA"]], label: "GSP — direct" },
  { legs: [["LGA", "DCA", "CLT", "GSP", "CLT", "DCA", "LGA"]], label: "GSP — via DCA + CLT both ways" },
  { legs: [["LGA", "DCA", "GSP", "CLT", "LGA"]], label: "GSP — DCA out, CLT back" },
  { legs: [["GSP", "PHL", "LGA"]], label: "GSP → LGA via PHL (one-way)" },
  { legs: [["LGA", "CLT", "LGA"]], label: "Charlotte" },
  { legs: [["GSP", "IAD", "AMS", "IAD", "GSP"]], label: "Amsterdam — via IAD" },
  {
    legs: [
      ["GSP", "IAD", "CDG"],
      ["AMS", "IAD", "GSP"],
    ],
    label: "Paris & Amsterdam — open-jaw via IAD",
  },
  { legs: [["GSP", "FLL", "GSP"]], label: "GSP ↔ Fort Lauderdale" },
  { legs: [["JFK", "AMS", "JFK"]], label: "JFK ↔ Amsterdam", count: 3 },
  { legs: [["JFK", "FCO", "PMO"]], label: "JFK → Palermo via Rome (one-way)" },
  { legs: [["JFK", "BCN", "JFK"]], label: "JFK ↔ Barcelona" },
  { legs: [["BCN", "VCE", "BCN"]], label: "Barcelona ↔ Venice" },
  { legs: [["BCN", "LIS", "BCN"]], label: "Barcelona ↔ Lisbon" },
  { legs: [["BCN", "RAK", "BCN"]], label: "Barcelona ↔ Marrakesh" },
  { legs: [["BCN", "MXP", "BCN"]], label: "Barcelona ↔ Milan (MXP)" },
  {
    legs: [
      ["BCN", "BLQ"],
      ["FCO", "PMO", "BCN"],
    ],
    label: "Bologna → (ground to Rome) → Palermo → Barcelona",
  },
  { legs: [["BCN", "NCE"]], label: "Barcelona → Nice (one-way)" },
  { legs: [["AMS", "BCN"]], label: "Amsterdam → Barcelona (one-way)" },
  { legs: [["BCN", "FAO"]], label: "Barcelona → Faro (one-way)" },
  { legs: [["FAO", "AMS"]], label: "Faro → Amsterdam (one-way)" },
  { legs: [["HPN", "SJU", "HPN"]], label: "HPN ↔ San Juan", upcoming: true },
  { legs: [["JFK", "NAP", "JFK"]], label: "JFK ↔ Naples", upcoming: true },
];
