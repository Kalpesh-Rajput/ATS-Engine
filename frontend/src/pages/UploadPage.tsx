import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import {
  FileText,
  Loader2,
  Plus,
  Trash2,
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  User,
  Linkedin,
} from 'lucide-react'
import { uploadService } from '../services/apiServices'
import { Button } from '../components/common/Button'
import { Card, CardHeader } from '../components/common/Card'
import { Input } from '../components/common/Input'
import { Badge } from '../components/common/Badge'

interface CandidateRow {
  id: string
  resume: File | null
  linkedin: File | null
}

function newRow(): CandidateRow {
  return { id: crypto.randomUUID(), resume: null, linkedin: null }
}

interface FileDropProps {
  label: string
  sublabel: string
  file: File | null
  onDrop: (f: File) => void
  onRemove: () => void
  icon: React.ReactNode
}

function FileDrop({ label, sublabel, file, onDrop, onRemove, icon }: FileDropProps) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    onDrop: (accepted) => accepted[0] && onDrop(accepted[0]),
  })

  if (file) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-success-50 border border-success-200 rounded-xl">
        <CheckCircle2 className="w-5 h-5 text-success-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-success-900 truncate">{file.name}</p>
          <p className="text-xs text-success-700">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
        </div>
        <button
          onClick={onRemove}
          className="p-1.5 rounded-lg text-success-600 hover:bg-success-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <div
      {...getRootProps()}
      className={`flex items-center gap-3 px-4 py-3 border-2 border-dashed rounded-xl cursor-pointer transition-all
        ${
          isDragActive
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-200 hover:border-primary-400 hover:bg-gray-50'
        }`}
    >
      <input {...getInputProps()} />
      <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-700">{label}</p>
        <p className="text-xs text-gray-500">{sublabel}</p>
      </div>
      <Upload className="w-5 h-5 text-gray-400" />
    </div>
  )
}

