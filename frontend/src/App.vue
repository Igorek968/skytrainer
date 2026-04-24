<script setup>
import { computed, ref } from "vue";

const TOKEN_KEY = "skytrainer_jwt";

const form = ref({
  email: "",
  password: "",
  role: "user",
  skills: [],
  experienceYears: 0,
  hasLicense: false,
  gender: "male",
  photoUrl: "",
});

const profile = ref(null);
const jwtToken = ref(localStorage.getItem(TOKEN_KEY) ?? "");
const error = ref("");
const reviewAuthor = ref("");
const reviewText = ref("");
const reviewScore = ref(5);

const skillOptions = [
  { id: "snowboard", label: "Сноуборд" },
  { id: "ski", label: "Лыжник" },
];

const isInstructor = computed(() => form.value.role === "instructor");

const roleLabel = computed(() =>
  profile.value?.role === "instructor" ? "Инструктор" : "Пользователь",
);

const averageRating = computed(() => {
  if (!profile.value?.reviews?.length) {
    return 0;
  }

  const total = profile.value.reviews.reduce((sum, item) => sum + item.score, 0);
  return (total / profile.value.reviews.length).toFixed(1);
});

function toggleAllSkills() {
  if (form.value.skills.length === skillOptions.length) {
    form.value.skills = [];
    return;
  }

  form.value.skills = skillOptions.map((option) => option.id);
}

function createJwt(payload) {
  const header = { alg: "HS256", typ: "JWT" };
  const encode = (obj) =>
    btoa(unescape(encodeURIComponent(JSON.stringify(obj))))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  const now = Math.floor(Date.now() / 1000);
  const body = {
    ...payload,
    iat: now,
    exp: now + 60 * 60 * 24,
  };

  const encodedHeader = encode(header);
  const encodedBody = encode(body);
  const signature = btoa(`${encodedHeader}.${encodedBody}.skytrainer-secret`)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return `${encodedHeader}.${encodedBody}.${signature}`;
}

function submitRegistration() {
  error.value = "";

  if (!form.value.email || !form.value.password) {
    error.value = "Email и пароль обязательны.";
    return;
  }

  if (!form.value.skills.length) {
    error.value = "Выберите хотя бы один профессиональный навык.";
    return;
  }

  const profileData = {
    email: form.value.email,
    role: form.value.role,
    skills: [...form.value.skills],
    experienceYears: Number(form.value.experienceYears),
    gender: form.value.gender,
    photoUrl: form.value.photoUrl.trim(),
    hasLicense: isInstructor.value ? form.value.hasLicense : null,
    reviews: [
      {
        id: crypto.randomUUID(),
        author: "Мария",
        score: 5,
        text: "Отличная коммуникация и безопасное обучение.",
      },
      {
        id: crypto.randomUUID(),
        author: "Иван",
        score: 4,
        text: "Понятно объясняет технику и ошибки.",
      },
    ],
  };

  const token = createJwt({
    sub: profileData.email,
    role: profileData.role,
    skills: profileData.skills,
  });

  jwtToken.value = token;
  localStorage.setItem(TOKEN_KEY, token);
  profile.value = profileData;
}

function addReview() {
  if (!profile.value) {
    return;
  }

  if (!reviewAuthor.value.trim() || !reviewText.value.trim()) {
    return;
  }

  profile.value.reviews.unshift({
    id: crypto.randomUUID(),
    author: reviewAuthor.value.trim(),
    score: Number(reviewScore.value),
    text: reviewText.value.trim(),
  });

  reviewAuthor.value = "";
  reviewText.value = "";
  reviewScore.value = 5;
}
</script>

