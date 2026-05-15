import Link from 'next/link';

export interface EntityTableColumn<T> {
  header: string;
  cell: (row: T) => React.ReactNode;
  width?: string;
}

export interface EntityTableProps<T> {
  rows: T[];
  columns: EntityTableColumn<T>[];
  /** Function returning the action URL for a given row (typically edit). */
  editHref: (row: T) => string;
  /** Action link label. Defaults to "Edit →". Override for read-only contexts (e.g. "View in portal →"). */
  actionLabel?: string;
  /** Empty-state message. */
  emptyMessage?: string;
}

export function EntityTable<T>({
  rows,
  columns,
  editHref,
  actionLabel = 'Edit →',
  emptyMessage = 'No rows yet.',
}: EntityTableProps<T>) {
  if (rows.length === 0) {
    return (
      <p
        style={{
          fontFamily: 'var(--font-family-body)',
          fontSize: 'var(--body-sm)',
          color: 'var(--text-secondary)',
          padding: 'var(--padding-lg)',
          backgroundColor: 'var(--surface-primary)',
          borderRadius: 'var(--border-radius-md)',
          margin: 0,
        }}
      >
        {emptyMessage}
      </p>
    );
  }

  return (
    <div
      style={{
        backgroundColor: 'var(--surface-primary)',
        borderRadius: 'var(--border-radius-md)',
        border: 'var(--border-width-md) solid var(--border-primary)',
        overflow: 'hidden',
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-family-body)' }}>
        <thead>
          <tr style={{ backgroundColor: 'var(--surface-secondary)' }}>
            {columns.map((col) => (
              <th
                key={col.header}
                style={{
                  textAlign: 'left',
                  padding: 'var(--padding-sm) var(--padding-md)',
                  fontFamily: 'var(--font-family-label)',
                  fontSize: 'var(--label-sm)',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  width: col.width,
                }}
              >
                {col.header}
              </th>
            ))}
            <th style={{ width: '120px' }} aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              style={{
                borderTop:
                  i === 0 ? 'none' : 'var(--border-width-md) solid var(--border-primary)',
              }}
            >
              {columns.map((col) => (
                <td
                  key={col.header}
                  style={{
                    padding: 'var(--padding-sm) var(--padding-md)',
                    fontSize: 'var(--body-sm)',
                    color: 'var(--text-primary)',
                  }}
                >
                  {col.cell(row)}
                </td>
              ))}
              <td style={{ padding: 'var(--padding-sm) var(--padding-md)', textAlign: 'right' }}>
                {(() => {
                  const href = editHref(row);
                  const isExternal = /^https?:\/\//.test(href);
                  const linkStyle = {
                    fontFamily: 'var(--font-family-label)',
                    fontSize: 'var(--label-sm)',
                    color: 'var(--text-link)',
                    textDecoration: 'none',
                  };
                  return isExternal ? (
                    <a href={href} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                      {actionLabel}
                    </a>
                  ) : (
                    <Link href={href} style={linkStyle}>
                      {actionLabel}
                    </Link>
                  );
                })()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