export default function UploadPage() {
  const navigate = useNavigate()
  const userRole = useAuthStore((s) => s.userRole)
  const baseRole = userRole === 'admin' ? '/admin' : '/user'

  const [jdFile, setJdFile] = useState<File | null>(null)
  const [jdText, setJdText] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [clientName, setClientName] = useState('')
  const [rows, setRows] = useState<CandidateRow[]>([newRow()])
  const [loading, setLoading] = useState(false)

  const addRow = () => setRows((r) => [...r, newRow()])
  const updateRow = (id: string, field: 'resume' | 'linkedin', value: File | null) =>
    setRows((r) => r.map((row) => (row.id === id ? { ...row, [field]: value } : row)))
  const removeRow = (id: string) =>
    setRows((r) => (r.length === 1 ? r : r.filter((row) => row.id !== id)))

  const handleSubmit = async () => {
    if (!jdFile && !jdText.trim()) {
      return toast.error('Please upload or paste the Job Description')
    }
    if (!jobTitle.trim()) return toast.error('Please enter a job title')
    if (!clientName.trim()) return toast.error('Please enter a client name')

    const incomplete = rows.filter((r) => !r.resume || !r.linkedin)
    if (incomplete.length > 0) {
      return toast.error('Every candidate needs both a resume and LinkedIn PDF')
    }

    const form = new FormData()
    const sessionName = `${clientName.trim()} - ${jobTitle.trim()}`
    form.append('job_description', jdFile!)
    form.append('session_name', sessionName)
    form.append('job_title', jobTitle.trim())
    form.append('client_name', clientName.trim())
    if (jdText.trim()) {
      form.append('job_description_text', jdText.trim())
    }

    rows.forEach((r) => {
      if (r.resume) form.append('resumes', r.resume)
      if (r.linkedin) form.append('linkedin_profiles', r.linkedin)
    })

    setLoading(true)
    try {
      const job = await uploadService.uploadJob(form)
      toast.success(`Session created! ${rows.length} candidate(s) processing...`)
      navigate(`${baseRole}/jobs/${job.id}`)
    } catch (err: any) {
      toast.error(err.response?.data?.detail ?? 'Upload failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const readyCount = rows.filter((r) => r.resume && r.linkedin).length
  const totalSize = rows.reduce((acc, r) => {
    let size = 0
    if (r.resume) size += r.resume.size
    if (r.linkedin) size += r.linkedin.size
    return acc + size
  }, 0)

  return (
    <div className="h-screen bg-gray-50 overflow-y-auto">
      <div className="max-w-5xl mx-auto p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Create New Session</h1>
            <p className="text-sm text-gray-500 mt-1">
              Upload a job description and candidate profiles to start AI scoring
            </p>
          </div>
          <Button variant="ghost" onClick={() => navigate(`${baseRole}/dashboard`)}>
            Cancel
          </Button>
        </div>

        {/* Step 1: Job Details */}
        <Card padding="lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-bold text-sm">
              1
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Job Details</h2>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <Input
              label="Job Title"
              placeholder="e.g. Senior Backend Engineer"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              required
            />
            <Input
              label="Client Name"
              placeholder="e.g. Acme Corporation"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-4">
            <label className="label">Job Description</label>
            <div className="grid grid-cols-2 gap-4">
              <FileDrop
                label="Upload PDF"
                sublabel="Drag & drop or click to browse"
                file={jdFile}
                onDrop={setJdFile}
                onRemove={() => setJdFile(null)}
                icon={<FileText className="w-5 h-5 text-gray-500" />}
              />
              <div className="relative">
                <textarea
                  value={jdText}
                  onChange={(e) => setJdText(e.target.value)}
                  placeholder="Or paste the job description text here..."
                  rows={4}
                  className="input resize-none h-full min-h-[88px]"
                />
              </div>
            </div>
            {!jdFile && !jdText && (
              <p className="text-xs text-gray-500 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                Either upload a PDF or paste the job description text
              </p>
            )}
          </div>
        </Card>

        {/* Step 2: Candidates */}
        <Card padding="lg">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-bold text-sm">
                2
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Candidate Profiles</h2>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={readyCount === rows.length ? 'success' : 'gray'}>
                {readyCount}/{rows.length} Ready
              </Badge>
            </div>
          </div>

          {/* Column Headers */}
          <div className="grid grid-cols-[1fr_1fr_auto] gap-4 mb-3 px-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">
              <User className="w-4 h-4" />
              Resume PDF
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">
              <Linkedin className="w-4 h-4" />
              LinkedIn Profile PDF
            </div>
            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              Action
            </div>
          </div>

          {/* Candidate Rows */}
          <div className="space-y-3 mb-6">
            {rows.map((row, idx) => (
              <div key={row.id} className="grid grid-cols-[1fr_1fr_auto] gap-4 items-center">
                <FileDrop
                  label={`Resume ${idx + 1}`}
                  sublabel={row.resume?.name || 'PDF required'}
                  file={row.resume}
                  onDrop={(f) => updateRow(row.id, 'resume', f)}
                  onRemove={() => updateRow(row.id, 'resume', null)}
                  icon={<User className="w-5 h-5 text-gray-500" />}
                />
                <FileDrop
                  label={`LinkedIn ${idx + 1}`}
                  sublabel={row.linkedin?.name || 'PDF required'}
                  file={row.linkedin}
                  onDrop={(f) => updateRow(row.id, 'linkedin', f)}
                  onRemove={() => updateRow(row.id, 'linkedin', null)}
                  icon={<Linkedin className="w-5 h-5 text-gray-500" />}
                />
                <button
                  onClick={() => removeRow(row.id)}
                  disabled={rows.length === 1}
                  className="p-2.5 rounded-xl text-gray-400 hover:text-error-600 hover:bg-error-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Remove candidate"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>

          <Button variant="secondary" onClick={addRow} className="w-full">
            <Plus className="w-4 h-4" />
            Add Another Candidate
          </Button>
        </Card>

        {/* Submit Bar */}
        <div className="sticky bottom-0 bg-white border border-gray-200 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {rows.length} candidate{rows.length !== 1 ? 's' : ''}
                </p>
                <p className="text-xs text-gray-500">
                  {readyCount} ready • ~30-60s per candidate
                </p>
              </div>
              {totalSize > 0 && (
                <Badge variant="gray">
                  {(totalSize / 1024 / 1024).toFixed(1)} MB total
                </Badge>
              )}
            </div>
            <Button
              onClick={handleSubmit}
              disabled={
                loading || !jdFile || !jobTitle || !clientName || readyCount === 0
              }
              isLoading={loading}
              leftIcon={<Upload className="w-4 h-4" />}
            >
              {loading ? 'Creating Session...' : 'Create Session'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
