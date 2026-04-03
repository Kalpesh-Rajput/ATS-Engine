import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'
import { FileText, Loader2, Plus, Trash2, Upload, X } from 'lucide-react'
import { uploadService } from '../services/apiServices'

interface CandidateRow {
  id: string
  resume: File | null
  linkedin: File | null
}

function newRow(): CandidateRow {
  return { id: crypto.randomUUID(), resume: null, linkedin: null }
}

function FileDrop({
  label,
  file,
  onDrop,
  onRemove,
}: {
  label: string
  file: File | null
  onDrop: (f: File) => void
  onRemove: () => void
}) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    onDrop: (accepted) => accepted[0] && onDrop(accepted[0]),
  })

  if (file) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-brand-50 border border-brand-200 rounded-lg">
        <FileText className="w-4 h-4 text-brand-600 shrink-0" />
        <span className="text-xs text-brand-700 truncate flex-1">{file.name}</span>
        <button onClick={onRemove} className="text-slate-400 hover:text-red-500 transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div
      {...getRootProps()}
      className={`flex items-center gap-2 px-3 py-2 border-2 border-dashed rounded-lg cursor-pointer transition-colors
        ${isDragActive ? 'border-brand-400 bg-brand-50' : 'border-slate-200 hover:border-brand-300 hover:bg-slate-50'}`}
    >
      <input {...getInputProps()} />
      <Upload className="w-4 h-4 text-slate-400 shrink-0" />
      <span className="text-xs text-slate-400">{label}</span>
    </div>
  )
}

export default function UploadPage() {
  const navigate = useNavigate()
  const [jdFile, setJdFile] = useState<File | null>(null)
  const [jobTitle, setJobTitle] = useState('')
  const [rows, setRows] = useState<CandidateRow[]>([newRow()])
  const [loading, setLoading] = useState(false)

  const addRow = () => setRows((r) => [...r, newRow()])

  const updateRow = (id: string, field: 'resume' | 'linkedin', file: File | null) =>
    setRows((r) => r.map((row) => (row.id === id ? { ...row, [field]: file } : row)))

  const removeRow = (id: string) =>
    setRows((r) => (r.length === 1 ? r : r.filter((row) => row.id !== id)))

  const handleSubmit = async () => {
    if (!jdFile) return toast.error('Please upload a Job Description PDF')
    if (!jobTitle.trim()) return toast.error('Please enter a job title')

    const incomplete = rows.filter((r) => !r.resume || !r.linkedin)
    if (incomplete.length > 0)
      return toast.error('Every candidate needs both a resume and LinkedIn PDF')

    const form = new FormData()
    form.append('job_description', jdFile)
    form.append('job_title', jobTitle.trim())
    rows.forEach((r) => {
      form.append('resumes', r.resume!)
      form.append('linkedin_profiles', r.linkedin!)
    })

    setLoading(true)
    try {
      const job = await uploadService.uploadJob(form)
      toast.success(`Job submitted — ${rows.length} candidate(s) queued for scoring`)
      navigate(`/jobs/${job.id}`)
    } catch (err: any) {
      toast.error(err.response?.data?.detail ?? 'Upload failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const readyCount = rows.filter((r) => r.resume && r.linkedin).length

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">New Scoring Job</h1>
        <p className="text-slate-500 text-sm mt-1">
          Upload the job description and candidate files to start AI-powered scoring.
        </p>
      </div>

      {/* Step 1 — JD */}
      <div className="card p-6 space-y-4">
        <h2 className="font-semibold text-slate-800 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-brand-600 text-white text-xs flex items-center justify-center font-bold">1</span>
          Job Details
        </h2>

        <div>
          <label className="label">Job Title</label>
          <input
            className="input"
            placeholder="e.g. Senior Backend Engineer"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
          />
        </div>

        <div>
          <label className="label">Job Description (PDF)</label>
          <FileDrop
            label="Drop JD PDF here or click to browse"
            file={jdFile}
            onDrop={setJdFile}
            onRemove={() => setJdFile(null)}
          />
        </div>
      </div>

      {/* Step 2 — Candidates */}
      <div className="card p-6 space-y-4">
        <h2 className="font-semibold text-slate-800 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-brand-600 text-white text-xs flex items-center justify-center font-bold">2</span>
          Candidates
          <span className="ml-auto text-xs font-normal text-slate-500">
            {readyCount}/{rows.length} ready
          </span>
        </h2>

        {/* Column headers */}
        <div className="grid grid-cols-[1fr_1fr_auto] gap-3 text-xs font-medium text-slate-500 px-1">
          <span>Resume PDF</span>
          <span>LinkedIn Profile PDF</span>
          <span />
        </div>

        <div className="space-y-3">
          {rows.map((row, idx) => (
            <div key={row.id} className="grid grid-cols-[1fr_1fr_auto] gap-3 items-center">
              <FileDrop
                label={`Resume ${idx + 1}`}
                file={row.resume}
                onDrop={(f) => updateRow(row.id, 'resume', f)}
                onRemove={() => updateRow(row.id, 'resume', null)}
              />
              <FileDrop
                label={`LinkedIn ${idx + 1}`}
                file={row.linkedin}
                onDrop={(f) => updateRow(row.id, 'linkedin', f)}
                onRemove={() => updateRow(row.id, 'linkedin', null)}
              />
              <button
                onClick={() => removeRow(row.id)}
                disabled={rows.length === 1}
                className="text-slate-300 hover:text-red-400 transition-colors disabled:opacity-30"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <button onClick={addRow} className="btn-secondary text-xs">
          <Plus className="w-3.5 h-3.5" /> Add candidate
        </button>
      </div>

      {/* Submit */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {rows.length} candidate{rows.length !== 1 ? 's' : ''} · scoring takes ~30–60s per candidate
        </p>
        <button
          className="btn-primary px-6"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {loading ? 'Uploading…' : 'Start Scoring'}
        </button>
      </div>
    </div>
  )
}
