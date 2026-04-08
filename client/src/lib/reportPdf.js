import { jsPDF } from 'jspdf'

const PAGE = {
  width: 210,
  height: 297,
  marginX: 16,
  marginTop: 18,
  marginBottom: 16
}

const normalizeList = (value) => {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item || '').trim()).filter(Boolean)
}

const normalizeMetaEntries = (meta = {}) =>
  Object.entries(meta)
    .map(([key, value]) => [String(key || '').trim(), String(value ?? '').trim()])
    .filter(([key, value]) => key && value)

export function exportReportPdf({
  report,
  title = 'FairScan Bias Audit Report',
  subtitle = 'Generated report',
  generatedFor = 'FairScan workspace',
  meta = {}
}) {
  if (!report || typeof report !== 'object') {
    throw new Error('No report content available for PDF export.')
  }

  const overview = String(report.overview || '').trim()
  const keyFindings = normalizeList(report.key_findings)
  const riskAssessment = String(report.risk_assessment || '').trim()
  const recommendations = normalizeList(report.recommendations)
  if (!overview && !keyFindings.length && !riskAssessment && !recommendations.length) {
    throw new Error('Report is empty. Generate report before exporting.')
  }

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const now = new Date()
  const generatedAt = now.toLocaleString()
  let y = PAGE.marginTop

  const ensureSpace = (required = 8) => {
    if (y + required <= PAGE.height - PAGE.marginBottom) return
    doc.addPage()
    y = PAGE.marginTop
  }

  const writeWrapped = (text, fontSize = 11, lineGap = 5.4) => {
    const value = String(text || '').trim()
    if (!value) return
    doc.setFontSize(fontSize)
    const lines = doc.splitTextToSize(value, PAGE.width - PAGE.marginX * 2)
    lines.forEach((line) => {
      ensureSpace(lineGap)
      doc.text(line, PAGE.marginX, y)
      y += lineGap
    })
  }

  const writeHeading = (text, level = 1) => {
    ensureSpace(9)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(level === 1 ? 18 : 13.5)
    doc.text(String(text), PAGE.marginX, y)
    y += level === 1 ? 9 : 7
    doc.setFont('helvetica', 'normal')
  }

  const writeBulletList = (items) => {
    items.forEach((item) => {
      const wrapped = doc.splitTextToSize(String(item), PAGE.width - PAGE.marginX * 2 - 6)
      ensureSpace(5.4)
      doc.setFontSize(11)
      doc.text('\u2022', PAGE.marginX, y)
      doc.text(wrapped[0], PAGE.marginX + 4, y)
      y += 5.4
      wrapped.slice(1).forEach((line) => {
        ensureSpace(5.4)
        doc.text(line, PAGE.marginX + 4, y)
        y += 5.4
      })
    })
  }

  const writeMeta = () => {
    const entries = normalizeMetaEntries(meta)
    if (!entries.length) return
    ensureSpace(8)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    doc.text('Metadata', PAGE.marginX, y)
    y += 5.5
    doc.setFont('helvetica', 'normal')
    entries.forEach(([key, value]) => {
      ensureSpace(5)
      doc.setFontSize(10)
      doc.text(`${key}: ${value}`, PAGE.marginX, y)
      y += 5
    })
  }

  // Header
  writeHeading('FairScan', 1)
  doc.setFontSize(13)
  doc.text(String(title), PAGE.marginX, y)
  y += 7
  doc.setFontSize(10.5)
  doc.setTextColor(75, 85, 99)
  doc.text(String(subtitle), PAGE.marginX, y)
  y += 5.5
  doc.text(`Generated for: ${generatedFor}`, PAGE.marginX, y)
  y += 5
  doc.text(`Generated at: ${generatedAt}`, PAGE.marginX, y)
  y += 4
  doc.setTextColor(17, 24, 39)

  ensureSpace(4)
  doc.setDrawColor(203, 213, 225)
  doc.line(PAGE.marginX, y, PAGE.width - PAGE.marginX, y)
  y += 7

  writeMeta()

  writeHeading('Overview', 2)
  writeWrapped(overview || 'Overview unavailable.')
  y += 2

  writeHeading('Key Findings', 2)
  if (keyFindings.length) {
    writeBulletList(keyFindings)
  } else {
    writeWrapped('No key findings were provided.')
  }
  y += 2

  writeHeading('Risk Assessment', 2)
  writeWrapped(riskAssessment || 'Risk assessment unavailable.')
  y += 2

  writeHeading('Recommendations', 2)
  if (recommendations.length) {
    writeBulletList(recommendations)
  } else {
    writeWrapped('No recommendations were provided.')
  }

  const pageCount = doc.getNumberOfPages()
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page)
    doc.setFontSize(9)
    doc.setTextColor(100, 116, 139)
    doc.text(`Page ${page} of ${pageCount}`, PAGE.width - PAGE.marginX - 20, PAGE.height - 8)
  }

  const timestamp = now.toISOString().replace(/[:.]/g, '-')
  const fileName = `fairscan-report-${timestamp}.pdf`
  doc.save(fileName)
}
