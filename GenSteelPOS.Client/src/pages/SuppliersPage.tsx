import { useMemo } from 'react'
import { DataState } from '../components/DataState'
import { PageFrame } from '../components/PageFrame'
import { useApiMutation } from '../hooks/useApiMutation'
import { useApiData } from '../hooks/useApiData'
import { usePersistentState } from '../hooks/usePersistentState'
import { api } from '../lib/api'
import type { Supplier } from '../types/entities'

export function SuppliersPage() {
  const { data, isLoading, error, refetch } = useApiData<Supplier[]>('/suppliers', [])
  const mutation = useApiMutation()
  const [form, setForm] = usePersistentState('suppliers-form', {
    name: '',
    contactPerson: '',
    contactNumber: '',
    email: '',
    address: '',
  })
  const supplierSummary = useMemo(() => {
    const activeCount = data.filter((supplier) => supplier.isActive).length
    const withEmail = data.filter((supplier) => Boolean(supplier.email)).length
    const withPhone = data.filter((supplier) => Boolean(supplier.contactNumber)).length
    return { activeCount, withEmail, withPhone }
  }, [data])

  return (
    <PageFrame
      title="Suppliers"
      description="Supplier records used by stock receiving reports. Adding a supplier here does not change inventory."
    >
      <div className="stats-grid compact-stats">
        <div className="stat-card">
          <span>Total Suppliers</span>
          <strong>{data.length}</strong>
        </div>
        <div className="stat-card">
          <span>Active</span>
          <strong>{supplierSummary.activeCount}</strong>
        </div>
        <div className="stat-card">
          <span>With Email</span>
          <strong>{supplierSummary.withEmail}</strong>
        </div>
        <div className="stat-card">
          <span>With Contact Number</span>
          <strong>{supplierSummary.withPhone}</strong>
        </div>
      </div>

      <div className="panel stack-form">
        <h4>Create Supplier</h4>
        <div className="subtle-panel">
          Supplier setup is allowed here because receiving needs a source. Stock quantities still
          wait for owner approval when encoded by Cashier.
        </div>
        {mutation.error ? <div className="error-panel">{mutation.error}</div> : null}
        {mutation.success ? <div className="subtle-panel">{mutation.success}</div> : null}
        <div className="mini-grid">
          <label className="field">
            <span>Name</span>
            <input
              value={form.name}
              placeholder="Supplier or company name"
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
            />
          </label>
          <label className="field">
            <span>Contact Person</span>
            <input
              value={form.contactPerson}
              placeholder="Optional"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  contactPerson: event.target.value,
                }))
              }
            />
          </label>
        </div>
        <div className="mini-grid">
          <label className="field">
            <span>Contact Number</span>
            <input
              value={form.contactNumber}
              placeholder="Optional"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  contactNumber: event.target.value,
                }))
              }
            />
          </label>
          <label className="field">
            <span>Email</span>
            <input
              value={form.email}
              placeholder="Optional"
              onChange={(event) =>
                setForm((current) => ({ ...current, email: event.target.value }))
              }
            />
          </label>
        </div>
        <label className="field">
          <span>Address</span>
          <input
            value={form.address}
            placeholder="Optional"
            onChange={(event) =>
              setForm((current) => ({ ...current, address: event.target.value }))
            }
          />
        </label>
        <button
          className="primary-button"
          type="button"
          disabled={mutation.isSubmitting}
          onClick={async () => {
            const saved = await mutation.run(
              () => api.post('/suppliers', form),
              'Supplier created.',
            )
            if (saved) {
              setForm({
                name: '',
                contactPerson: '',
                contactNumber: '',
                email: '',
                address: '',
              })
              await refetch()
            }
          }}
        >
          Create Supplier
        </button>
      </div>

      <DataState
        isLoading={isLoading}
        error={error}
        emptyMessage="No suppliers found."
        hasData={data.length > 0}
      />

      {data.length > 0 ? (
        <div className="panel table-panel">
          <table>
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Contact Person</th>
                <th>Contact Details</th>
                <th>Address</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map((supplier) => (
                <tr key={supplier.id}>
                  <td>
                    <div className="table-title-cell">
                      <strong>{supplier.name}</strong>
                      <span>{supplier.email || 'No email address'}</span>
                    </div>
                  </td>
                  <td>{supplier.contactPerson || 'No contact person'}</td>
                  <td>{supplier.contactNumber || 'No contact number'}</td>
                  <td>{supplier.address || 'No address recorded'}</td>
                  <td>
                    <span className={supplier.isActive ? 'status-badge in' : 'status-badge out'}>
                      {supplier.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </PageFrame>
  )
}
