const NOMINATIM_USER_AGENT =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL != null && process.env.NEXT_PUBLIC_SUPPORT_EMAIL !== ""
    ? `SkyTrainer/1.0 (${process.env.NEXT_PUBLIC_SUPPORT_EMAIL})`
    : "SkyTrainer/1.0 (ski instructor booking)";

const NOMINATIM_HEADERS = {
  "User-Agent": NOMINATIM_USER_AGENT,
  Accept: "application/json",
  "Accept-Language": "ru",
} as const;

type NominatimAddressParts = {
  house_number?: string;
  road?: string;
  pedestrian?: string;
  suburb?: string;
  neighbourhood?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  state?: string;
};

export function parseNominatimAddressParts(
  address?: NominatimAddressParts | null,
): { city: string; street: string; house: string } {
  const street = (address?.road ?? address?.pedestrian ?? "").trim();
  const house = address?.house_number?.trim() ?? "";
  const city = (
    address?.city ??
    address?.town ??
    address?.village ??
    address?.municipality ??
    address?.suburb ??
    address?.neighbourhood ??
    ""
  ).trim();
  return { city, street, house };
}

/** Короткий адрес для поля «Место встречи» (улица, дом, город). */
export function formatRussianMeetAddress(
  displayName: string,
  address?: NominatimAddressParts | null,
): string {
  if (!address) return displayName;

  const street = address.road ?? address.pedestrian;
  const house = address.house_number?.trim();
  const streetLine = [street, house ? `д ${house}` : null].filter(Boolean).join(", ");

  const place =
    address.city ??
    address.town ??
    address.village ??
    address.municipality ??
    address.suburb ??
    address.neighbourhood;

  const parts = [streetLine, place, address.state].filter((p) => p && p.length > 0);
  const short = parts.join(", ");
  return short.length > 0 ? short : displayName;
}

export async function nominatimSearch(
  query: string,
  tryRussiaSuffix = true,
): Promise<{ lat: number; lng: number; displayName: string } | null> {
  const q = query.trim();
  const nominatimUrl = new URL("https://nominatim.openstreetmap.org/search");
  nominatimUrl.searchParams.set("format", "json");
  nominatimUrl.searchParams.set("q", q);
  nominatimUrl.searchParams.set("limit", "1");
  nominatimUrl.searchParams.set("addressdetails", "1");
  nominatimUrl.searchParams.set("countrycodes", "ru");

  const res = await fetch(nominatimUrl, { headers: NOMINATIM_HEADERS, cache: "no-store" });
  if (!res.ok) return null;

  const results: unknown = await res.json();
  if (!Array.isArray(results) || results.length === 0) {
    if (tryRussiaSuffix && !/росси/i.test(q)) {
      return nominatimSearch(`${q}, Россия`, false);
    }
    return null;
  }

  const hit = results[0] as {
    lat?: string;
    lon?: string;
    display_name?: string;
    address?: NominatimAddressParts;
  };
  const lat = Number(hit.lat);
  const lng = Number(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const displayName =
    typeof hit.display_name === "string"
      ? formatRussianMeetAddress(hit.display_name, hit.address ?? null)
      : q;

  return { lat, lng, displayName };
}

export type NominatimReverseResult = {
  city: string;
  street: string;
  house: string;
  displayName: string;
};

export async function nominatimReverseWithParts(
  lat: number,
  lng: number,
): Promise<NominatimReverseResult | null> {
  const nominatimUrl = new URL("https://nominatim.openstreetmap.org/reverse");
  nominatimUrl.searchParams.set("format", "json");
  nominatimUrl.searchParams.set("lat", String(lat));
  nominatimUrl.searchParams.set("lon", String(lng));
  nominatimUrl.searchParams.set("zoom", "18");
  nominatimUrl.searchParams.set("addressdetails", "1");

  const res = await fetch(nominatimUrl, { headers: NOMINATIM_HEADERS, cache: "no-store" });
  if (!res.ok) return null;

  const hit = (await res.json()) as { display_name?: string; address?: NominatimAddressParts };
  const displayName = typeof hit.display_name === "string" ? hit.display_name.trim() : "";
  if (displayName.length === 0) return null;

  const parts = parseNominatimAddressParts(hit.address ?? null);
  return {
    ...parts,
    displayName: formatRussianMeetAddress(displayName, hit.address ?? null),
  };
}