<template>
  <main>
    <h1>SkyTrainer</h1>

    <section class="card">
      <h2>Регистрация по email</h2>
      <form class="form" @submit.prevent="submitRegistration">
        <label>
          Email
          <input v-model.trim="form.email" type="email" required />
        </label>

        <label>
          Пароль
          <input v-model="form.password" type="password" required minlength="6" />
        </label>

        <label>
          Категория
          <select v-model="form.role">
            <option value="instructor">Инструктор</option>
            <option value="user">Пользователь</option>
          </select>
        </label>

        <fieldset>
          <legend>Профессиональные навыки</legend>
          <div class="skills">
            <label v-for="skill in skillOptions" :key="skill.id">
              <input v-model="form.skills" type="checkbox" :value="skill.id" />
              {{ skill.label }}
            </label>
          </div>
          <button class="secondary" type="button" @click="toggleAllSkills">
            Выбрать все сразу
          </button>
        </fieldset>

        <label>
          Опыт (лет)
          <input v-model.number="form.experienceYears" type="number" min="0" />
        </label>

        <label v-if="isInstructor">
          <input v-model="form.hasLicense" type="checkbox" />
          Наличие лицензии
        </label>

        <label>
          Пол
          <select v-model="form.gender">
            <option value="male">Мужской</option>
            <option value="female">Женский</option>
            <option value="other">Другой</option>
          </select>
        </label>

        <label>
          Фото (URL)
          <input v-model.trim="form.photoUrl" type="url" placeholder="https://..." />
        </label>

        <p v-if="error" class="error">{{ error }}</p>
        <button type="submit">Зарегистрироваться</button>
      </form>
    </section>

    <section v-if="profile" class="card">
      <h2>Профиль</h2>
      <img
        v-if="profile.photoUrl"
        class="avatar"
        :src="profile.photoUrl"
        alt="Фото пользователя"
      />
      <p><strong>Email:</strong> {{ profile.email }}</p>
      <p><strong>Категория:</strong> {{ roleLabel }}</p>
      <p>
        <strong>Навыки:</strong>
        {{ profile.skills.includes("snowboard") ? "Сноуборд" : "" }}
        {{ profile.skills.includes("ski") ? (profile.skills.includes("snowboard") ? ", Лыжник" : "Лыжник") : "" }}
      </p>
      <p><strong>Опыт:</strong> {{ profile.experienceYears }} лет</p>
      <p><strong>Пол:</strong> {{ profile.gender }}</p>
      <p v-if="profile.role === 'instructor'">
        <strong>Лицензия:</strong>
        {{ profile.hasLicense ? "Есть" : "Нет" }}
      </p>

      <p><strong>JWT:</strong> <code>{{ jwtToken }}</code></p>

      <h3>Рейтинг: {{ averageRating }}/5</h3>

      <form class="review-form" @submit.prevent="addReview">
        <label>
          Автор отзыва
          <input v-model="reviewAuthor" type="text" />
        </label>
        <label>
          Оценка
          <input v-model.number="reviewScore" type="number" min="1" max="5" />
        </label>
        <label>
          Текст отзыва
          <textarea v-model="reviewText" rows="3"></textarea>
        </label>
        <button type="submit">Добавить отзыв</button>
      </form>

      <ul class="reviews">
        <li v-for="review in profile.reviews" :key="review.id">
          <strong>{{ review.author }}</strong> — {{ review.score }}/5
          <p>{{ review.text }}</p>
        </li>
      </ul>
    </section>
  </main>
</template>

<style scoped>
main {
  max-width: 880px;
  margin: 2rem auto;
  font-family: Arial, sans-serif;
  color: #1d1d1f;
}

h1 {
  margin-bottom: 1rem;
}

.card {
  border: 1px solid #d9d9dd;
  border-radius: 12px;
  padding: 1rem 1.2rem;
  margin-bottom: 1rem;
  background: #fff;
}

.form,
.review-form {
  display: grid;
  gap: 0.8rem;
}

label,
fieldset {
  display: grid;
  gap: 0.35rem;
}

input,
select,
textarea,
button {
  font: inherit;
  padding: 0.5rem 0.55rem;
}

.skills {
  display: flex;
  gap: 0.8rem;
  flex-wrap: wrap;
}

.secondary {
  width: fit-content;
  background: #fff;
  border: 1px solid #bdbdc7;
}

.avatar {
  width: 96px;
  height: 96px;
  object-fit: cover;
  border-radius: 50%;
  margin-bottom: 0.6rem;
}

.reviews {
  list-style: none;
  padding: 0;
  margin: 1rem 0 0;
  display: grid;
  gap: 0.7rem;
}

.reviews li {
  border: 1px solid #ececf1;
  border-radius: 10px;
  padding: 0.6rem;
}

.reviews p {
  margin: 0.3rem 0 0;
}

.error {
  color: #bf1212;
  margin: 0;
}

code {
  display: inline-block;
  max-width: 100%;
  overflow-wrap: anywhere;
}
</style>
