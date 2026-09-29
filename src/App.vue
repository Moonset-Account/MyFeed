<script setup lang="ts">
import { computed, ref } from 'vue';
import { state } from './store';
import HomeView from './components/HomeView.vue';
import TripView from './components/TripView.vue';

const currentTripId = ref<string | null>(null);
const currentTrip = computed(() => state.trips.find((t) => t.id === currentTripId.value) ?? null);

function openTrip(id: string): void {
  currentTripId.value = id;
}

function goHome(): void {
  currentTripId.value = null;
}
</script>

<template>
  <TripView v-if="currentTrip" :trip="currentTrip" @back="goHome" @open="openTrip" />
  <HomeView v-else @open="openTrip" />
</template>
