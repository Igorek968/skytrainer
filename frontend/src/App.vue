<script setup>
import { computed, onMounted, ref } from "vue";
import StartPage from "./components/StartPage.vue";

const API_URL = "http://localhost:8000";
const TOKEN_KEY = "skytrainer_jwt";

const currentScreen = ref("home");
const activeTab = ref("login");
const authLoading = ref(false);
const profileLoading = ref(false);
const saveLoading = ref(false);
const uploadAuthPhotoLoading = ref(false);
const uploadProfilePhotoLoading = ref(false);
const notice = ref("");
const error = ref("");
const profile = ref(null);
const token = ref(localStorage.getItem(TOKEN_KEY) ?? "");

const authForm = ref({
  email: "",
  name: "",
  password: "",
  role: "user",
  skills: ["ski"],
  experienceYears: 1,
  gender: "male",
  photoUrl: "",
  hasLicense: true,
});

const profileForm = ref({
  name: "",
  skills: [],
  experienceYears: 0,
  gender: "male",
  photoUrl: "",
  hasLicense: false,
});

const skillOptions = [
  { id: "ski", label: "Лыжи" },
  { id: "snowboard", label: "Сноуборд" },
];

const roleLabel = computed(() =>
  profile.value?.role === "instructor" ? "Инструктор" : "Пользователь",
);
const isInstructorProfile = computed(() => profile.value?.role === "instructor");
const authPhotoSrc = computed(() => resolvePhotoUrl(authForm.value.photoUrl));
const profilePhotoSrc = computed(() => resolvePhotoUrl(profileForm.value.photoUrl));

function resetMessages() {
  error.value = "";
  notice.value = "";
}

function fillProfileForm(user) {
  profileForm.value.name = user.name ?? "";
  profileForm.value.skills = [...(user.skills ?? [])];
  profileForm.value.experienceYears = Number(user.experience_years ?? 0);
  profileForm.value.gender = user.gender ?? "male";
  profileForm.value.photoUrl = user.photo_url ?? "";
  profileForm.value.hasLicense = Boolean(user.has_license);
}

function resolvePhotoUrl(url) {
  if (!url) {
    return "";
  }
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  if (url.startsWith("/")) {
    return `${API_URL}${url}`;
  }
  return `${API_URL}/${url}`;
}

async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers ?? {}),
  };
  if (token.value) {
    headers.Authorization = `Bearer ${token.value}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.detail || "Ошибка запроса к серверу");
  }
  return body;
}

async function loadProfile() {
  if (!token.value) {
    return;
  }
  profileLoading.value = true;
  try {
    const data = await api("/auth/me");
    profile.value = data.user;
    fillProfileForm(data.user);
    currentScreen.value = "auth";
  } catch (err) {
    token.value = "";
    localStorage.removeItem(TOKEN_KEY);
    error.value = err.message;
  } finally {
    profileLoading.value = false;
  }
}

async function submitAuth() {
  resetMessages();
  authLoading.value = true;
  try {
    if (activeTab.value === "register" && authForm.value.skills.length === 0) {
      throw new Error("Выберите хотя бы один навык.");
    }

    const path = activeTab.value === "register" ? "/auth/register" : "/auth/login";
    const payload =
      activeTab.value === "register"
        ? {
            email: authForm.value.email.trim(),
            name: authForm.value.name.trim(),
            password: authForm.value.password,
            role: authForm.value.role,
            skills: authForm.value.skills,
            experience_years: Number(authForm.value.experienceYears),
            gender: authForm.value.gender,
            photo_url: authForm.value.photoUrl.trim(),
            has_license: authForm.value.role === "instructor" ? authForm.value.hasLicense : null,
          }
        : {
            email: authForm.value.email.trim(),
            password: authForm.value.password,
          };

    const data = await api(path, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {},
    });

    token.value = data.access_token;
    localStorage.setItem(TOKEN_KEY, data.access_token);
    profile.value = data.user;
    fillProfileForm(data.user);
    currentScreen.value = "auth";
    notice.value = activeTab.value === "register" ? "Профиль создан." : "Вход выполнен.";
  } catch (err) {
    error.value = err.message;
  } finally {
    authLoading.value = false;
  }
}

async function saveProfile() {
  if (!profile.value) {
    return;
  }

  resetMessages();
  saveLoading.value = true;
  try {
    const payload = {
      name: profileForm.value.name.trim(),
      skills: profileForm.value.skills,
      experience_years: Number(profileForm.value.experienceYears),
      gender: profileForm.value.gender,
      photo_url: profileForm.value.photoUrl.trim(),
      has_license: isInstructorProfile.value ? profileForm.value.hasLicense : null,
    };

    const data = await api("/auth/me", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    profile.value = data.user;
    fillProfileForm(data.user);
    notice.value = "Изменения профиля сохранены.";
  } catch (err) {
    error.value = err.message;
  } finally {
    saveLoading.value = false;
  }
}

async function uploadPhoto(file, target) {
  if (!file) {
    return;
  }
  if (!file.type.startsWith("image/")) {
    throw new Error("Можно загрузить только изображение.");
  }

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_URL}/uploads/photo`, {
    method: "POST",
    body: formData,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.detail || "Не удалось загрузить изображение.");
  }
  const uploadedUrl = body.photo_url ?? "";
  if (!uploadedUrl) {
    throw new Error("Сервер не вернул адрес фото.");
  }
  if (target === "auth") {
    authForm.value.photoUrl = uploadedUrl;
  } else {
    profileForm.value.photoUrl = uploadedUrl;
  }
}

