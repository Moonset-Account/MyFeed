<script setup lang="ts">
import { ref } from 'vue'
import { project, addRoom, removeRoom, addItem, removeItem } from '../store'

const newRoomName = ref('')
const newItemNames = ref<Record<string, string>>({})

function submitRoom() {
  const name = newRoomName.value.trim()
  if (!name) return
  addRoom(name)
  newRoomName.value = ''
}

function submitItem(roomId: string) {
  const name = (newItemNames.value[roomId] ?? '').trim()
  if (!name) return
  addItem(roomId, name)
  newItemNames.value[roomId] = ''
}

function confirmRemoveRoom(roomId: string, name: string) {
  if (window.confirm(`确定删除房间「${name}」及其全部检查记录吗？`)) {
    removeRoom(roomId)
  }
}
</script>

<template>
  <section class="room-manager">
    <h2>房间与设施管理</h2>
    <p class="hint">房间和设施在入住、退租两次检查中共用，删除会同时清除两次检查中的对应记录。</p>
    <div class="room-def" v-for="room in project.rooms" :key="room.id">
      <div class="room-def-head">
        <input type="text" v-model="room.name" class="room-name-input" />
        <button type="button" class="btn-link danger" @click="confirmRemoveRoom(room.id, room.name)">
          删除房间
        </button>
      </div>
      <ul class="item-def-list">
        <li v-for="item in room.items" :key="item.id">
          <input type="text" v-model="item.name" />
          <button type="button" class="btn-link danger" @click="removeItem(room.id, item.id)">
            删除
          </button>
        </li>
      </ul>
      <div class="add-row">
        <input
          type="text"
          v-model="newItemNames[room.id]"
          placeholder="新设施名称"
          @keyup.enter="submitItem(room.id)"
        />
        <button type="button" class="btn" @click="submitItem(room.id)">添加设施</button>
      </div>
    </div>
    <div class="add-row">
      <input
        type="text"
        v-model="newRoomName"
        placeholder="新房间名称，如：次卧"
        @keyup.enter="submitRoom"
      />
      <button type="button" class="btn primary" @click="submitRoom">添加房间</button>
    </div>
  </section>
</template>
