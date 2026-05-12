import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useOrderStore = defineStore('order', {
  state: () => ({
    step: 1,
    isModalVisible: false,
  }),
  actions: {
    toggleModal() {
      this.isModalVisible = !this.isModalVisible
    },
    openModal() {
      this.isModalVisible = true
    },
    openModalOnStep(step: number) {
      this.step = step
      this.isModalVisible = true
    },
    nextStep() {
      this.step++
    },
    prevStep() {
      this.step--
    },
    resetToFirstStep() {
      this.step = 1
    },
  },
})