async function onAuthPhotoChange(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }
  resetMessages();
  uploadAuthPhotoLoading.value = true;
  try {
    await uploadPhoto(file, "auth");
    notice.value = "Фото для регистрации загружено.";
  } catch (err) {
    error.value = err.message;
  } finally {
    uploadAuthPhotoLoading.value = false;
    event.target.value = "";
  }
}

async function onProfilePhotoChange(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }
  resetMessages();
  uploadProfilePhotoLoading.value = true;
  try {
    await uploadPhoto(file, "profile");
    notice.value = "Новое фото загружено. Не забудьте сохранить профиль.";
  } catch (err) {
    error.value = err.message;
  } finally {
    uploadProfilePhotoLoading.value = false;
    event.target.value = "";
  }
}

function logout() {
  token.value = "";
  profile.value = null;
  localStorage.removeItem(TOKEN_KEY);
  notice.value = "Вы вышли из аккаунта.";
  error.value = "";
}

onMounted(loadProfile);
</script>

<template>
  <div class="page">
    <div class="glow glow-a"></div>
    <div class="glow glow-b"></div>

    <main class="container">
      <header class="hero">
        <h1>SkyTrainer</h1>
        <p>Личный кабинет для пользователя и инструктора с быстрым редактированием профиля.</p>
      </header>

      <section v-if="currentScreen === 'home'" class="panel">
        <StartPage
          :is-authenticated="Boolean(profile)"
          :api-url="API_URL"
          @register="currentScreen = 'auth'; activeTab = 'register'"
          @login="currentScreen = 'auth'; activeTab = 'login'"
          @open-profile="currentScreen = 'auth'"
        />
      </section>

      <section v-else-if="!profile" class="panel">
        <div class="tabs">
          <button :class="{ active: activeTab === 'login' }" @click="activeTab = 'login'">Вход</button>
          <button :class="{ active: activeTab === 'register' }" @click="activeTab = 'register'">
            Регистрация
          </button>
        </div>

        <form class="form-grid" @submit.prevent="submitAuth">
          <label>
            Email
            <input v-model.trim="authForm.email" type="email" required />
          </label>

          <label>
            Пароль
            <input v-model="authForm.password" type="password" required minlength="6" />
          </label>

          <template v-if="activeTab === 'register'">
            <label>
              Имя
              <input v-model.trim="authForm.name" type="text" maxlength="100" />
            </label>

            <label>
              Роль
              <select v-model="authForm.role">
                <option value="user">Пользователь</option>
                <option value="instructor">Инструктор</option>
              </select>
            </label>

            <fieldset class="skills-field">
              <legend>Навыки</legend>
              <label v-for="skill in skillOptions" :key="skill.id" class="checkbox">
                <input v-model="authForm.skills" type="checkbox" :value="skill.id" />
                {{ skill.label }}
              </label>
            </fieldset>

            <label>
              Опыт (лет)
              <input v-model.number="authForm.experienceYears" type="number" min="0" max="80" />
            </label>

            <label>
              Пол
              <select v-model="authForm.gender">
                <option value="male">Мужской</option>
                <option value="female">Женский</option>
                <option value="other">Другой</option>
              </select>
            </label>

            <label>
              Фото (URL)
              <input v-model.trim="authForm.photoUrl" type="text" placeholder="https://... или /uploads/..." />
            </label>
            <label>
              Фото (файл)
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                :disabled="uploadAuthPhotoLoading"
                @change="onAuthPhotoChange"
              />
            </label>
            <p v-if="uploadAuthPhotoLoading" class="notice">Загружаем фото...</p>
            <img v-if="authPhotoSrc" :src="authPhotoSrc" alt="Предпросмотр" class="avatar preview" />

            <label v-if="authForm.role === 'instructor'" class="checkbox">
              <input v-model="authForm.hasLicense" type="checkbox" />
              Есть лицензия инструктора
            </label>
          </template>

          <p v-if="error" class="error">{{ error }}</p>
          <p v-if="notice" class="notice">{{ notice }}</p>
          <button class="primary" type="submit" :disabled="authLoading">
            {{ authLoading ? "Подождите..." : activeTab === "register" ? "Создать аккаунт" : "Войти" }}
          </button>
        </form>
      </section>

      <section v-else class="panel">
        <div class="profile-head">
          <div>
            <p class="tag">{{ roleLabel }}</p>
            <h2>{{ profile.name || profile.email }}</h2>
            <p class="profile-email">{{ profile.email }}</p>
          </div>
          <div class="profile-actions">
            <button class="ghost" @click="currentScreen = 'home'">На стартовую</button>
            <button class="ghost" @click="logout">Выйти</button>
          </div>
        </div>

        <p v-if="profileLoading">Загрузка профиля...</p>

        <div class="profile-layout">
          <div class="avatar-wrap">
            <img
              v-if="profilePhotoSrc"
              :src="profilePhotoSrc"
              alt="Аватар"
              class="avatar"
            />
            <div v-else class="avatar fallback">{{ (profile.name || profile.email)[0]?.toUpperCase() }}</div>
            <p class="rating">Рейтинг: {{ profile.rating }}/5</p>
          </div>

          <form class="form-grid" @submit.prevent="saveProfile">
            <fieldset class="skills-field">
              <legend>Навыки</legend>
              <label v-for="skill in skillOptions" :key="skill.id" class="checkbox">
                <input v-model="profileForm.skills" type="checkbox" :value="skill.id" />
                {{ skill.label }}
              </label>
            </fieldset>

            <label>
              Имя
              <input v-model.trim="profileForm.name" type="text" maxlength="100" />
            </label>

            <label>
              Опыт (лет)
              <input v-model.number="profileForm.experienceYears" type="number" min="0" max="80" />
            </label>

            <label>
              Пол
              <select v-model="profileForm.gender">
                <option value="male">Мужской</option>
                <option value="female">Женский</option>
                <option value="other">Другой</option>
              </select>
            </label>

            <label>
              Фото (URL)
              <input
                v-model.trim="profileForm.photoUrl"
                type="text"
                placeholder="https://... или /uploads/..."
              />
            </label>
            <label>
              Фото (файл)
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                :disabled="uploadProfilePhotoLoading"
                @change="onProfilePhotoChange"
              />
            </label>
            <p v-if="uploadProfilePhotoLoading" class="notice">Загружаем фото...</p>

            <label v-if="isInstructorProfile" class="checkbox">
              <input v-model="profileForm.hasLicense" type="checkbox" />
              Лицензия инструктора
            </label>

            <p v-if="error" class="error">{{ error }}</p>
            <p v-if="notice" class="notice">{{ notice }}</p>
            <button class="primary" type="submit" :disabled="saveLoading">
              {{ saveLoading ? "Сохраняем..." : "Сохранить изменения" }}
            </button>
          </form>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
