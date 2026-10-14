// Builds a CSV from a header row + data rows and hands it to the browser as a
// download. Cells are quoted so commas/quotes in fund names stay intact.
export function exportCsv(filename, header, rows) {
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
