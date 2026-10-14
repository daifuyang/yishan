declare module 'weui.js' {
  interface Item { label: string; value: number }
  interface Options {
    id: string
    className: string
    container: HTMLElement
    title: string
    defaultValue: number[]
    onConfirm: (result: Item[]) => void
    onClose: () => void
  }
  const weui: {
    picker: {
      (items: Item[], options: Options): HTMLElement & { hide: () => void }
      (hours: Item[], minutes: Item[], options: Options): HTMLElement & { hide: () => void }
    }
    datePicker: (options: Options & { start: string; end: string }) => HTMLElement & { hide: () => void }
  }
  export default weui
}
