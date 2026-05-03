import { useMemo, useState } from 'react'
import { DataState } from '../components/DataState'
import { PageFrame } from '../components/PageFrame'
import { useApiData } from '../hooks/useApiData'
import type { StockMovement } from '../types/entities'

export function StockMovementsPage() {
  const { data, isLoading, error } = useApiData<StockMovement[]>('/stock-movements', [])
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('All')

  const filteredData = useMemo(() => {
    const query = search.trim().toLowerCase()

    return data.filter((movement) => {
      const matchesSearch =
        !query ||
        movement.productName.toLowerCase().includes(query) ||
        movement.sku.toLowerCase().includes(query) ||
        movement.referenceNo.toLowerCase().includes(query) ||
        movement.performedByName.toLowerCase().includes(query)

      const matchesType = typeFilter === 'All' || movement.movementType === typeFilter

      return matchesSearch && matchesType
    })
  }, [data, search, typeFilter])

  const movementTypes = ['All', ...new Set(data.map((item) => item.movementType))]

  return (
    <PageFrame
      title="Stock Movements"
      description="Inventory movement history for stock-in, sales, refunds, cancellations, returns, and manual adjustments."
    >
      <div className="panel inline-form">
        <label className="field search-field">
          <span>Search Movements</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search product, code, type, or reference"
          />
        </label>
        <label className="field">
          <span>Movement Type</span>
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            {movementTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <div className="subtle-panel panel-note">{filteredData.length} visible movement(s)</div>
      </div>

      <DataState
        isLoading={isLoading}
        error={error}
        emptyMessage="No stock movement records found."
        hasData={filteredData.length > 0}
      />

      {filteredData.length > 0 ? (
        <div className="panel table-panel">
          <table>
            <thead>
              <tr>
                <th>Created At</th>
                <th>Product</th>
                <th>Type</th>
                <th>Change</th>
                <th>Before</th>
                <th>After</th>
                <th>Reference ID</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((movement) => (
                <tr key={movement.id}>
                  <td>{new Date(movement.createdAtUtc).toLocaleString()}</td>
                  <td>
                    {movement.productName}
                    <br />
                    <span className="muted">Product Code: {movement.sku}</span>
                  </td>
                  <td>{movement.movementType}</td>
                  <td>{movement.quantityChanged}</td>
                  <td>{movement.previousQuantity}</td>
                  <td>{movement.newQuantity}</td>
                  <td>{movement.referenceNo || '-'}</td>
                  <td>{movement.performedByName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </PageFrame>
  )
}
