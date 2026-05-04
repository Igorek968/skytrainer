<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { apiJson } from "../api/http.js";
import { useAuth } from "../composables/useAuth.js";

const { user, hydrate, login, register, logout, isClient } = useAuth();

const email = ref("");
const password = ref("");
const displayName = ref("");
const regRole = ref("client");
const authError = ref("");

const favorites = ref([]);
const paymentMethods = ref([]);
const bookings = ref([]);
const notifyEmail = ref(localStorage.getItem("sky_notify_mock") === "1");

const reviewBookingId = ref("");
const reviewStars = ref(5);
const reviewText = ref("");
const reviewMsg = ref("");

const pmProvider = ref("yookassa_card");
const pmLabel = ref("Моя карта");
const pmExternal = ref("card_demo_1");

watch(notifyEmail, (v) => {
  localStorage.setItem("sky_notify_mock", v ? "1" : "0");
});

async function submitLogin() {
  authError.value = "";
  try {
    await login({ email: email.value, password: password.value });
  } catch (e) {
    authError.value = e.message || String(e);
  }
}

async function submitRegister() {
  authError.value = "";
  try {
    await register({
      email: email.value,
      password: password.value,
      role: regRole.value,
      displayName: displayName.value || "Пользователь"
    });
  } catch (e) {
    authError.value = e.message || String(e);
  }
}

async function loadClientData() {
  if (!isClient.value) return;
  try {
    const [fav, pm, mine] = await Promise.all([
      apiJson("/client/favorites"),
      apiJson("/client/payment-methods"),
      apiJson("/booking/mine")
    ]);
    favorites.value = fav;
    paymentMethods.value = pm;
    bookings.value = mine;
  } catch {
    favorites.value = [];
    paymentMethods.value = [];
    bookings.value = [];
  }
}

watch(isClient, (v) => {
  if (v) loadClientData();
});

onMounted(async () => {
  await hydrate();
  await loadClientData();
});

const completedBookings = computed(() =>
  bookings.value.filter((b) => b.status === "completed")
);

async function addPaymentMethod() {
  reviewMsg.value = "";
  try {
    await apiJson("/client/payment-methods", {
      method: "POST",
      body: JSON.stringify({
        provider: pmProvider.value,
        label: pmLabel.value,
        externalId: pmExternal.value,
        isDefault: true
      })
    });
    await loadClientData();
  } catch (e) {
    reviewMsg.value = e.message || String(e);
  }
}

async function submitReview() {
  reviewMsg.value = "";
  try {
    await apiJson("/reviews/", {
      method: "POST",
      body: JSON.stringify({
        bookingId: reviewBookingId.value,
        stars: reviewStars.value,
        text: reviewText.value
      })
    });
    reviewMsg.value = "Спасибо, отзыв сохранён.";
    reviewText.value = "";
    await loadClientData();
  } catch (e) {
    reviewMsg.value = e.message || String(e);
  }
}
</script>

