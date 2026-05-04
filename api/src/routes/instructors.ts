import { Router } from "express";
import { pool } from "../db/pool.js";
import { redis } from "../services/redis.js";

export const instructorsRouter = Router();

const CACHE_TTL_SEC = 50;

instructorsRouter.get("/", async (req, res) => {
  const resort = String(req.query.resort ?? "krasnaya");
  const minPrice = Number(req.query.minPrice ?? 500);
  const maxPrice = Number(req.query.maxPrice ?? 100000);
  const minRating = Number(req.query.minRating ?? 1);
  const lang = req.query.lang ? String(req.query.lang) : "";
  const lat = req.query.lat ? Number(req.query.lat) : null;
  const lng = req.query.lng ? Number(req.query.lng) : null;

  const cacheKey = `ins:v3:${resort}:${minPrice}:${maxPrice}:${minRating}:${lang}:${lat ?? "x"}:${lng ?? "x"}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    res.json(JSON.parse(cached));
    return;
  }

  const params: unknown[] = [resort, minPrice, maxPrice, minRating];
  let p = 5;
  let langClause = "";
  if (lang === "ru" || lang === "en") {
    langClause = `AND $${p} = ANY(i.languages)`;
    params.push(lang);
    p += 1;
  }

  let geoClause = `AND ST_DWithin(i.location, r.trail, 5000)`;
  if (lat !== null && lng !== null && !Number.isNaN(lat) && !Number.isNaN(lng)) {
    geoClause += ` AND ST_DWithin(i.location, ST_SetSRID(ST_MakePoint($${p}, $${p + 1}), 4326)::geography, 5000)`;
    params.push(lng, lat);
  }

  const sql = `
    SELECT
      i.user_id AS uid,
      i.display_name AS "displayName",
      i.photo_url AS "photoUrl",
      i.experience_years AS "experienceYears",
      i.certificates,
      i.hourly_rate AS "hourlyRate",
      i.avg_rating AS "rating",
      i.rating_count AS "totalOrders",
      i.availability AS "availabilityStatus",
      i.is_online AS "isOnline",
      i.languages,
      ST_Y(i.location::geometry) AS lat,
      ST_X(i.location::geometry) AS lng,
      i.priority_penalty AS "priorityPenalty"
    FROM instructors i
    JOIN resorts r ON r.slug = i.resort_slug
    WHERE i.resort_slug = $1
      AND i.hourly_rate >= $2
      AND i.hourly_rate <= $3
      AND i.avg_rating >= $4
      AND i.is_online = TRUE
      ${langClause}
      ${geoClause}
    ORDER BY i.priority_penalty ASC, i.avg_rating DESC, i.hourly_rate ASC
  `;

  const rows = await pool.query(sql, params);
  const mapped = rows.rows.map((row: Record<string, unknown>) => ({
    uid: row.uid,
    displayName: row.displayName,
    photoUrl: row.photoUrl,
    experienceYears: row.experienceYears,
    certificates: row.certificates,
    hourlyRate: Number(row.hourlyRate),
    rating: Number(row.rating),
    totalOrders: Number(row.totalOrders),
    availabilityStatus: row.availabilityStatus,
    isOnline: row.isOnline,
    languages: row.languages,
    currentLocation: {
      latitude: Number(row.lat),
      longitude: Number(row.lng)
    },
    isAvailable: row.availabilityStatus === "available_now",
    priorityPenalty: row.priorityPenalty
  }));

  await redis.setex(cacheKey, CACHE_TTL_SEC, JSON.stringify(mapped));
  res.json(mapped);
});
