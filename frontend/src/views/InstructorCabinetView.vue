<script setup>
import { ref, onMounted, watch } from "vue";
import { apiJson } from "../api/http.js";
import { useAuth } from "../composables/useAuth.js";

const { user, isInstructor } = useAuth();

const profile = ref(null);
const bookings = ref([]);
const msg = ref("");
const busy = ref(false);

const hourlyRate = ref(3000);
const availability = ref("available_now");
const isOnline = ref(true);
const languages = ref(["ru"]);
const resortSlug = ref("krasnaya");

async function loadAll() {
  if (!isInstructor.value) return;
  msg.value = "";
  try {
    const [p, b] = await Promise.all([apiJson("/instructor/profile"), apiJson("/booking/mine")]);
    profile.value = p;
    bookings.value = b;
    if (p) {
      hourlyRate.value = p.hourly_rate;
      availability.value = p.availability;
      isOnline.value = p.is_online;
      languages.value = p.languages?.length ? [...p.languages] : ["ru"];
      resortSlug.value = p.resort_slug || "krasnaya";
    }
  } catch (e) {
    msg.value = e.message || String(e);
  }
}

watch(isInstructor, (v) => {
  if (v) loadAll();
});

onMounted(loadAll);

async function saveProfile() {
  busy.value = true;
  msg.value = "";
  try {
    const langs = languages.value.length ? languages.value : ["ru"];
    await apiJson("/instructor/profile", {
      method: "PATCH",
      body: JSON.stringify({
        hourlyRate: hourlyRate.value,
        availability: availability.value,
        isOnline: isOnline.value,
        languages: langs,
        resortSlug: resortSlug.value
      })
    });
    msg.value = "Сохранено.";
    await loadAll();
  } catch (e) {
    msg.value = e.message || String(e);
  } finally {
    busy.value = false;
  }
}

function toggleLang(code) {
  const set = new Set(languages.value);
  if (set.has(code)) set.delete(code);
  else set.add(code);
  languages.value = [...set];
}

function statusRu(s) {
  const map = {
    pending_payment: "ожидает оплаты",
    paid: "оплачено",
    confirmed: "подтверждено",
    active: "идёт",
    completed: "завершено",
    cancelled: "отменено"
  };
  return map[s] || s;
}
</script>

<template>
  <div class="cabinet">
    <section v-if="!user" class="drive-panel block">
      <p class="drive-muted">Войдите как инструктор в разделе «Профиль».</p>
    </section>

    <template v-else-if="isInstructor">
      <section class="drive-panel block">
        <h3 class="title">График и тариф</h3>
        <div class="grid-form">
          <label>
            <span class="drive-label">Ставка, ₽/ч</span>
            <input v-model.number="hourlyRate" type="number" min="500" max="50000" class="drive-input" />
          </label>
          <label>
            <span class="drive-label">Доступность</span>
            <select v-model="availability" class="drive-select">
              <option value="available_now">Свободен сейчас</option>
              <option value="available_later">Свободен позже</option>
              <option value="busy">Занят</option>
            </select>
          </label>
          <label>
            <span class="drive-label">Курорт</span>
            <select v-model="resortSlug" class="drive-select">
              <option value="krasnaya">Красная Поляна</option>
              <option value="sheregesh">Шерегеш</option>
              <option value="dombay">Домбай</option>
            </select>
          </label>
          <label class="inline">
            <input v-model="isOnline" type="checkbox" />
            Онлайн в поиске
          </label>
          <div>
            <span class="drive-label">Языки</span>
            <div class="langs">
              <label><input type="checkbox" :checked="languages.includes('ru')" @change="toggleLang('ru')" /> RU</label>
              <label><input type="checkbox" :checked="languages.includes('en')" @change="toggleLang('en')" /> EN</label>
            </div>
          </div>
        </div>
        <button type="button" class="drive-btn drive-btn--primary" :disabled="busy" @click="saveProfile">
          {{ busy ? "Сохранение…" : "Сохранить" }}
        </button>
        <p v-if="msg" class="msg">{{ msg }}</p>
      </section>

      <section class="drive-panel block">
        <h3 class="title">Календарь броней</h3>
        <ul class="list">
          <li v-for="b in bookings" :key="b.id" class="list-item">
            <div>
              <strong>{{ new Date(b.start_at).toLocaleString("ru-RU") }}</strong>
              <span class="drive-muted"> · {{ b.client_name || "Клиент" }} · {{ statusRu(b.status) }}</span>
            </div>
          </li>
          <li v-if="!bookings.length" class="drive-muted">Пока нет заявок.</li>
        </ul>
        <p class="drive-muted hint">
          Старт и завершение занятия — в разделе «Занятие»: там же трекинг для клиента и инструктора.
        </p>
      </section>
    </template>

    <section v-else class="drive-panel block">
      <p class="drive-muted">Этот раздел только для роли инструктор.</p>
    </section>
  </div>
</template>

<style scoped>
.cabinet {
  display: grid;
  gap: 16px;
  max-width: 720px;
}

.block {
  padding: 20px;
}

.title {
  margin: 0 0 12px;
}

.grid-form {
  display: grid;
  gap: 14px;
  max-width: 400px;
  margin-bottom: 16px;
}

.inline {
  display: flex;
  align-items: center;
  gap: 10px;
}

.langs {
  display: flex;
  gap: 16px;
  margin-top: 8px;
}

.list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.list-item {
  padding: 12px 0;
  border-bottom: 1px solid var(--drive-border);
}

.hint {
  margin-top: 16px;
  font-size: 13px;
}

.msg {
  margin-top: 12px;
  color: var(--drive-accent);
}
</style>
