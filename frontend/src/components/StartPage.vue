<script setup>
import { computed, onMounted, ref } from "vue";

const props = defineProps({
  isAuthenticated: {
    type: Boolean,
    default: false,
  },
  apiUrl: {
    type: String,
    default: "http://localhost:8000",
  },
});

const emit = defineEmits(["register", "login", "openProfile"]);

const locationStatus = ref("Определяем вашу геолокацию...");
const mapPoint = ref({ lat: 55.751244, lon: 37.618423 });
const targetPoint = ref(null);
const instructors = ref([]);
const instructorsLoading = ref(false);
const instructorsError = ref("");
const selectedInstructorEmail = ref("");
const agreementAccepted = ref(false);
const callStatus = ref("");
const mapContainer = ref(null);

let ymapsInstance = null;
let mapInstance = null;
let userPlacemark = null;
let targetPlacemark = null;
const instructorPlacemarks = [];

const selectedInstructor = computed(() =>
  instructors.value.find((item) => item.email === selectedInstructorEmail.value),
);
const displayName = (item) => item.name || item.email;

function ensureYandexMapsScript() {
  return new Promise((resolve, reject) => {
    if (window.ymaps) {
      resolve(window.ymaps);
      return;
    }
    const existing = document.querySelector('script[data-yandex-maps="true"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(window.ymaps), { once: true });
      existing.addEventListener("error", () => reject(new Error("Не удалось загрузить Яндекс.Карты.")), {
        once: true,
      });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://api-maps.yandex.ru/2.1/?lang=ru_RU";
    script.async = true;
    script.dataset.yandexMaps = "true";
    script.onload = () => resolve(window.ymaps);
    script.onerror = () => reject(new Error("Не удалось загрузить Яндекс.Карты."));
    document.head.appendChild(script);
  });
}

function updateTargetPointFromCoords(coords) {
  targetPoint.value = {
    lat: Number(coords[0].toFixed(6)),
    lon: Number(coords[1].toFixed(6)),
  };
  agreementAccepted.value = false;
  callStatus.value = "Точка скорректирована перетаскиванием на карте.";
}

function renderInstructorPlacemarks() {
  if (!mapInstance || !ymapsInstance) {
    return;
  }
  instructorPlacemarks.forEach((item) => mapInstance.geoObjects.remove(item));
  instructorPlacemarks.length = 0;

  instructors.value.slice(0, 8).forEach((item, index) => {
    const lat = mapPoint.value.lat + 0.006 * Math.sin(index + 1);
    const lon = mapPoint.value.lon + 0.01 * Math.cos(index + 1);
    const placemark = new ymapsInstance.Placemark(
      [lat, lon],
      {
        balloonContent: `<strong>${displayName(item)}</strong><br/>Рейтинг: ${item.rating}/5`,
      },
      {
        preset: "islands#greenDotIcon",
      },
    );
    placemark.events.add("click", () => {
      selectedInstructorEmail.value = item.email;
      agreementAccepted.value = false;
      callStatus.value = `Выбран инструктор: ${displayName(item)}.`;
    });
    instructorPlacemarks.push(placemark);
    mapInstance.geoObjects.add(placemark);
  });
}

function initMap() {
  if (!ymapsInstance || !mapContainer.value || mapInstance) {
    return;
  }
  mapInstance = new ymapsInstance.Map(mapContainer.value, {
    center: [mapPoint.value.lat, mapPoint.value.lon],
    zoom: 14,
    controls: ["zoomControl", "geolocationControl"],
  });

  userPlacemark = new ymapsInstance.Placemark(
    [mapPoint.value.lat, mapPoint.value.lon],
    {
      hintContent: "Ваше текущее положение",
    },
    {
      preset: "islands#blueDotIcon",
    },
  );
  mapInstance.geoObjects.add(userPlacemark);

  targetPlacemark = new ymapsInstance.Placemark(
    [mapPoint.value.lat, mapPoint.value.lon],
    {
      hintContent: "Точка вызова (перетащите)",
    },
    {
      preset: "islands#redDotIcon",
      draggable: true,
    },
  );
  targetPlacemark.events.add("dragend", () => {
    const coords = targetPlacemark.geometry.getCoordinates();
    updateTargetPointFromCoords(coords);
  });
  mapInstance.geoObjects.add(targetPlacemark);
  updateTargetPointFromCoords([mapPoint.value.lat, mapPoint.value.lon]);
  renderInstructorPlacemarks();
}

function refreshMapCenter() {
  if (!mapInstance || !userPlacemark || !targetPlacemark) {
    return;
  }
  const userCoords = [mapPoint.value.lat, mapPoint.value.lon];
  userPlacemark.geometry.setCoordinates(userCoords);
  targetPlacemark.geometry.setCoordinates(userCoords);
  mapInstance.setCenter(userCoords, 14, { duration: 200 });
  updateTargetPointFromCoords(userCoords);
}

async function loadFreeInstructors(apiUrl) {
  instructorsLoading.value = true;
  instructorsError.value = "";
  try {
    const response = await fetch(`${apiUrl}/instructors/free`);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.detail || "Не удалось загрузить свободных инструкторов.");
    }
    instructors.value = Array.isArray(body.instructors) ? body.instructors : [];
    if (
      selectedInstructorEmail.value &&
      !instructors.value.some((item) => item.email === selectedInstructorEmail.value)
    ) {
      selectedInstructorEmail.value = "";
    }
    renderInstructorPlacemarks();
  } catch (err) {
    instructorsError.value = err.message;
  } finally {
    instructorsLoading.value = false;
  }
}

