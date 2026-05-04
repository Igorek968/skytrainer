<script setup>
import { ref, computed, onBeforeUnmount, watch } from "vue";
import { apiJson } from "../api/http.js";
import { useAuth } from "../composables/useAuth.js";

const { user, isClient, isInstructor } = useAuth();

const bookings = ref([]);
const bookingId = ref("");
const points = ref([]);
const error = ref("");
const info = ref("");
let pollTimer = null;
let geoWatch = null;
let lastSent = 0;

let map = null;
let layerClient = null;
let layerInst = null;
const mapEl = ref(null);

const stats = ref({ distanceKm: 0, maxSpeed: 0, lastAlt: null });
const lastGeoPoint = ref(null);

function haversineKm(a, b) {
  const R = 6371;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

async function loadBookings() {
  if (!user.value) return;
  try {
    bookings.value = await apiJson("/booking/mine");
    const active = bookings.value.filter((b) => b.status === "active");
    if (!bookingId.value && active.length === 1) bookingId.value = active[0].id;
  } catch {
    bookings.value = [];
  }
}

const activeBooking = computed(() => bookings.value.find((b) => b.id === bookingId.value));

watch(
  user,
  () => {
    loadBookings();
  },
  { immediate: true }
);

function ensureMap() {
  const key = import.meta.env.VITE_YANDEX_MAPS_API_KEY;
  if (!key || !window.ymaps || !mapEl.value || map) return;
  map = new window.ymaps.Map(mapEl.value, {
    center: [43.677, 40.205],
    zoom: 14,
    controls: ["zoomControl"]
  });
}

async function pollLatest() {
  if (!bookingId.value) return;
  try {
    points.value = await apiJson(`/tracking/${bookingId.value}/latest`);
    updateMapMarkers();
  } catch {
    /* inactive */
  }
}

function updateMapMarkers() {
  ensureMap();
  if (!map || !window.ymaps) return;
  if (layerClient) {
    map.geoObjects.remove(layerClient);
    layerClient = null;
  }
  if (layerInst) {
    map.geoObjects.remove(layerInst);
    layerInst = null;
  }
  const clientP = points.value.find((p) => p.userId !== activeBooking.value?.instructor_user_id);
  const instP = points.value.find((p) => p.userId === activeBooking.value?.instructor_user_id);
  /* API returns userId for both — compare with booking */
  const b = activeBooking.value;
  if (!b) return;
  const cPoint = points.value.find((p) => p.userId === b.client_id);
  const iPoint = points.value.find((p) => p.userId === b.instructor_user_id);
  if (cPoint) {
    layerClient = new window.ymaps.Placemark(
      [cPoint.latitude, cPoint.longitude],
      { iconCaption: "Клиент" },
      { preset: "islands#darkBlueCircleDotIcon" }
    );
    map.geoObjects.add(layerClient);
  }
  if (iPoint) {
    layerInst = new window.ymaps.Placemark(
      [iPoint.latitude, iPoint.longitude],
      { iconCaption: "Инструктор" },
      { preset: "islands#greenCircleDotIcon" }
    );
    map.geoObjects.add(layerInst);
  }
  if (cPoint && iPoint) {
    map.setBounds(
      window.ymaps.util.bounds.fromPoints([
        [cPoint.latitude, cPoint.longitude],
        [iPoint.latitude, iPoint.longitude]
      ]),
      { checkZoomRange: true, zoomMargin: 28 }
    );
  } else if (cPoint) map.setCenter([cPoint.latitude, cPoint.longitude], 14);
  else if (iPoint) map.setCenter([iPoint.latitude, iPoint.longitude], 14);
}

function attachPoll() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(pollLatest, 3000);
  pollLatest();
}

watch(bookingId, () => {
  if (bookingId.value) attachPoll();
});

watch(activeBooking, () => {
  if (bookingId.value) attachPoll();
});