:global(body) {
  margin: 0;
  font-family: Inter, Segoe UI, Arial, sans-serif;
  background: #0b1020;
}

.page {
  min-height: 100vh;
  position: relative;
  overflow: hidden;
  color: #f5f7ff;
  padding: 28px 16px;
}

.container {
  max-width: 980px;
  margin: 0 auto;
  position: relative;
  z-index: 2;
}

.hero {
  margin-bottom: 18px;
}

.hero h1 {
  margin: 0 0 8px;
  font-size: 34px;
}

.hero p {
  margin: 0;
  color: #a7b0d6;
}

.panel {
  background: linear-gradient(160deg, rgba(27, 35, 69, 0.92), rgba(22, 28, 53, 0.9));
  border: 1px solid rgba(138, 158, 255, 0.28);
  border-radius: 20px;
  padding: 22px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(10px);
}

.tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 14px;
}

.tabs button {
  border: 1px solid rgba(169, 188, 255, 0.35);
  background: transparent;
  color: #dce3ff;
  border-radius: 10px;
  padding: 8px 14px;
  cursor: pointer;
}

.tabs button.active {
  background: linear-gradient(90deg, #5e7bff, #8f58ff);
  border-color: transparent;
  color: white;
}

.form-grid {
  display: grid;
  gap: 12px;
}

label,
fieldset {
  display: grid;
  gap: 6px;
  color: #d5ddff;
}

input,
select {
  border-radius: 10px;
  border: 1px solid rgba(170, 185, 255, 0.35);
  background: rgba(12, 17, 36, 0.8);
  color: #f7f9ff;
  padding: 10px 12px;
  font: inherit;
}

input:focus,
select:focus {
  outline: none;
  border-color: #8f9fff;
  box-shadow: 0 0 0 3px rgba(120, 145, 255, 0.25);
}

.skills-field {
  border: 1px solid rgba(170, 185, 255, 0.25);
  border-radius: 12px;
  padding: 8px 12px 12px;
}

.checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
}

