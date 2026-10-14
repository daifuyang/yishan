/** WeUI renders labels as HTML; preserve option text without interpreting user-managed names. */
export function selectorPickerItems(labels: readonly string[]) {
  const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
  return labels.map((label, value) => ({
    label: label.replace(/[&<>"']/g, (character) => entities[character]),
    value,
  }))
}
