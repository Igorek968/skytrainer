<template>
  <section class="snowride">
    <div class="layout">
      <aside class="sidebar">
        <button class="brand brand-btn" type="button" @click="handleClick('Бренд SnowRide')">
          <h3>SnowRide</h3>
          <p>Горнолыжный курорт "Эльбрус"</p>
        </button>

        <div class="weather">
          <button
            v-for="item in weatherItems"
            :key="item"
            type="button"
            class="weather-chip"
            @click="handleClick(`Погода: ${item}`)"
          >
            {{ item }}
          </button>
        </div>

        <div class="group">
          <h4>Место встречи</h4>
          <button
            v-for="point in meetingPoints"
            :key="point.label"
            type="button"
            class="card card-btn"
            @click="handleClick(`Точка: ${point.value}`)"
          >
            <p class="label">{{ point.label }}</p>
            <p class="value">{{ point.value }}</p>
          </button>
        </div>

        <div class="group">
          <h4>Тип инструктора</h4>
          <div class="types">
            <button
              v-for="type in instructorTypes"
              :key="type.title"
              type="button"
              class="type-btn"
              :class="{ active: selectedInstructorType === type.title }"
              @click="selectInstructorType(type.title)"
            >
              <span class="emoji">{{ type.emoji }}</span>
              <span class="title">{{ type.title }}</span>
              <span class="price">{{ type.price }}</span>
              <span class="level">{{ type.level }}</span>
            </button>
          </div>
        </div>

        <div class="extras">
          <h4>Дополнительно</h4>
          <button type="button" class="toggle-row toggle-btn" @click="toggleGearRental">
            <span>Прокат снаряжения</span>
            <span class="switch" :class="{ on: gearRentalEnabled }"></span>
          </button>
        </div>
      </aside>

      <div class="map" @click="handleClick('Область карты')">
        <div class="stats" @click.stop="handleClick('Панель статистики')">
          <p class="stats-title" @click.stop="handleClick('Заголовок статистики')">Инструкторы онлайн</p>
          <p @click.stop="handleClick('Доступно: 4')">Доступно: 4</p>
          <p @click.stop="handleClick('Занято: 2')">Занято: 2</p>
          <p @click.stop="handleClick('Среднее ожидание: 7 мин')">Среднее ожидание: 7 мин</p>
        </div>

        <button type="button" class="mountains" @click.stop="handleClick('Фон гор')"></button>
        <button type="button" class="slope slope-a" @click.stop="handleClick('Лыжная трасса A')"></button>
        <button type="button" class="slope slope-b" @click.stop="handleClick('Лыжная трасса B')"></button>

        <button
          v-for="person in mapMarkers"
          :key="person.name"
          type="button"
          class="marker"
          :class="person.role"
          :style="{ left: person.left, top: person.top }"
          @click.stop="handleClick(`Метка: ${person.name}`)"
        >
          <span>{{ person.icon }}</span>
          <small>{{ person.name }}</small>
        </button>

        <div class="controls">
          <button type="button" @click.stop="handleClick('Масштаб +')">+</button>
          <button type="button" @click.stop="handleClick('Масштаб -')">-</button>
          <button type="button" @click.stop="handleClick('Настройки карты')">⚙</button>
        </div>
      </div>
    </div>
    <p class="action-log">Последнее действие: {{ lastAction }}</p>
  </section>
</template>

<script setup>
import { ref } from "vue";

const instructorTypes = [
  { emoji: "⛷", title: "Новичок", price: "от 2 500 ₽/час", level: "A-B уровень" },
  { emoji: "🏂", title: "Средний", price: "от 3 800 ₽/час", level: "B-C уровень" },
  { emoji: "🎿", title: "Продвинутый", price: "от 5 200 ₽/час", level: "C-D уровень" },
  { emoji: "🧒", title: "Детский", price: "от 2 000 ₽/час", level: "3-12 лет" },
];

const mapMarkers = [
  { name: "Алексей (4.9)", icon: "🟢", role: "instructor", left: "38%", top: "26%" },
  { name: "Дмитрий (5.0)", icon: "🔴", role: "busy", left: "56%", top: "31%" },
  { name: "Мария (4.8)", icon: "🟢", role: "instructor", left: "64%", top: "48%" },
  { name: "Анна (4.7)", icon: "🟢", role: "instructor", left: "31%", top: "58%" },
  { name: "Вы здесь", icon: "🔵", role: "you", left: "47%", top: "77%" },
];

const weatherItems = ["-5°C", "3 м/с", "Свежий снег"];
const meetingPoints = [
  { label: "Текущая точка", value: 'Склон "Чегет", нижняя станция' },
  { label: "Место встречи", value: 'Верхняя точка, кафе "Высота"' },
];

const selectedInstructorType = ref("Детский");
const gearRentalEnabled = ref(true);
const lastAction = ref("Нажмите на любой элемент макета");

function handleClick(action) {
  lastAction.value = action;
}

function selectInstructorType(typeTitle) {
  selectedInstructorType.value = typeTitle;
  handleClick(`Выбран тип: ${typeTitle}`);
}

