import { onUnmounted, watch, nextTick } from 'vue'
import { useCategoryStore } from '@/stores/category.store'

export function useScrollSpy<T extends { length: number } | boolean | null | undefined>(
  selector: string,
  dependency?: () => T,
) {
  const categoryStore = useCategoryStore()
  let observer: IntersectionObserver | null = null

  const stop = () => {
    observer?.disconnect()
    observer = null
  }

  const start = () => {
    stop()
    const elements = document.querySelectorAll(selector)
    if (elements.length === 0) return

    observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries.filter((entry) => entry.isIntersecting)

        if (visibleEntries.length > 0) {
          const sorted = visibleEntries.sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          )
          const firstVisible = sorted[0]

          if (firstVisible && categoryStore.activeCategoryId !== firstVisible.target.id) {
            categoryStore.activeCategoryId = firstVisible.target.id
          }
        }
      },
      {
        rootMargin: '-20% 0px -60% 0px',
        threshold: 0,
      },
    )

    elements.forEach((el) => observer?.observe(el))
  }

  if (dependency) {
    watch(
      dependency,
      async (val) => {
        const hasData = Array.isArray(val) || typeof val === 'string' ? val.length > 0 : !!val

        if (hasData) {
          await nextTick()
          start()
        }
      },
      { immediate: true },
    )
  }

  onUnmounted(() => stop())

  return { start }
}
