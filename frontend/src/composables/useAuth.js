import { ref, computed } from "vue";
import { apiJson } from "../api/http.js";
import { TOKEN_KEY } from "../config.js";

const user = ref(null);

export function useAuth() {
  const hydrated = ref(false);

  async function hydrate() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      user.value = null;
      hydrated.value = true;
      return;
    }
    try {
      user.value = await apiJson("/auth/me");
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      user.value = null;
    }
    hydrated.value = true;
  }

  async function login(payload) {
    const data = await apiJson("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    localStorage.setItem(TOKEN_KEY, data.token);
    await hydrate();
    return data;
  }

  async function register(payload) {
    const data = await apiJson("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    localStorage.setItem(TOKEN_KEY, data.token);
    await hydrate();
    return data;
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    user.value = null;
  }

  const isClient = computed(() => user.value?.role === "client");
  const isInstructor = computed(() => user.value?.role === "instructor");

  return {
    user,
    hydrated,
    hydrate,
    login,
    register,
    logout,
    isClient,
    isInstructor
  };
}
