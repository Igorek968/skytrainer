<script setup>
import { onMounted, ref } from "vue";

const apiMessage = ref("Loading...");

onMounted(async () => {
  try {
    const response = await fetch("http://localhost:8000/api/message");
    const data = await response.json();
    apiMessage.value = data.message;
  } catch (error) {
    apiMessage.value = "Could not connect to backend";
  }
});
</script>

<template>
  <main>
    <h1>SkyTrainer</h1>
    <p>{{ apiMessage }}</p>
  </main>
</template>

<style scoped>
main {
  font-family: Arial, sans-serif;
  margin: 2rem;
}

h1 {
  margin-bottom: 1rem;
}
</style>