function loadYmaps() {
  return new Promise((resolve, reject) => {
    if (window.ymaps) {
      window.ymaps.ready(resolve);
      return;
    }
    const key = import.meta.env.VITE_YANDEX_MAPS_API_KEY;
    if (!key) {
      reject(new Error("Нет ключа карты"));
      return;
    }
    const s = document.createElement("script");
    s.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(key)}&lang=ru_RU`;
    s.onload = () => window.ymaps.ready(resolve);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function startTrackingUi() {
  error.value = "";
  try {
    await loadYmaps();
    ensureMap();
  } catch (e) {
    error.value = e.message || String(e);
  }

  if (!bookingId.value || !activeBooking.value || activeBooking.value.status !== "active") {
    error.value = "Выберите активное бронирование.";
    return;
  }

  if (!navigator.geolocation) {
    error.value = "Геолокация недоступна в браузере.";
    return;
  }

  geoWatch = navigator.geolocation.watchPosition(
    async (pos) => {
      const now = Date.now();
      if (now - lastSent < 9500) return;
      lastSent = now;
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      const speed = pos.coords.speed != null ? pos.coords.speed : undefined;
      const alt = pos.coords.altitude != null ? pos.coords.altitude : undefined;
      try {
        await apiJson(`/tracking/${bookingId.value}`, {
          method: "POST",
          body: JSON.stringify({
            latitude: lat,
            longitude: lon,
            speed: speed ?? undefined,
            altitude: alt ?? undefined,
            recordedAt: new Date().toISOString()
          })
        });
        const prev = lastGeoPoint.value;
        if (prev) {
          stats.value.distanceKm += haversineKm(prev, { lat, lon });
        }
        lastGeoPoint.value = { lat, lon };
        if (speed != null && speed > stats.value.maxSpeed) stats.value.maxSpeed = speed;
        if (alt != null) stats.value.lastAlt = alt;
      } catch (e) {
        /* throttle 429 */
      }
      pollLatest();
    },
    (err) => {
      error.value = err.message || "Геолокация";
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
  );
  attachPoll();
  info.value = "Трекинг: точки отправляются не чаще раз в 10 секунд (лимит API).";
}

function stopTrackingUi() {
  if (geoWatch != null) {
    navigator.geolocation.clearWatch(geoWatch);
    geoWatch = null;
  }
  info.value = "";
}

async function instructorStart() {
  error.value = "";
  try {
    await apiJson(`/booking/${bookingId.value}/start`, { method: "PATCH" });
    await loadBookings();
    info.value = "Занятие начато. Включите трекинг у себя и у клиента.";
  } catch (e) {
    error.value = e.message || String(e);
  }
}

async function instructorComplete() {
  error.value = "";
  try {
    await apiJson(`/booking/${bookingId.value}/complete`, { method: "PATCH" });
    stopTrackingUi();
    await loadBookings();
    info.value = "Занятие завершено.";
  } catch (e) {
    error.value = e.message || String(e);
  }
}

onBeforeUnmount(() => {
  stopTrackingUi();
  if (pollTimer) clearInterval(pollTimer);
  if (map) {
    map.destroy();
    map = null;
  }
});

const selectableBookings = computed(() =>
  bookings.value.filter((b) => ["paid", "confirmed", "active"].includes(b.status))
);
</script>

<template>
  <div class="lesson">
    <section class="drive-panel block">
      <h3 class="title">Трекинг занятия</h3>
      <p class="drive-muted">
        На активном бронировании клиент и инструктор видят две точки на карте. Скорость и высота берутся из
        геолокации браузера.
      </p>

      <label class="row">
        <span class="drive-label">Бронирование</span>
        <select v-model="bookingId" class="drive-select" @change="loadBookings">
          <option value="">— выберите —</option>
          <option v-for="b in selectableBookings" :key="b.id" :value="b.id">
            {{ b.id.slice(0, 8) }}… · {{ new Date(b.start_at).toLocaleString("ru-RU") }} · {{ b.status }}
          </option>
        </select>
      </label>

      <div class="stats drive-panel inner">
        <div>Пройдено: <strong>{{ stats.distanceKm.toFixed(2) }}</strong> км</div>
        <div>
          Макс. скорость:
          <strong>{{ stats.maxSpeed >= 0 ? (stats.maxSpeed * 3.6).toFixed(1) + " км/ч" : "—" }}</strong>
        </div>
        <div>Высота: <strong>{{ stats.lastAlt != null ? stats.lastAlt.toFixed(0) + " м" : "—" }}</strong></div>
      </div>

      <div v-if="isInstructor" class="inst-actions">
        <button type="button" class="drive-btn drive-btn--ghost" @click="instructorStart">Начать занятие</button>
        <button type="button" class="drive-btn drive-btn--primary" @click="instructorComplete">Завершить занятие</button>
      </div>

      <div v-if="user && activeBooking?.status === 'active'" class="client-actions">
        <button type="button" class="drive-btn drive-btn--primary" @click="startTrackingUi">Включить отправку геолокации</button>
        <button type="button" class="drive-btn drive-btn--ghost" @click="stopTrackingUi">Остановить</button>
      </div>

      <p v-if="error" class="err">{{ error }}</p>
      <p v-if="info" class="drive-muted">{{ info }}</p>
    </section>

    <div ref="mapEl" class="map drive-panel" />
  </div>
</template>

<style scoped>
.lesson {
  display: grid;
  gap: 16px;
  max-width: 960px;
}

.block {
  padding: 20px;
}

.title {
  margin: 0 0 8px;
}

.row {
  display: block;
  margin-top: 16px;
  max-width: 480px;
}

.inner {
  margin-top: 16px;
  padding: 14px;
  display: grid;
  gap: 8px;
  font-size: 14px;
}

.inst-actions,
.client-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 16px;
}

.err {
  color: #b91c1c;
  margin-top: 12px;
}

.map {
  height: 420px;
  min-height: 280px;
  overflow: hidden;
}
</style>
