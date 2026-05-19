# Flight Dashboard

A simple interactive map of flights I've taken.

## Usage

Open `index.html` in a browser, or serve it locally:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Adding flights

Edit `flights.js`:

- Add an airport to `AIRPORTS` if it isn't already there (use the IATA code as the key).
- Add a trip to `TRIPS`. Each trip has one or more `legs`; a leg is a chain
  of airports flown without a non-flight break.

```js
// Round trip, nonstop
{ legs: [["JFK", "LAX", "JFK"]], label: "LA trip" }

// One-way with a layover
{ legs: [["BOS", "ORD", "SEA"]], label: "Seattle move" }

// Round trip with different connections each way
{ legs: [["LGA", "DCA", "GSP", "CLT", "LGA"]], label: "DCA out, CLT back" }

// Open-jaw: fly into Paris, train to Amsterdam, fly home from Amsterdam
{ legs: [["GSP", "IAD", "CDG"], ["AMS", "IAD", "GSP"]], label: "Europe" }
```

## Stack

- [Leaflet](https://leafletjs.com/) for the map (no API key needed)
- [CARTO dark basemap](https://carto.com/) tiles
- Plain HTML/CSS/JS — no build step
