'use client'

import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createSupabaseBrowserClient } from '@/lib/db/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  PhoneCall,
  TrendingUp,
  XCircle,
  DollarSign,
  Download,
  Phone,
  Users,
  Hash,
  ChevronRight,
  Copy,
  AlertTriangle,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Classification {
  is_billable: boolean | null
  category: string | null
  service_type: string | null
  location: string | null
  intent: string | null
  reason: string | null
  disputed: boolean | null
  dispute_note: string | null
  classified_at: string | null
}

interface Call {
  id: string
  twilio_call_sid: string | null
  caller_number: string | null
  duration_sec: number | null
  recording_url: string | null
  started_at: string | null
  twilio_numbers: { label: string | null; number: string | null; campaign: string | null } | null
  clients: { id: string; name: string; payout_per_call: number | null } | null
  call_classifications: Classification | null
  call_transcripts: { transcript: string | null } | null
}

interface Client {
  id: string
  name: string
  email: string | null
  payout_per_call: number | null
  created_at: string
}

interface TwilioNumber {
  id: string
  number: string
  label: string | null
  campaign: string | null
  is_active: boolean
  clients: { id: string; name: string } | null
  created_at: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(sec: number | null): string {
  if (!sec) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const CATEGORY_CONFIG: Record<string, { bg: string; text: string; dot: string }> = {
  service_request: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  spam: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  agency: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  lead_vendor: { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500' },
  job_seeker: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  wrong_number: { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
  irrelevant_service: { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
}

function categoryBadge(cat: string | null) {
  if (!cat) return <span className="text-slate-400 text-xs">—</span>
  const cfg = CATEGORY_CONFIG[cat] ?? { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cat.replace(/_/g, ' ')}
    </span>
  )
}

// ─── Metric card ─────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  iconBg,
  iconColor,
  accent,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ElementType
  iconBg: string
  iconColor: string
  accent?: string
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className={`mt-2 text-3xl font-bold tracking-tight ${accent ?? 'text-slate-900'}`}>
            {value}
          </p>
          {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconBg}`}>
          <Icon size={18} className={iconColor} strokeWidth={2} />
        </div>
      </div>
    </div>
  )
}

// ─── Metrics ─────────────────────────────────────────────────────────────────

function MetricsCards({ calls }: { calls: Call[] }) {
  const total = calls.length
  const billable = calls.filter((c) => c.call_classifications?.is_billable).length
  const nonBillable = total - billable
  const revenue = calls.reduce((acc, c) => {
    if (c.call_classifications?.is_billable && c.clients?.payout_per_call) {
      return acc + c.clients.payout_per_call
    }
    return acc
  }, 0)

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <MetricCard
        label="Total Calls"
        value={total}
        icon={PhoneCall}
        iconBg="bg-indigo-50"
        iconColor="text-indigo-600"
      />
      <MetricCard
        label="Billable"
        value={billable}
        sub={total > 0 ? `${Math.round((billable / total) * 100)}% conversion` : undefined}
        icon={TrendingUp}
        iconBg="bg-emerald-50"
        iconColor="text-emerald-600"
        accent="text-emerald-600"
      />
      <MetricCard
        label="Non-Billable"
        value={nonBillable}
        icon={XCircle}
        iconBg="bg-red-50"
        iconColor="text-red-500"
        accent="text-red-500"
      />
      <MetricCard
        label="Est. Revenue"
        value={`$${revenue.toFixed(2)}`}
        icon={DollarSign}
        iconBg="bg-violet-50"
        iconColor="text-violet-600"
        accent="text-violet-700"
      />
    </div>
  )
}

// ─── Call detail dialog ───────────────────────────────────────────────────────

function CallDetailDialog({
  callId,
  open,
  onClose,
}: {
  callId: string | null
  open: boolean
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [disputeNote, setDisputeNote] = useState('')
  const [disputing, setDisputing] = useState(false)

  const { data: call, isLoading } = useQuery<Call>({
    queryKey: ['call', callId],
    queryFn: async () => {
      const res = await fetch(`/api/crm/calls/${callId}`)
      if (!res.ok) throw new Error('Failed to load call')
      return res.json()
    },
    enabled: !!callId && open,
  })

  const cls = call?.call_classifications

  const copyEvidence = useCallback(() => {
    if (!call) return
    const text = [
      `Call Date/Time: ${formatDate(call.started_at)}`,
      `Duration: ${formatDuration(call.duration_sec)}`,
      `Caller: ${call.caller_number ?? '—'}`,
      `Campaign: ${call.twilio_numbers?.label ?? '—'}`,
      `Classification: ${cls?.category ?? '—'}`,
      `Billable: ${cls?.is_billable ? 'Yes' : 'No'}`,
      `Reason: ${cls?.reason ?? '—'}`,
      '',
      'Transcript excerpt:',
      call.call_transcripts?.transcript?.slice(0, 500) ?? '(no transcript)',
    ].join('\n')
    navigator.clipboard.writeText(text)
  }, [call, cls])

  async function submitDispute() {
    if (!callId) return
    setDisputing(true)
    await fetch(`/api/crm/calls/${callId}/dispute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dispute_note: disputeNote }),
    })
    qc.invalidateQueries({ queryKey: ['calls'] })
    qc.invalidateQueries({ queryKey: ['call', callId] })
    setDisputing(false)
    setDisputeNote('')
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-2xl border-slate-200 p-0">
        <DialogHeader className="border-b border-slate-100 px-6 py-4">
          <DialogTitle className="text-base font-semibold">Call Detail</DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6 pt-4">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-32 w-full rounded-xl" />
            </div>
          ) : call ? (
            <div className="space-y-4 text-sm">
              {/* Metadata grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Date/Time', value: formatDate(call.started_at) },
                  { label: 'Duration', value: formatDuration(call.duration_sec) },
                  { label: 'Caller', value: call.caller_number ?? '—' },
                  { label: 'Campaign', value: call.twilio_numbers?.label ?? '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-400">{label}</p>
                    <p className="mt-0.5 font-semibold text-slate-800">{value}</p>
                  </div>
                ))}
              </div>

              {/* Classification */}
              {cls && (
                <div className="rounded-xl border border-slate-100 bg-white p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Classification
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {categoryBadge(cls.category)}
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                        cls.is_billable
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {cls.is_billable ? '✓ Billable' : '✗ Non-billable'}
                    </span>
                    {cls.intent && (
                      <span className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600">
                        {cls.intent}
                      </span>
                    )}
                    {cls.disputed && (
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                        Disputed
                      </span>
                    )}
                  </div>
                  {cls.service_type && (
                    <p className="mt-2 text-xs text-slate-500">
                      Service: <span className="font-medium">{cls.service_type}</span>
                    </p>
                  )}
                  {cls.location && (
                    <p className="text-xs text-slate-500">
                      Location: <span className="font-medium">{cls.location}</span>
                    </p>
                  )}
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">{cls.reason}</p>
                  {cls.dispute_note && (
                    <div className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                      <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                      {cls.dispute_note}
                    </div>
                  )}
                </div>
              )}

              {/* Recording */}
              {call.recording_url && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Recording
                  </p>
                  <audio controls className="w-full rounded-xl" src={call.recording_url} />
                </div>
              )}

              {/* Transcript */}
              {call.call_transcripts?.transcript && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Transcript
                  </p>
                  <pre className="max-h-44 overflow-y-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-700">
                    {call.call_transcripts.transcript}
                  </pre>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                <Button size="sm" variant="outline" className="gap-1.5 rounded-lg" onClick={copyEvidence}>
                  <Copy size={13} />
                  Copy Evidence
                </Button>
                {!cls?.disputed && (
                  <div className="flex w-full flex-col gap-2">
                    <Label htmlFor="dispute-note" className="text-xs font-medium text-slate-600">
                      Dispute this call
                    </Label>
                    <Textarea
                      id="dispute-note"
                      placeholder="Reason for dispute…"
                      value={disputeNote}
                      onChange={(e) => setDisputeNote(e.target.value)}
                      rows={2}
                      className="rounded-xl text-sm"
                    />
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={!disputeNote.trim() || disputing}
                      onClick={submitDispute}
                      className="rounded-lg"
                    >
                      {disputing ? 'Submitting…' : 'Submit Dispute'}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Call not found.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Calls table ─────────────────────────────────────────────────────────────

function CallsTable({ calls, onSelect }: { calls: Call[]; onSelect: (id: string) => void }) {
  if (calls.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
          <Phone size={22} className="text-slate-400" />
        </div>
        <p className="text-sm font-medium text-slate-600">No calls yet</p>
        <p className="mt-1 text-xs text-slate-400">Configure a Twilio number to start receiving calls</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="border-slate-100 bg-slate-50 hover:bg-slate-50">
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-400">Date</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-400">Caller</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-400">Campaign</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-400">Duration</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-400">Category</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-400">Billable</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {calls.map((call) => {
            const cls = call.call_classifications
            return (
              <TableRow
                key={call.id}
                className="cursor-pointer border-slate-50 transition-colors hover:bg-indigo-50/50"
                onClick={() => onSelect(call.id)}
              >
                <TableCell className="text-xs text-slate-600">{formatDate(call.started_at)}</TableCell>
                <TableCell className="font-mono text-xs text-slate-700">{call.caller_number ?? '—'}</TableCell>
                <TableCell className="text-xs text-slate-600">{call.twilio_numbers?.label ?? '—'}</TableCell>
                <TableCell className="text-xs font-medium text-slate-700">{formatDuration(call.duration_sec)}</TableCell>
                <TableCell>{categoryBadge(cls?.category ?? null)}</TableCell>
                <TableCell>
                  {cls === null ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400" />
                      Pending
                    </span>
                  ) : cls.is_billable ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                      ✓ Yes
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">
                      ✗ No
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <ChevronRight size={14} className="text-slate-300" />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

// ─── Clients tab ─────────────────────────────────────────────────────────────

function ClientsTab() {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [payout, setPayout] = useState('')

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: async () => {
      const res = await fetch('/api/crm/clients')
      return res.json()
    },
  })

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/crm/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email: email || null,
          payout_per_call: payout ? parseFloat(payout) : null,
        }),
      })
      if (!res.ok) throw new Error('Failed to add client')
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      setName('')
      setEmail('')
      setPayout('')
    },
  })

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <p className="mb-4 text-sm font-semibold text-slate-800">Add Client</p>
        <div className="flex flex-wrap gap-3">
          <Input
            placeholder="Client name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-48 rounded-xl"
          />
          <Input
            placeholder="Email (optional)"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-48 rounded-xl"
          />
          <Input
            placeholder="Payout / call ($)"
            type="number"
            step="0.01"
            value={payout}
            onChange={(e) => setPayout(e.target.value)}
            className="w-36 rounded-xl"
          />
          <Button
            onClick={() => addMutation.mutate()}
            disabled={!name.trim() || addMutation.isPending}
            size="sm"
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700"
          >
            Add Client
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-32 w-full rounded-2xl" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-400">Name</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-400">Email</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-400">Payout / call</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-400">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((c) => (
                <TableRow key={c.id} className="border-slate-50">
                  <TableCell className="font-medium text-slate-800">{c.name}</TableCell>
                  <TableCell className="text-sm text-slate-500">{c.email ?? '—'}</TableCell>
                  <TableCell>
                    {c.payout_per_call != null ? (
                      <span className="font-semibold text-emerald-600">${c.payout_per_call.toFixed(2)}</span>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="text-xs text-slate-400">
                    {new Date(c.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
              {clients.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-sm text-slate-400">
                    No clients yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

// ─── Numbers tab ─────────────────────────────────────────────────────────────

function NumbersTab({ clients }: { clients: Client[] }) {
  const qc = useQueryClient()
  const [number, setNumber] = useState('')
  const [label, setLabel] = useState('')
  const [campaign, setCampaign] = useState('')
  const [clientId, setClientId] = useState('')

  const { data: numbers = [], isLoading } = useQuery<TwilioNumber[]>({
    queryKey: ['numbers'],
    queryFn: async () => {
      const res = await fetch('/api/crm/numbers')
      return res.json()
    },
  })

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/crm/numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number,
          label,
          campaign: campaign || null,
          client_id: clientId || null,
        }),
      })
      if (!res.ok) throw new Error('Failed to add number')
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['numbers'] })
      setNumber('')
      setLabel('')
      setCampaign('')
      setClientId('')
    },
  })

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <p className="mb-4 text-sm font-semibold text-slate-800">Add Twilio Number</p>
        <div className="flex flex-wrap gap-3">
          <Input
            placeholder="+13055551234"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            className="w-40 rounded-xl font-mono"
          />
          <Input
            placeholder="Campaign label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-48 rounded-xl"
          />
          <Input
            placeholder="Campaign name (optional)"
            value={campaign}
            onChange={(e) => setCampaign(e.target.value)}
            className="w-48 rounded-xl"
          />
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">No client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <Button
            onClick={() => addMutation.mutate()}
            disabled={!number.trim() || !label.trim() || addMutation.isPending}
            size="sm"
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700"
          >
            Add Number
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-32 w-full rounded-2xl" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-400">Number</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-400">Label</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-400">Campaign</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-400">Client</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-400">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {numbers.map((n) => (
                <TableRow key={n.id} className="border-slate-50">
                  <TableCell className="font-mono text-sm font-medium text-slate-800">{n.number}</TableCell>
                  <TableCell className="text-sm text-slate-700">{n.label ?? '—'}</TableCell>
                  <TableCell className="text-sm text-slate-500">{n.campaign ?? '—'}</TableCell>
                  <TableCell className="text-sm">{n.clients?.name ?? '—'}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                        n.is_active
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${n.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                      {n.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
              {numbers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-slate-400">
                    No numbers yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CRMPage() {
  const qc = useQueryClient()
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null)

  const { data, isLoading } = useQuery<{ calls: Call[]; total: number }>({
    queryKey: ['calls'],
    queryFn: async () => {
      const res = await fetch('/api/crm/calls?limit=100')
      if (!res.ok) throw new Error('Failed to load calls')
      return res.json()
    },
  })

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: async () => {
      const res = await fetch('/api/crm/clients')
      return res.json()
    },
  })

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    const channel = supabase
      .channel('crm-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calls' }, () => {
        qc.invalidateQueries({ queryKey: ['calls'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'call_classifications' }, () => {
        qc.invalidateQueries({ queryKey: ['calls'] })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [qc])

  const calls = data?.calls ?? []

  return (
    <div className="min-h-screen p-8">
      {/* Page header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100">
              <PhoneCall size={14} className="text-indigo-600" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Pay-Per-Call CRM</h1>
          </div>
          <p className="text-sm text-slate-500">Track calls, classifications, and revenue in real time</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 rounded-xl border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
          onClick={() => { window.location.href = '/api/crm/export' }}
        >
          <Download size={14} />
          Export CSV
        </Button>
      </div>

      {/* Metrics */}
      {isLoading ? (
        <div className="mb-8 grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="mb-8">
          <MetricsCards calls={calls} />
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="calls">
        <TabsList className="mb-4 h-10 rounded-xl bg-slate-100 p-1">
          <TabsTrigger value="calls" className="flex items-center gap-1.5 rounded-lg text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Phone size={13} />
            Calls
          </TabsTrigger>
          <TabsTrigger value="clients" className="flex items-center gap-1.5 rounded-lg text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Users size={13} />
            Clients
          </TabsTrigger>
          <TabsTrigger value="numbers" className="flex items-center gap-1.5 rounded-lg text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Hash size={13} />
            Numbers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calls">
          {isLoading ? <Skeleton className="h-64 w-full rounded-2xl" /> : (
            <CallsTable calls={calls} onSelect={setSelectedCallId} />
          )}
        </TabsContent>

        <TabsContent value="clients">
          <ClientsTab />
        </TabsContent>

        <TabsContent value="numbers">
          <NumbersTab clients={clients} />
        </TabsContent>
      </Tabs>

      <CallDetailDialog
        callId={selectedCallId}
        open={!!selectedCallId}
        onClose={() => setSelectedCallId(null)}
      />
    </div>
  )
}