function toggleGearRental() {
  gearRentalEnabled.value = !gearRentalEnabled.value;
  handleClick(`Прокат снаряжения: ${gearRentalEnabled.value ? "включен" : "выключен"}`);
}
</script>

<style scoped>
.snowride {
  margin-top: 16px;
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid rgba(170, 185, 255, 0.3);
  background: #d7e2ef;
}

.layout {
  min-height: 560px;
  display: grid;
  grid-template-columns: 300px 1fr;
}

.sidebar {
  background: #f2f5f8;
  color: #223042;
  display: grid;
  align-content: start;
}

.brand {
  background: linear-gradient(180deg, #184568, #203c57);
  color: #fff;
  padding: 16px;
}

.brand-btn {
  border: 0;
  width: 100%;
  text-align: left;
  cursor: pointer;
}

.brand h3 {
  margin: 0 0 4px;
  font-size: 30px;
}

.brand p {
  margin: 0;
  font-size: 13px;
  opacity: 0.9;
}

.weather {
  display: flex;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid #d9e0e8;
  font-size: 13px;
}

.weather-chip {
  border: 1px solid #d8e0ea;
  background: #fff;
  border-radius: 999px;
  font-size: 12px;
  padding: 5px 10px;
  cursor: pointer;
}

.group,
.extras {
  padding: 12px 16px;
}

.group h4,
.extras h4 {
  margin: 0 0 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-size: 13px;
}

.card {
  background: #fff;
  border: 1px solid #e2e7ee;
  border-radius: 12px;
  padding: 10px;
  margin-bottom: 8px;
}

.card-btn {
  width: 100%;
  text-align: left;
  cursor: pointer;
}

.label {
  margin: 0;
  color: #6f7e8f;
  font-size: 11px;
}

.value {
  margin: 3px 0 0;
  font-size: 13px;
  font-weight: 600;
}

.types {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.type-btn {
  border: 1px solid #d8e0ea;
  background: #fff;
  border-radius: 12px;
  padding: 10px 8px;
  display: grid;
  justify-items: center;
  gap: 3px;
  cursor: default;
}

.type-btn.active {
  border-color: #e89999;
  box-shadow: inset 0 0 0 1px #f3b6b6;
}

.emoji {
  font-size: 22px;
}

.title {
  font-size: 12px;
  font-weight: 600;
}

.price {
  font-size: 11px;
  color: #6b7887;
}

.level {
  font-size: 10px;
  color: #478ecf;
}

.toggle-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
}

.toggle-btn {
  border: 0;
  width: 100%;
  background: transparent;
  padding: 0;
  cursor: pointer;
}

.switch {
  width: 40px;
  height: 22px;
  border-radius: 11px;
  background: #ccd8e7;
  position: relative;
}

.switch::after {
  content: "";
  position: absolute;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  top: 2px;
  left: 2px;
  background: #fff;
}

.switch.on {
  background: #4f96d3;
}

.switch.on::after {
  left: 20px;
}

.map {
  position: relative;
  background: #d8e3ef;
  overflow: hidden;
}

.stats {
  position: absolute;
  top: 14px;
  right: 14px;
  background: rgba(255, 255, 255, 0.93);
  border-radius: 14px;
  padding: 10px 12px;
  font-size: 12px;
  color: #223042;
  z-index: 3;
}

.stats p {
  margin: 2px 0;
}

.stats-title {
  margin-bottom: 6px;
  font-weight: 700;
}

.mountains {
  position: absolute;
  inset: 0 0 auto;
  height: 220px;
  border: 0;
  width: 100%;
  padding: 0;
  cursor: pointer;
  background:
    linear-gradient(135deg, transparent 52%, rgba(255, 255, 255, 0.22) 52% 55%, transparent 55%) 0 50px / 220px
      220px repeat-x,
    linear-gradient(#c8d7e8, #cddbea);
}

.slope {
  position: absolute;
  width: 18px;
  height: 90px;
  border: 0;
  padding: 0;
  cursor: pointer;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.88);
  transform: rotate(12deg);
  top: 135px;
}

.slope-a {
  left: 25%;
}

.slope-b {
  left: 63%;
  transform: rotate(-8deg);
}

.marker {
  position: absolute;
  transform: translate(-50%, -50%);
  border: 0;
  padding: 0;
  background: transparent;
  display: grid;
  justify-items: center;
  gap: 4px;
  z-index: 2;
  cursor: pointer;
}

.marker span {
  font-size: 24px;
}

.marker small {
  background: #20262d;
  color: #fff;
  border-radius: 10px;
  padding: 3px 8px;
  font-size: 11px;
}

.controls {
  position: absolute;
  right: 16px;
  bottom: 16px;
  display: grid;
  gap: 8px;
}

.controls button {
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.9);
  color: #1f2d3c;
  font-size: 18px;
  cursor: pointer;
}

.action-log {
  margin: 0;
  background: #f2f5f8;
  color: #223042;
  font-size: 13px;
  padding: 10px 14px;
  border-top: 1px solid #d9e0e8;
}

@media (max-width: 940px) {
  .layout {
    grid-template-columns: 1fr;
  }

  .map {
    min-height: 460px;
  }
}
</style>
