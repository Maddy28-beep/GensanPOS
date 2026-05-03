interface DataStateProps {
  isLoading: boolean
  error: string | null
  emptyMessage: string
  hasData: boolean
}

export function DataState({
  isLoading,
  error,
  emptyMessage,
  hasData,
}: DataStateProps) {
  if (isLoading) {
    return (
      <div className="panel data-state data-state-loading">
        <strong>Loading data</strong>
        <span>Pulling the latest records from the API.</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="panel data-state data-state-error">
        <strong>Unable to load records</strong>
        <span>{error}</span>
      </div>
    )
  }

  if (!hasData) {
    return (
      <div className="panel data-state data-state-empty">
        <strong>Nothing to show yet</strong>
        <span>{emptyMessage}</span>
      </div>
    )
  }

  return null
}
