interface StatCardProps {
  label: string
  value: string
  tone?: 'default' | 'alert'
}

export function StatCard({ label, value, tone = 'default' }: StatCardProps) {
  return (
    <article className={`stat-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}
