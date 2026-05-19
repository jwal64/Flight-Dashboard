// Airport database: IATA code -> { name, city, lat, lon }
const AIRPORTS = {
  HPN: { name: "Westchester County Airport", city: "White Plains, NY", lat: 41.0670, lon: -73.7076 },
  FLL: { name: "Fort Lauderdale-Hollywood Intl", city: "Fort Lauderdale, FL", lat: 26.0742, lon: -80.1506 },
  EWR: { name: "Newark Liberty Intl", city: "Newark, NJ", lat: 40.6925, lon: -74.1687 },
  PUJ: { name: "Punta Cana Intl", city: "Punta Cana, DR", lat: 18.5674, lon: -68.3634 },
  CUN: { name: "Cancún Intl", city: "Cancún, MX", lat: 21.0365, lon: -86.8771 },
};

// Each entry is a trip. roundTrip: true draws one line but counts as 2 segments.
const FLIGHTS = [
  { from: "HPN", to: "FLL", roundTrip: true },
  { from: "EWR", to: "PUJ", roundTrip: true },
  { from: "EWR", to: "CUN", roundTrip: true },
];