<template>
  <div class="profile">
    <section v-if="!user" class="drive-panel block">
      <h3 class="title">Вход и регистрация</h3>
      <p class="drive-muted">Телефон можно добавить в API позже; сейчас email и пароль.</p>
      <div class="grid-form">
        <label>
          <span class="drive-label">Email</span>
          <input v-model="email" type="email" class="drive-input" autocomplete="username" />
        </label>
        <label>
          <span class="drive-label">Пароль</span>
          <input v-model="password" type="password" class="drive-input" autocomplete="current-password" />
        </label>
        <label>
          <span class="drive-label">Имя (для регистрации)</span>
          <input v-model="displayName" class="drive-input" />
        </label>
        <label>
          <span class="drive-label">Роль</span>
          <select v-model="regRole" class="drive-select">
            <option value="client">Клиент</option>
            <option value="instructor">Инструктор</option>
          </select>
        </label>
      </div>
      <div class="actions">
        <button type="button" class="drive-btn drive-btn--primary" @click="submitLogin">Войти</button>
        <button type="button" class="drive-btn drive-btn--ghost" @click="submitRegister">Регистрация</button>
      </div>
      <p v-if="authError" class="err">{{ authError }}</p>
      <p class="drive-muted demo-hint">
        Демо: client@skytrainer.local / Demo123! или instructor@skytrainer.local / Demo123!
      </p>
    </section>

    <template v-else>
      <section class="drive-panel block">
        <div class="head-row">
          <div>
            <h3 class="title">{{ user.display_name }}</h3>
            <p class="drive-muted">{{ user.email }} · {{ user.role === "client" ? "Клиент" : "Инструктор" }}</p>
          </div>
          <button type="button" class="drive-btn drive-btn--ghost" @click="logout">Выйти</button>
        </div>
        <label class="notify">
          <input v-model="notifyEmail" type="checkbox" />
          Напоминания и статусы (локально в браузере + push через FCM на сервере)
        </label>
      </section>

      <section v-if="isClient" class="drive-panel block">
        <h3 class="title">Избранные инструкторы</h3>
        <ul class="list">
          <li v-for="f in favorites" :key="f.uid" class="list-item">
            <strong>{{ f.displayName }}</strong>
            <span class="drive-muted">★ {{ Number(f.rating).toFixed(2) }} · {{ f.hourlyRate }} ₽/ч</span>
          </li>
          <li v-if="!favorites.length" class="drive-muted">Пока пусто — добавьте с карты.</li>
        </ul>
      </section>

      <section v-if="isClient" class="drive-panel block">
        <h3 class="title">Способы оплаты</h3>
        <ul class="list">
          <li v-for="p in paymentMethods" :key="p.id" class="list-item">
            {{ p.label }} · {{ p.provider }}
            <span v-if="p.isDefault" class="badge">основной</span>
          </li>
        </ul>
        <div class="grid-form tight">
          <select v-model="pmProvider" class="drive-select">
            <option value="yookassa_card">Карта ЮKassa</option>
            <option value="yookassa_sbp">СБП</option>
          </select>
          <input v-model="pmLabel" placeholder="Название" class="drive-input" />
          <input v-model="pmExternal" placeholder="Внешний ID" class="drive-input" />
          <button type="button" class="drive-btn drive-btn--primary" @click="addPaymentMethod">Добавить</button>
        </div>
      </section>

      <section v-if="isClient" class="drive-panel block">
        <h3 class="title">История и отзывы</h3>
        <ul class="list">
          <li v-for="b in bookings" :key="b.id" class="list-item">
            {{ new Date(b.start_at).toLocaleString("ru-RU") }} — {{ b.status }}
          </li>
        </ul>
        <div class="review-box">
          <span class="drive-label">Оценить завершённое занятие</span>
          <select v-model="reviewBookingId" class="drive-select">
            <option value="">— бронирование —</option>
            <option v-for="b in completedBookings" :key="b.id" :value="b.id">{{ b.id.slice(0, 8) }}…</option>
          </select>
          <div class="stars-row">
            <span class="drive-label">Звёзды</span>
            <input v-model.number="reviewStars" type="range" min="1" max="5" step="1" />
            <span>{{ reviewStars }}</span>
          </div>
          <textarea v-model="reviewText" class="drive-input area" rows="3" placeholder="Текст отзыва" />
          <button type="button" class="drive-btn drive-btn--primary" @click="submitReview">Отправить отзыв</button>
          <p v-if="reviewMsg" class="drive-muted">{{ reviewMsg }}</p>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.profile {
  display: grid;
  gap: 16px;
  max-width: 720px;
}

.block {
  padding: 20px;
}

.title {
  margin: 0 0 8px;
}

.grid-form {
  display: grid;
  gap: 12px;
  max-width: 400px;
  margin-top: 12px;
}

.grid-form.tight {
  margin-top: 16px;
}

.actions {
  display: flex;
  gap: 10px;
  margin-top: 16px;
}

.err {
  color: #b91c1c;
  margin-top: 12px;
}

.demo-hint {
  margin-top: 12px;
  font-size: 12px;
}

.head-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.notify {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  margin-top: 16px;
  font-size: 13px;
  color: var(--drive-muted);
}

.list {
  list-style: none;
  padding: 0;
  margin: 12px 0 0;
}

.list-item {
  padding: 10px 0;
  border-bottom: 1px solid var(--drive-border);
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(82, 130, 255, 0.15);
  color: var(--drive-accent);
}

.review-box {
  margin-top: 16px;
  display: grid;
  gap: 10px;
  max-width: 440px;
}

.stars-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.area {
  resize: vertical;
  min-height: 72px;
}
</style>
