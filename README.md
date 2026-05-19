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
- Add a trip to `FLIGHTS`. Set `roundTrip: true` to count both legs.

```js
FLIGHTS.push({ from: "JFK", to: "LAX", roundTrip: false });
```

## Stack

- [Leaflet](https://leafletjs.com/) for the map (no API key needed)
- [CARTO dark basemap](https://carto.com/) tiles
- Plain HTML/CSS/JS — no build step
