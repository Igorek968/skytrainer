<script setup>
defineProps({
  isAuthenticated: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["register", "login", "openProfile"]);
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
