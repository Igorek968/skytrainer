<script setup>
import { ref, watch, onMounted, onBeforeUnmount, computed } from "vue";
import { apiJson } from "../api/http.js";
import { useAuth } from "../composables/useAuth.js";

const emit = defineEmits(["book"]);

const { user, isClient } = useAuth();

const RESORTS = [
  { slug: "krasnaya", label: "Красная Поляна", center: [43.677, 40.205], zoom: 13 },
  { slug: "sheregesh", label: "Шерегеш", center: [52.921, 87.987], zoom: 12 },
  { slug: "dombay", label: "Домбай", center: [43.293, 41.623], zoom: 12 }
];

const resortSlug = ref("krasnaya");
const minPrice = ref(1000);
const maxPrice = ref(10000);
const minRating = ref(1);
const langFilter = ref("");

const instructors = ref([]);
const loading = ref(false);
const error = ref("");
const selected = ref(null);
const favoriteBusy = ref(false);

let map = null;
let clusterer = null;
const mapContainer = ref(null);

const yandexKey = computed(() => import.meta.env.VITE_YANDEX_MAPS_API_KEY || "");

function markerColor(status) {
  if (status === "available_now") return "#22c55e";
  if (status === "available_later") return "#2563eb";
  return "#9ca3af";
}

async function loadInstructors() {
  loading.value = true;
  error.value = "";
  try {
    let mn = minPrice.value;
    let mx = maxPrice.value;
    if (mn > mx) [mn, mx] = [mx, mn];
    const params = new URLSearchParams({
      resort: resortSlug.value,
      minPrice: String(mn),
      maxPrice: String(mx),
      minRating: String(minRating.value)
    });
    if (langFilter.value) params.set("lang", langFilter.value);
    instructors.value = await apiJson(`/instructors/?${params}`);
    redrawMarkers();
  } catch (e) {
    error.value = e.message || String(e);
    instructors.value = [];
  } finally {
    loading.value = false;
  }
}

