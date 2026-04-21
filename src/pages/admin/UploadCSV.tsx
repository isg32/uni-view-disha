import { useState, useRef, type DragEvent, type ChangeEvent } from 'react'
import Papa from 'papaparse'

const GAS_PROXY = '/api/gas-proxy'

interface ParsedCSV {
  headers: string[]
  rows: Record<string, unknown>[]
  fileName: string
}

export default function UploadCSV() {
  const [parsed, setParsed] = useState<ParsedCSV | null>(null)
  const [slug, setSlug] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const parseFile = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setStatus({ type: 'error', msg: 'Please upload a .csv file.' })
      return
    }
    setStatus(null)
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const headers = result.meta.fields ?? []
        setParsed({ headers, rows: result.data as Record<string, unknown>[], fileName: file.name })
      },
      error: (err) => setStatus({ type: 'error', msg: err.message }),
    })
  }

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) parseFile(file)
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) parseFile(file)
  }

  const handleUpload = async () => {
    if (!parsed || !slug.trim()) {
      setStatus({ type: 'error', msg: 'Please select a CSV file and enter a university slug.' })
      return
    }

    setUploading(true)
    setStatus(null)

    try {
      const payload = {
        action: 'importSheet',
        data: {
          id: `${slug.trim()}-${Date.now()}`,
          name: parsed.fileName,
          targetSlug: slug.trim().toLowerCase(),
          uploadedAt: new Date().toISOString(),
          headers: parsed.headers,
          rows: parsed.rows,
        },
      }

      const res = await fetch(GAS_PROXY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const text = await res.text()
      const json = JSON.parse(text)

      if (json.success) {
        setStatus({ type: 'success', msg: `✅ Uploaded ${json.rowCount} rows to sheet "${json.sheetName}"` })
        setParsed(null)
        setSlug('')
        if (fileRef.current) fileRef.current.value = ''
      } else {
        setStatus({ type: 'error', msg: json.error ?? 'Upload failed.' })
      }
    } catch (err) {
      setStatus({ type: 'error', msg: `Network error: ${String(err)}` })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Upload CSV</h1>
        <p>Import a CSV file and assign it to a university. This replaces existing data for that slug.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, maxWidth: 900 }}>
        {/* Left: drop zone */}
        <div className="card">
          <div className="card-title">1. Choose File</div>
          <div
            className={`dropzone ${dragOver ? 'drag-over' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={onFileChange}
              style={{ display: 'none' }}
            />
            <div className="dropzone-icon">📂</div>
            <div className="dropzone-text">Drop CSV here or click to browse</div>
            <div className="dropzone-hint">Only .csv files are accepted</div>
            {parsed && (
              <div className="dropzone-file" onClick={e => e.stopPropagation()}>
                📄 {parsed.fileName} — {parsed.rows.length} rows, {parsed.headers.length} columns
              </div>
            )}
          </div>
        </div>

        {/* Right: config */}
        <div className="card">
          <div className="card-title">2. Assign University</div>

          <div className="form-group">
            <label className="form-label" htmlFor="slug-input">University Slug</label>
            <input
              id="slug-input"
              className="form-input"
              type="text"
              placeholder="e.g. iimahmedabad"
              value={slug}
              onChange={e => setSlug(e.target.value)}
            />
            <span className="form-hint">
              Must match the <code>universitySlug</code> in the user's Clerk metadata.
              The sheet tab will be named exactly this.
            </span>
          </div>

          {parsed && (
            <div className="alert alert-info" style={{ marginBottom: 16 }}>
              <span>🗂</span>
              <span>
                <strong>{parsed.rows.length}</strong> rows ready ·{' '}
                <strong>{parsed.headers.length}</strong> columns:{' '}
                {parsed.headers.slice(0, 4).join(', ')}{parsed.headers.length > 4 ? '…' : ''}
              </span>
            </div>
          )}

          <button
            id="btn-upload"
            className="btn btn-primary"
            style={{ width: '100%' }}
            disabled={!parsed || !slug.trim() || uploading}
            onClick={handleUpload}
          >
            {uploading ? '⏳ Uploading…' : '⬆ Upload to Google Sheets'}
          </button>

          {status && (
            <div className={`alert alert-${status.type}`}>
              {status.msg}
            </div>
          )}
        </div>
      </div>

      {/* Preview table */}
      {parsed && parsed.rows.length > 0 && (
        <div className="card" style={{ marginTop: 24 }}>
          <div className="card-title">Preview (first 5 rows)</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>{parsed.headers.map(h => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {parsed.rows.slice(0, 5).map((row, i) => (
                  <tr key={i}>
                    {parsed.headers.map(h => <td key={h}>{String(row[h] ?? '')}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
