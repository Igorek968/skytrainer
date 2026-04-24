<script setup>
import { computed, onMounted, ref } from "vue";

defineProps({
  isAuthenticated: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["register", "login", "openProfile"]);

const locationStatus = ref("Определяем вашу геолокацию...");
const mapPoint = ref({ lat: 55.751244, lon: 37.618423 });

const mapSrc = computed(() => {
  const { lat, lon } = mapPoint.value;
  return `https://yandex.ru/map-widget/v1/?ll=${lon},${lat}&z=13&pt=${lon},${lat},pm2rdm`;
});

onMounted(() => {
  if (!("geolocation" in navigator)) {
    locationStatus.value = "Геолокация не поддерживается в этом браузере.";
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      mapPoint.value = {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
      };
      locationStatus.value = `Ваша геолокация: ${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`;
    },
    () => {
      locationStatus.value = "Не удалось получить геолокацию. Показан центр Москвы.";
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
      Платформа для пользователей и инструкторов: регистрируйтесь, загружайте фото профиля и
      управляйте личным кабинетом.
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
      <iframe
        :src="mapSrc"
        title="Яндекс Карта с вашей геолокацией"
        class="map-frame"
        allowfullscreen
      ></iframe>
    </div>
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

.map-block {
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

.primary {
  border: none;
  border-radius: 12px;
  padding: 12px 16px;
  color: white;
  cursor: pointer;
  background: linear-gradient(90deg, #5f7dff, #7f52ff);
  font-weight: 600;
}

.ghost {
  border-radius: 10px;
  border: 1px solid rgba(170, 185, 255, 0.35);
  background: rgba(255, 255, 255, 0.05);
  color: #e4eaff;
  padding: 8px 12px;
  cursor: pointer;
}
</style>
