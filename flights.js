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
};

// Each trip has one or more "legs". A leg is a sequence of airports flown
// without a non-flight break. Most trips have a single leg; open-jaw trips
// (fly into one city, out of another) have multiple.
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
];
