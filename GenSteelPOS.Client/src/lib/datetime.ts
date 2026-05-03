const manilaDateTimeFormatter = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

const manilaDateFormatter = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function normalizeApiDate(value: string) {
  return /z$|[+-]\d{2}:\d{2}$/i.test(value) ? value : `${value}Z`
}

export function parseApiDate(value: string) {
  return new Date(normalizeApiDate(value))
}

export function formatDateTime(value: string) {
  return manilaDateTimeFormatter.format(parseApiDate(value))
}

export function formatDate(value: string) {
  return manilaDateFormatter.format(parseApiDate(value))
}
