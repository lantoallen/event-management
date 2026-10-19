// A Google Maps search for the venue. No API key needed, and on phones it
// opens the Maps app.
export const mapsUrl = (location: string, city: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${location}, ${city}`)}`;