function loadScript() {
  return new Promise((resolve, reject) => {
    if (window.ymaps) {
      window.ymaps.ready(resolve);
      return;
    }
    const key = yandexKey.value;
    if (!key) {
      reject(new Error("Задайте VITE_YANDEX_MAPS_API_KEY"));
      return;
    }
    const s = document.createElement("script");
    s.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(key)}&lang=ru_RU`;
    s.async = true;
    s.onload = () => window.ymaps.ready(resolve);
    s.onerror = () => reject(new Error("Не удалось загрузить Яндекс.Карты"));
    document.head.appendChild(s);
  });
}

function redrawMarkers() {
  if (!map || !window.ymaps || !clusterer) return;
  clusterer.removeAll();
  for (const ins of instructors.value) {
    const lat = ins.currentLocation?.latitude;
    const lng = ins.currentLocation?.longitude;
    if (lat == null || lng == null) continue;
    const preset = markerColor(ins.availabilityStatus);
    const placemark = new window.ymaps.Placemark(
      [lat, lng],
      {
        balloonContentHeader: ins.displayName,
        balloonContentBody: `${ins.hourlyRate} ₽/ч · ★ ${Number(ins.rating).toFixed(2)}`,
        hintContent: ins.displayName
      },
      {
        iconColor: preset
      }
    );
    placemark.events.add("click", () => {
      selected.value = ins;
    });
    clusterer.add(placemark);
  }
}

async function initMap() {
  try {
    await loadScript();
  } catch (e) {
    error.value = e.message || String(e);
    return;
  }
  const r = RESORTS.find((x) => x.slug === resortSlug.value) || RESORTS[0];
  map = new window.ymaps.Map(mapContainer.value, {
    center: r.center,
    zoom: r.zoom,
    controls: ["zoomControl", "fullscreenControl"]
  });
  clusterer = new window.ymaps.Clusterer({ preset: "islands#grayClusterIcons", groupByCoordinates: false });
  map.geoObjects.add(clusterer);
  map.events.add("click", () => {
    selected.value = null;
  });
  redrawMarkers();
}

function flyToResort() {
  const r = RESORTS.find((x) => x.slug === resortSlug.value);
  if (map && r) map.setCenter(r.center, r.zoom, { duration: 300 });
}

watch(resortSlug, () => {
  flyToResort();
  loadInstructors();
});

watch([minPrice, maxPrice, minRating, langFilter], () => {
  loadInstructors();
});

onMounted(async () => {
  await initMap();
  await loadInstructors();
});

onBeforeUnmount(() => {
  if (map) {
    map.destroy();
    map = null;
    clusterer = null;
  }
});

function openBooking() {
  if (!selected.value) return;
  emit("book", { instructor: selected.value, resort: resortSlug.value });
  selected.value = null;
}

async function toggleFavorite() {
  if (!isClient.value || !selected.value?.uid) return;
  favoriteBusy.value = true;
  try {
    await apiJson("/client/favorites", {
      method: "POST",
      body: JSON.stringify({ instructorUserId: selected.value.uid })
    });
  } catch {
    /* duplicate OK */
  } finally {
    favoriteBusy.value = false;
  }
}

const certsText = computed(() => {
  const c = selected.value?.certificates;
  if (!Array.isArray(c)) return "";
  return c.join(", ");
});
</script>

<template>
  <div class="map-layout drive-panel">
    <div class="map-toolbar">
      <div class="drive-chips">
        <button
          v-for="r in RESORTS"
          :key="r.slug"
          type="button"
          class="drive-chip"
          :class="{ 'is-active': resortSlug === r.slug }"
          @click="resortSlug = r.slug"
        >
          {{ r.label }}
        </button>
      </div>
      <div class="filters">
        <label class="filter-block">
          <span class="drive-label">Цена, ₽/ч</span>
          <div class="dual-range">
            <input v-model.number="minPrice" type="range" min="1000" max="10000" step="100" />
            <input v-model.number="maxPrice" type="range" min="1000" max="10000" step="100" />
          </div>
          <span class="drive-muted">{{ minPrice }}–{{ maxPrice }}</span>
        </label>
        <label class="filter-block">
          <span class="drive-label">Рейтинг от</span>
          <input v-model.number="minRating" class="drive-input" type="range" min="1" max="5" step="0.5" />
          <span class="drive-muted">★ {{ minRating }}</span>
        </label>
        <label class="filter-block">
          <span class="drive-label">Язык</span>
          <select v-model="langFilter" class="drive-select narrow">
            <option value="">Любой</option>
            <option value="ru">Русский</option>
            <option value="en">English</option>
          </select>
        </label>
      </div>
      <div class="legend">
        <span><i class="dot green" /> свободен сейчас</span>
        <span><i class="dot blue" /> через час</span>
        <span><i class="dot gray" /> занят</span>
      </div>
    </div>
    <div ref="mapContainer" class="map-canvas" />
    <p v-if="loading" class="drive-muted map-status">Загрузка инструкторов…</p>
    <p v-if="error && !loading" class="map-status map-error">{{ error }}</p>

    <Teleport to="body">
      <div v-if="selected" class="sheet-overlay" @click.self="selected = null">
        <div class="sheet drive-panel">
          <button type="button" class="sheet-close" aria-label="Закрыть" @click="selected = null">×</button>
          <div class="sheet-head">
            <img :src="selected.photoUrl || 'https://i.pravatar.cc/120'" alt="" class="sheet-photo" />
            <div>
              <h2 class="sheet-title">{{ selected.displayName }}</h2>
              <p class="drive-muted">
                Стаж {{ selected.experienceYears }} лет · ★ {{ Number(selected.rating).toFixed(2) }} ·
                {{ selected.hourlyRate }} ₽/ч
              </p>
              <p v-if="certsText" class="certs">Сертификаты: {{ certsText }}</p>
              <p class="drive-muted langs">
                Языки: {{ (selected.languages || []).join(", ") }}
              </p>
            </div>
          </div>
          <div class="sheet-actions">
            <button v-if="isClient" type="button" class="drive-btn drive-btn--ghost" @click="toggleFavorite">
              {{ favoriteBusy ? "…" : "В избранное" }}
            </button>
            <button type="button" class="drive-btn drive-btn--primary" @click="openBooking">Забронировать</button>
          </div>
          <p v-if="!user" class="drive-muted sheet-hint">Войдите как клиент в разделе «Профиль», чтобы бронировать.</p>
          <p v-else-if="user.role !== 'client'" class="drive-muted sheet-hint">
            Бронирование доступно только клиентам.
          </p>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.map-layout {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 120px);
  min-height: 420px;
  overflow: hidden;
}

.map-toolbar {
  padding: 16px;
  border-bottom: 1px solid var(--drive-border);
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  margin-top: 14px;
  align-items: flex-end;
}

.filter-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 140px;
}

.dual-range {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.narrow {
  max-width: 160px;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 12px;
  font-size: 12px;
  color: var(--drive-muted);
}

.legend .dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 6px;
  vertical-align: middle;
}

.dot.green {
  background: #22c55e;
}
.dot.blue {
  background: #2563eb;
}
.dot.gray {
  background: #9ca3af;
}

.map-canvas {
  flex: 1;
  min-height: 280px;
}

.map-status {
  padding: 8px 16px;
  margin: 0;
}

.map-error {
  color: #b91c1c;
}

.sheet-overlay {
  position: fixed;
  inset: 0;
  background: rgba(22, 22, 23, 0.35);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 1000;
  padding: 24px;
}

.sheet {
  width: min(520px, 100%);
  padding: 24px;
  position: relative;
  animation: slideUp 0.22s ease;
}

@keyframes slideUp {
  from {
    transform: translateY(16px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.sheet-close {
  position: absolute;
  top: 12px;
  right: 12px;
  border: none;
  background: transparent;
  font-size: 22px;
  cursor: pointer;
  color: var(--drive-muted);
}

.sheet-head {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.sheet-photo {
  width: 96px;
  height: 96px;
  border-radius: 12px;
  object-fit: cover;
}

.sheet-title {
  margin: 0 0 8px;
  font-size: 20px;
}

.certs,
.langs {
  margin: 8px 0 0;
  font-size: 13px;
}

.sheet-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
  flex-wrap: wrap;
}

.sheet-hint {
  margin-top: 12px;
}
</style>
