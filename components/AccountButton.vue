<template>
  <UPopover mode="click" v-bind:open="popoverOpen" :popper="{ placement: 'bottom-start' }">
    <UAvatar icon="material-symbols:account-circle-full" />
    <template #panel>
      <div class="p-4">
        <AuthState v-slot="{ user }">
          <div v-if="user">
            <div class="flex items-center space-x-2">
              <UAvatar icon="material-symbols:account-circle-full" />
              <h2>{{ user.name }}</h2>
            </div>
            <UDivider class="py-2" />
            <div class="space-y-2">
              <UCheckbox label="Announce presence when spectating" />
              <UButton
                @click="logout"
                :label="!loading ? 'Log out' : 'Logging out...'"
                :loading="loading"
              />
            </div>
          </div>
          <div v-else>
            <h2>Log In</h2>
            <UDivider class="py-2" />
            <form @submit.prevent="login" class="space-y-2">
              <span class="text-sm text-red-600" v-if="loginError">{{ loginError }}</span>
              <UInput
                placeholder="Enter username..."
                v-model="credentials.username"
                :disabled="loading"
                required
              />
              <UInput
                type="password"
                placeholder="Enter password..."
                v-model="credentials.password"
                :disabled="loading"
                required
              />
              <UButton
                type="submit"
                :label="!loading ? 'Log in' : 'Logging in...'"
                :loading="loading"
              />
            </form>
          </div>
        </AuthState>
      </div>
    </template>
  </UPopover>
</template>

<script setup lang="ts">
const { $conn } = useNuxtApp();
const { loggedIn, fetch: refresh, clear } = useUserSession();
const loginError = ref("");
const loading = ref(false);
const popoverOpen = ref(!loggedIn);
const credentials = reactive({ username: "", password: "" });

const login = async () => {
  loading.value = true;
  try {
    await $fetch("/api/login", { method: "POST", body: credentials }).then(() => refresh());
    credentials.username = "";
    credentials.password = "";

    $conn.disconnect().connect();
  } catch (err) {
    loginError.value = "Login failed!";
  } finally {
    loading.value = false;
  }
};

const logout = async () => {
  await clear();
  $conn.disconnect().connect();
};
</script>