.checkbox input {
  width: 16px;
  height: 16px;
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

.profile-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.profile-head h2 {
  margin: 4px 0 0;
}

.profile-email {
  margin: 4px 0 0;
  color: #a7b0d6;
}

.profile-actions {
  display: flex;
  gap: 8px;
}

.tag {
  margin: 0;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #9ab0ff;
}

.profile-layout {
  display: grid;
  gap: 18px;
  grid-template-columns: 200px 1fr;
}

.avatar-wrap {
  display: grid;
  gap: 8px;
  justify-items: center;
  align-content: start;
}

.avatar {
  width: 140px;
  height: 140px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid rgba(153, 169, 255, 0.55);
}

.preview {
  width: 88px;
  height: 88px;
}

.fallback {
  display: grid;
  place-items: center;
  font-size: 48px;
  background: linear-gradient(120deg, #587cff, #8f58ff);
}

.rating {
  margin: 0;
  color: #b8c5ff;
}

.notice {
  margin: 0;
  color: #82f4c6;
}

.error {
  margin: 0;
  color: #ff9ba5;
}

.glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(95px);
  opacity: 0.35;
}

.glow-a {
  width: 300px;
  height: 300px;
  background: #5c7cff;
  top: -90px;
  left: -70px;
}

.glow-b {
  width: 360px;
  height: 360px;
  background: #8f58ff;
  right: -120px;
  bottom: -130px;
}

@media (max-width: 760px) {
  .profile-layout {
    grid-template-columns: 1fr;
  }
}
</style>
