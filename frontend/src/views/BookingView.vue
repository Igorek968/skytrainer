<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { apiJson } from "../api/http.js";
import { useAuth } from "../composables/useAuth.js";

const props = defineProps({
  bookingTarget: {
    type: Object,
    default: null
  }
});

const { user, isClient } = useAuth();

const selectedDate = ref(todayStr());
const startHour = ref(9);
const hoursCount = ref(2);
const busy = ref(false);
const message = ref("");
const bookings = ref([]);

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const dateChoices = computed(() => {
  const out = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = 0; i < 14; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    out.push({ value: `${y}-${m}-${day}`, label: d.toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" }) });
  }
  return out;
});

const slotHours = computed(() => {
  const end = 18;
  const out = [];
  for (let h = 9; h < end; h++) out.push(h);
  return out;
});

watch(
  () => props.bookingTarget,
  (t) => {
    if (t?.resort) message.value = "";
  }
);

async function refreshBookings() {
  if (!isClient.value) return;
  try {
    bookings.value = await apiJson("/booking/mine");
  } catch {
    bookings.value = [];
  }
}

watch(isClient, (v) => {
  if (v) refreshBookings();
});

onMounted(() => {
  if (isClient.value) refreshBookings();
});

async function createAndPay() {
  message.value = "";
  if (!isClient.value || !props.bookingTarget?.instructor?.uid) {
    message.value = "Выберите инструктора на карте или войдите как клиент.";
    return;
  }
  busy.value = true;
  try {
    const [yy, mm, dd] = selectedDate.value.split("-").map(Number);
    const start = new Date(yy, mm - 1, dd, startHour.value, 0, 0, 0);
    const created = await apiJson("/booking/", {
      method: "POST",
      body: JSON.stringify({
        instructorUserId: props.bookingTarget.instructor.uid,
        resortSlug: props.bookingTarget.resort,
        startAt: start.toISOString(),
        hours: hoursCount.value
      })
    });
    const pay = await apiJson("/payment/create", {
      method: "POST",
      body: JSON.stringify({ bookingId: created.id })
    });
    if (pay.confirmationUrl) {
      window.open(pay.confirmationUrl, "_blank", "noopener,noreferrer");
      message.value =
        "Открыта страница оплаты. После успешной оплаты вернитесь и нажмите «Обновить бронирования».";
    } else {
      message.value = "Платёж создан без ссылки подтверждения.";
    }
    await refreshBookings();
  } catch (e) {
    message.value = e.message || String(e);
  } finally {
    busy.value = false;
  }
}

function statusRu(s) {
  const map = {
    pending_payment: "ожидает оплаты",
    paid: "оплачено",
    confirmed: "подтверждено",
    active: "идёт занятие",
    completed: "завершено",
    cancelled: "отменено"
  };
  return map[s] || s;
}

function rubFromKopeks(k) {
  return k != null ? `${Math.round(Number(k) / 100)} ₽` : "";
}
</script>

<template>
  <div class="grid">
    <section class="drive-panel block">
      <h3 class="block-title">Новое бронирование</h3>
      <p v-if="bookingTarget?.instructor" class="drive-muted">
        Инструктор: <strong>{{ bookingTarget.instructor.displayName }}</strong> · курорт
        {{ bookingTarget.resort }}
      </p>
      <p v-else class="drive-muted">Откройте карту и нажмите «Забронировать» у выбранного инструктора.</p>

      <div class="fields">
        <label>
          <span class="drive-label">Дата (две недели вперёд)</span>
          <select v-model="selectedDate" class="drive-select">
            <option v-for="d in dateChoices" :key="d.value" :value="d.value">{{ d.label }}</option>
          </select>
        </label>
        <label>
          <span class="drive-label">Начало (слот 1 ч, 9:00–18:00)</span>
          <select v-model.number="startHour" class="drive-select">
            <option v-for="h in slotHours" :key="h" :value="h">{{ h }}:00</option>
          </select>
        </label>
        <label>
          <span class="drive-label">Часов занятия</span>
          <select v-model.number="hoursCount" class="drive-select">
            <option v-for="n in 8" :key="n" :value="n">{{ n }}</option>
          </select>
        </label>
      </div>

      <p class="drive-muted fee-note">
        Комиссия сервиса 15%, остальное инструктору (разбиение при оплате через ЮKassa в продакшене).
      </p>

      <div class="actions">
        <button type="button" class="drive-btn drive-btn--primary" :disabled="busy || !isClient" @click="createAndPay">
          {{ busy ? "Отправка…" : "Создать и оплатить" }}
        </button>
      </div>
      <p v-if="message" class="msg">{{ message }}</p>
      <p v-if="!isClient && user" class="drive-muted">Войдите учётной записью клиента для бронирования.</p>
    </section>

    <section v-if="isClient" class="drive-panel block">
      <div class="block-head">
        <h3 class="block-title">Мои бронирования</h3>
        <button type="button" class="drive-btn drive-btn--ghost" @click="refreshBookings">Обновить</button>
      </div>
      <ul class="book-list">
        <li v-for="b in bookings" :key="b.id" class="book-item">
          <div>
            <strong>{{ new Date(b.start_at).toLocaleString("ru-RU") }}</strong>
            <span class="drive-muted"> · {{ statusRu(b.status) }}</span>
          </div>
          <div class="drive-muted">{{ rubFromKopeks(b.total_amount_kopeks) }}</div>
          <div v-if="b.qr_payload && b.status === 'paid'" class="qr-block">
            <span class="drive-label">QR для старта</span>
            <code class="qr">{{ b.qr_payload }}</code>
          </div>
        </li>
        <li v-if="!bookings.length" class="drive-muted">Пока нет бронирований.</li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.grid {
  display: grid;
  gap: 16px;
  max-width: 880px;
}

.block {
  padding: 20px;
}

.block-title {
  margin: 0 0 12px;
  font-size: 16px;
}

.block-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.fields {
  display: grid;
  gap: 14px;
  margin-top: 16px;
  max-width: 400px;
}

.actions {
  margin-top: 18px;
}

.fee-note {
  margin-top: 14px;
  font-size: 12px;
}

.msg {
  margin-top: 12px;
  color: var(--drive-accent);
}

.book-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.book-item {
  padding: 12px 0;
  border-bottom: 1px solid var(--drive-border);
}

.qr-block {
  margin-top: 8px;
}

.qr {
  display: block;
  margin-top: 4px;
  padding: 8px;
  background: var(--drive-bg);
  border-radius: 8px;
  word-break: break-all;
  font-size: 12px;
}
</style>