function callInstructorToPoint() {
  if (!selectedInstructor.value || !targetPoint.value || !agreementAccepted.value) {
    return;
  }
  callStatus.value = `Инструктор ${displayName(selectedInstructor.value)} вызван в точку ${targetPoint.value.lat}, ${targetPoint.value.lon}.`;
}

onMounted(() => {
  ensureYandexMapsScript()
    .then((ymaps) => {
      ymapsInstance = ymaps;
      ymaps.ready(initMap);
    })
    .catch((err) => {
      instructorsError.value = err.message;
    });

  if (!("geolocation" in navigator)) {
    locationStatus.value = "Геолокация не поддерживается в этом браузере.";
    return loadFreeInstructors(props.apiUrl);
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      mapPoint.value = {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
      };
      locationStatus.value = `Ваша геолокация: ${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`;
      refreshMapCenter();
      renderInstructorPlacemarks();
      loadFreeInstructors(props.apiUrl);
    },
    () => {
      locationStatus.value = "Не удалось получить геолокацию. Показан центр Москвы.";
      refreshMapCenter();
      renderInstructorPlacemarks();
      loadFreeInstructors(props.apiUrl);
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    },
  );
});
</script>

<template>
  <section class="landing">
    <h2>Добро пожаловать в SkyTrainer</h2>
    <p>
      Выберите точку на карте, посмотрите свободных инструкторов и оформите предварительное согласие
      перед вызовом.
    </p>
    <div class="landing-actions">
      <template v-if="isAuthenticated">
        <button class="primary" @click="emit('openProfile')">В личный кабинет</button>
      </template>
      <template v-else>
        <button class="primary" @click="emit('register')">Начать регистрацию</button>
        <button class="ghost" @click="emit('login')">Войти</button>
      </template>
    </div>

    <div class="map-block">
      <p class="map-status">{{ locationStatus }}</p>
      <p v-if="instructorsLoading" class="map-status">Загрузка инструкторов...</p>
      <p v-else-if="instructorsError" class="error">{{ instructorsError }}</p>
      <div ref="mapContainer" class="map-frame" aria-label="Карта выбора точки"></div>
      <p class="legend">
        Синяя точка - вы, зеленые точки - свободные инструкторы, красная точка - место вызова.
        Перетащите красную точку для корректировки адреса. Нажмите на зеленую точку, чтобы выбрать
        инструктора.
      </p>
    </div>

    <div class="agreement-card" v-if="targetPoint && selectedInstructor">
      <h3>Предварительное согласие</h3>
      <p><strong>Инструктор:</strong> {{ displayName(selectedInstructor) }}</p>
      <p><strong>Контакт:</strong> {{ selectedInstructor.email }}</p>
      <p><strong>Навыки:</strong> {{ selectedInstructor.skills.join(", ") }}</p>
      <p><strong>Опыт:</strong> {{ selectedInstructor.experience_years }} лет</p>
      <p><strong>Пол:</strong> {{ selectedInstructor.gender }}</p>
      <p><strong>Лицензия:</strong> {{ selectedInstructor.has_license ? "Да" : "Нет" }}</p>
      <p><strong>Рейтинг:</strong> {{ selectedInstructor.rating }}/5</p>
      <p>
        <strong>Точка вызова:</strong>
        {{ targetPoint.lat }}, {{ targetPoint.lon }}
      </p>
      <label class="checkbox">
        <input v-model="agreementAccepted" type="checkbox" />
        Я подтверждаю предварительное согласие
      </label>
      <button class="primary" :disabled="!agreementAccepted" @click="callInstructorToPoint">
        Вызвать инструктора в указанную точку
      </button>
    </div>
    <p v-else-if="!instructorsLoading && !instructorsError && instructors.length > 0" class="map-status">
      Выберите инструктора на карте, чтобы увидеть его данные.
    </p>
    <p v-else-if="!instructorsLoading && !instructorsError" class="map-status">
      Пока нет свободных инструкторов.
    </p>

    <p v-if="callStatus" class="notice">{{ callStatus }}</p>
  </section>
</template>

<style scoped>
.landing {
  display: grid;
  gap: 14px;
}

.landing h2 {
  margin: 0;
}

.landing p {
  margin: 0;
  color: #c6d2ff;
}

.landing-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.map-block,
.agreement-card {
  display: grid;
  gap: 10px;
  margin-top: 6px;
}

.map-status {
  margin: 0;
  color: #b9c8ff;
}

.map-frame {
  width: 100%;
  min-height: 320px;
  border: 1px solid rgba(170, 185, 255, 0.3);
  border-radius: 14px;
}

.legend {
  color: #9db0ff;
  font-size: 13px;
}

.checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #d5ddff;
}

.primary {
  border: none;
  border-radius: 12px;
  padding: 12px 16px;
  color: white;
  cursor: pointer;
  background: linear-gradient(90deg, #5f7dff, #7f52ff);
  font-weight: 600;
}

.primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.ghost {
  border-radius: 10px;
  border: 1px solid rgba(170, 185, 255, 0.35);
  background: rgba(255, 255, 255, 0.05);
  color: #e4eaff;
  padding: 8px 12px;
  cursor: pointer;
}

.notice {
  margin: 0;
  color: #82f4c6;
}

.error {
  margin: 0;
  color: #ff9ba5;
}

</style>
