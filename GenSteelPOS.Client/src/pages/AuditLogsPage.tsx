import { DataState } from '../components/DataState'
import { PageFrame } from '../components/PageFrame'
import { useApiData } from '../hooks/useApiData'
import type { AuditLog } from '../types/entities'

export function AuditLogsPage() {
  const { data, isLoading, error } = useApiData<AuditLog[]>('/audit-logs', [])

  return (
    <PageFrame
      title="Audit Logs"
      description="Read-only owner trace of important product, inventory, sales, and user account actions."
    >
      <div className="subtle-panel">
        Audit logs are read-only. They cannot be edited or deleted from the system.
      </div>

      <DataState
        isLoading={isLoading}
        error={error}
        emptyMessage="No audit log entries found."
        hasData={data.length > 0}
      />

      {data.length > 0 ? (
        <div className="table-panel audit-table-panel">
          <table>
            <thead>
              <tr>
                <th>Date/Time</th>
                <th>User</th>
                <th>Role</th>
                <th>Action</th>
                <th>Module</th>
                <th>Record</th>
                <th>Old Value</th>
                <th>New Value</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {data.map((log) => (
                <tr key={log.id}>
                  <td>{new Date(log.createdAtUtc).toLocaleString()}</td>
                  <td>{log.username}</td>
                  <td>{log.role}</td>
                  <td>
                    <strong>{log.action}</strong>
                  </td>
                  <td>{log.module}</td>
                  <td>{log.record}</td>
                  <td className="audit-value-cell">{log.oldValue}</td>
                  <td className="audit-value-cell">{log.newValue}</td>
                  <td className="audit-details-cell">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </PageFrame>
  )
}
