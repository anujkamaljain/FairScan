import SectionCard from '../components/common/SectionCard'

function DashboardPage() {
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Platform Overview</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Initial architecture scaffold for fairness workflows, model audits, and compliance reporting.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SectionCard
          title="Datasets"
          description="Upload and manage candidate datasets before running bias analysis pipelines."
        />
        <SectionCard
          title="Bias Reports"
          description="Track generated fairness metrics and findings across model versions."
        />
        <SectionCard
          title="Audit Logs"
          description="Maintain immutable activity records for governance and accountability."
        />
      </div>
    </section>
  )
}

export default DashboardPage
