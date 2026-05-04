<script setup>
import { ref, computed, onMounted } from "vue";
import MapView from "./views/MapView.vue";
import BookingView from "./views/BookingView.vue";
import LessonView from "./views/LessonView.vue";
import ProfileView from "./views/ProfileView.vue";
import InstructorCabinetView from "./views/InstructorCabinetView.vue";
import { useAuth } from "./composables/useAuth.js";

const tab = ref("map");
const { user, hydrate } = useAuth();

const bookingTarget = ref(null);

const tabs = computed(() => {
  const base = [
    { key: "map", label: "Карта" },
    { key: "booking", label: "Бронирование" },
    { key: "lesson", label: "Занятие" },
    { key: "profile", label: "Профиль" }
  ];
  if (user.value?.role === "instructor") {
    base.splice(3, 0, { key: "cabinet", label: "Кабинет инструктора" });
  }
  return base;
});

const toolbarTitle = computed(() => {
  const titles = {
    map: "Инструкторы на карте",
    booking: "Бронирование и оплата",
    lesson: "Трекинг занятия",
    cabinet: "Кабинет инструктора",
    profile: "Профиль"
  };
  return titles[tab.value] || "";
});

function onBook(payload) {
  bookingTarget.value = payload;
  tab.value = "booking";
}

onMounted(() => {
  hydrate();
});
</script>

<template>
  <div class="drive-root">
    <aside class="drive-sidebar">
      <div class="drive-logo">SnowRide</div>
      <nav class="drive-nav">
        <button
          v-for="t in tabs"
          :key="t.key"
          type="button"
          class="drive-nav-item"
          :class="{ 'is-active': tab === t.key }"
          @click="tab = t.key"
        >
          {{ t.label }}
        </button>
      </nav>
      <div class="drive-sidebar-footer">
        <div class="drive-user">
          <template v-if="user">{{ user.display_name }}</template>
          <template v-else>Не авторизован</template>
        </div>
      </div>
    </aside>

    <main class="drive-main">
      <header class="drive-toolbar">{{ toolbarTitle }}</header>
      <div class="drive-body">
        <MapView v-show="tab === 'map'" @book="onBook" />
        <BookingView v-show="tab === 'booking'" :booking-target="bookingTarget" />
        <LessonView v-show="tab === 'lesson'" />
        <InstructorCabinetView v-show="tab === 'cabinet'" />
        <ProfileView v-show="tab === 'profile'" />
      </div>
    </main>
  </div>
</template>
