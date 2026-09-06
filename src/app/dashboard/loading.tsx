export default function DashboardLoading() {
  return (
    <section className="workspace-loading" role="status" aria-live="polite" aria-busy="true">
      <p className="text-lg font-semibold">Loading your page...</p>
      <p className="mt-2 text-muted-foreground">Getting the latest records.</p>
      <div className="loading-placeholder" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </section>
  )
}
