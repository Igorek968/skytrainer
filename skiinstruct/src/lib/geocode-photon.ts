/** Photon (Komoot) — запасной геокодер, если Nominatim недоступен. */

type PhotonResponse = {
  features?: Array<{
    geometry?: { coordinates?: [number, number] };
    properties?: {
      name?: string;
      street?: string;
      housenumber?: string;
      city?: string;
      town?: string;
      village?: string;
      state?: string;
      country?: string;
      countrycode?: string;
    };
  }>;
};

function formatPhotonAddress(props: NonNullable<PhotonResponse["features"]>[number]["properties"]): string {
  if (!props) return "";
  const streetLine = [props.street ?? props.name, props.housenumber ? `д ${props.housenumber}` : null]
    .filter(Boolean)
    .join(", ");
  const place = props.city ?? props.town ?? props.village;
  const parts = [streetLine, place, props.state, props.country].filter((p) => p && String(p).length > 0);
  return parts.join(", ");
}

export async function photonGeocodeSearch(
  query: string,
  tryRussiaSuffix = true,
): Promise<{ lat: number; lng: number; displayName: string } | null> {
  const q = query.trim();
  if (q.length < 2) return null;

  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "1");
  url.searchParams.set("lang", "default");
  // Ограничение bbox примерно по территории РФ
  url.searchParams.set("bbox", "19.0,41.0,180.0,82.0");

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) return null;

  const data = (await res.json()) as PhotonResponse;
  const feature = data.features?.[0];
  const coords = feature?.geometry?.coordinates;

  if (!coords || coords.length < 2) {
    if (tryRussiaSuffix && !/росси/i.test(q)) {
      return photonGeocodeSearch(`${q}, Россия`, false);
    }
    return null;
  }

  const countryCode = feature?.properties?.countrycode;
  const isRussia = countryCode === "RU" || /росси/i.test(String(feature?.properties?.country ?? ""));

  if (!isRussia) {
    if (tryRussiaSuffix && !/росси/i.test(q)) {
      return photonGeocodeSearch(`${q}, Россия`, false);
    }
    return null;
  }

  const [lng, lat] = coords;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const formatted = formatPhotonAddress(feature.properties);
  const displayName = formatted.length > 0 ? formatted : q;

  return { lat, lng, displayName };
}
