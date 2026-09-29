import { reactive } from 'vue'

export const ui = reactive({ flash: '' })

let timer: ReturnType<typeof setTimeout> | undefined

export function flash(message: string): void {
  ui.flash = message
  clearTimeout(timer)
  timer = setTimeout(() => {
    ui.flash = ''
  }, 5000)
}
