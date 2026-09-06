'use client'

// Keep this independent of providers and styles: the root layout itself may have failed.
export default function GlobalError() {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: '#f6f7f2',
          color: '#1b2b23',
          fontFamily: 'sans-serif',
          fontSize: '18px',
          lineHeight: 1.6,
        }}
      >
        <main style={{ maxWidth: 600, margin: '10vh auto', padding: '32px 24px' }}>
          <h1 style={{ fontSize: '2rem', lineHeight: 1.25 }}>Ummah Coop could not open.</h1>
          <p>
            Please reload the page. If the problem continues, contact your cooperative
            administrator.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              font: 'inherit',
              padding: '12px 24px',
              background: '#265b40',
              color: '#fff',
              border: 0,
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            Reload page
          </button>
          <p>If you were saving a change, check its status before submitting again.</p>
        </main>
      </body>
    </html>
  )
}
