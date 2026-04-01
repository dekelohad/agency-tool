'use client'

import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createSupabaseBrowserClient } from '@/lib/db/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  return new Date(iso).toLocaleString()
}

function categoryBadge(cat: string | null) {
  if (!cat) return <Badge variant="outline">—</Badge>
  const map: Record<string, string> = {
    service_request: 'bg-emerald-100 text-emerald-800',
    spam: 'bg-red-100 text-red-800',
    agency: 'bg-blue-100 text-blue-800',
    lead_vendor: 'bg-purple-100 text-purple-800',
    job_seeker: 'bg-amber-100 text-amber-800',
    wrong_number: 'bg-zinc-100 text-zinc-700',
    irrelevant_service: 'bg-orange-100 text-orange-800',
  }
  const cls = map[cat] ?? 'bg-zinc-100 text-zinc-700'
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {cat.replace(/_/g, ' ')}
    </span>
  )
}

// ─── Metrics card ─────────────────────────────────────────────────────────────

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

  const categories: Record<string, number> = {}
  calls.forEach((c) => {
    const cat = c.call_classifications?.category ?? 'unclassified'
    categories[cat] = (categories[cat] ?? 0) + 1
  })

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Card>
        <CardHeader className="pb-1 pt-4">
          <CardTitle className="text-xs font-medium text-zinc-500">Total Calls</CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <p className="text-2xl font-bold">{total}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-1 pt-4">
          <CardTitle className="text-xs font-medium text-zinc-500">Billable</CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <p className="text-2xl font-bold text-emerald-600">{billable}</p>
          <p className="text-xs text-zinc-400">{total > 0 ? Math.round((billable / total) * 100) : 0}% of total</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-1 pt-4">
          <CardTitle className="text-xs font-medium text-zinc-500">Non-Billable</CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <p className="text-2xl font-bold text-red-500">{nonBillable}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-1 pt-4">
          <CardTitle className="text-xs font-medium text-zinc-500">Est. Revenue</CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <p className="text-2xl font-bold">${revenue.toFixed(2)}</p>
        </CardContent>
      </Card>
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
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Call Detail</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : call ? (
          <div className="space-y-4 text-sm">
            {/* Metadata */}
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <div>
                <p className="text-xs text-zinc-500">Date/Time</p>
                <p className="font-medium">{formatDate(call.started_at)}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Duration</p>
                <p className="font-medium">{formatDuration(call.duration_sec)}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Caller</p>
                <p className="font-medium">{call.caller_number ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Campaign</p>
                <p className="font-medium">{call.twilio_numbers?.label ?? '—'}</p>
              </div>
            </div>

            {/* Classification */}
            {cls && (
              <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                <p className="mb-2 text-xs font-semibold uppercase text-zinc-500">Classification</p>
                <div className="flex flex-wrap items-center gap-2">
                  {categoryBadge(cls.category)}
                  <Badge variant={cls.is_billable ? 'default' : 'secondary'}>
                    {cls.is_billable ? 'Billable' : 'Non-billable'}
                  </Badge>
                  {cls.intent && <Badge variant="outline">{cls.intent}</Badge>}
                  {cls.disputed && <Badge className="bg-amber-100 text-amber-800">Disputed</Badge>}
                </div>
                {cls.service_type && (
                  <p className="mt-1 text-xs text-zinc-500">Service: {cls.service_type}</p>
                )}
                {cls.location && (
                  <p className="text-xs text-zinc-500">Location: {cls.location}</p>
                )}
                <p className="mt-2 text-zinc-700 dark:text-zinc-300">{cls.reason}</p>
                {cls.dispute_note && (
                  <p className="mt-1 rounded bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                    Dispute note: {cls.dispute_note}
                  </p>
                )}
              </div>
            )}

            {/* Recording */}
            {call.recording_url && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-zinc-500">Recording</p>
                <audio controls className="w-full" src={call.recording_url} />
              </div>
            )}

            {/* Transcript */}
            {call.call_transcripts?.transcript && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-zinc-500">Transcript</p>
                <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-900">
                  {call.call_transcripts.transcript}
                </pre>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
              <Button size="sm" variant="outline" onClick={copyEvidence}>
                Copy Evidence Package
              </Button>
              {!cls?.disputed && (
                <div className="flex w-full flex-col gap-2">
                  <Label htmlFor="dispute-note" className="text-xs">
                    Dispute this call
                  </Label>
                  <Textarea
                    id="dispute-note"
                    placeholder="Reason for dispute…"
                    value={disputeNote}
                    onChange={(e) => setDisputeNote(e.target.value)}
                    rows={2}
                  />
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={!disputeNote.trim() || disputing}
                    onClick={submitDispute}
                  >
                    {disputing ? 'Submitting…' : 'Submit Dispute'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">Call not found.</p>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Calls table ─────────────────────────────────────────────────────────────

function CallsTable({ calls, onSelect }: { calls: Call[]; onSelect: (id: string) => void }) {
  if (calls.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 p-8 text-center text-sm text-zinc-500 dark:border-zinc-800">
        No calls yet. Configure a Twilio number to start receiving calls.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Caller</TableHead>
            <TableHead>Campaign</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Billable</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {calls.map((call) => {
            const cls = call.call_classifications
            return (
              <TableRow
                key={call.id}
                className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900"
                onClick={() => onSelect(call.id)}
              >
                <TableCell className="text-xs">{formatDate(call.started_at)}</TableCell>
                <TableCell className="text-xs">{call.caller_number ?? '—'}</TableCell>
                <TableCell className="text-xs">{call.twilio_numbers?.label ?? '—'}</TableCell>
                <TableCell className="text-xs">{formatDuration(call.duration_sec)}</TableCell>
                <TableCell>{categoryBadge(cls?.category ?? null)}</TableCell>
                <TableCell>
                  {cls === null ? (
                    <span className="text-xs text-zinc-400">Pending</span>
                  ) : cls.is_billable ? (
                    <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Yes</Badge>
                  ) : (
                    <Badge variant="secondary">No</Badge>
                  )}
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
      {/* Add client form */}
      <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <p className="mb-3 text-sm font-medium">Add Client</p>
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Client name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-48"
          />
          <Input
            placeholder="Email (optional)"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-48"
          />
          <Input
            placeholder="Payout / call ($)"
            type="number"
            step="0.01"
            value={payout}
            onChange={(e) => setPayout(e.target.value)}
            className="w-36"
          />
          <Button
            onClick={() => addMutation.mutate()}
            disabled={!name.trim() || addMutation.isPending}
            size="sm"
          >
            Add
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Payout / call</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-sm text-zinc-500">{c.email ?? '—'}</TableCell>
                  <TableCell>
                    {c.payout_per_call != null ? `$${c.payout_per_call.toFixed(2)}` : '—'}
                  </TableCell>
                  <TableCell className="text-xs text-zinc-400">
                    {new Date(c.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
              {clients.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-zinc-500">
                    No clients yet.
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
      <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <p className="mb-3 text-sm font-medium">Add Twilio Number</p>
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="+13055551234"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            className="w-40"
          />
          <Input
            placeholder="Campaign label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-48"
          />
          <Input
            placeholder="Campaign name (optional)"
            value={campaign}
            onChange={(e) => setCampaign(e.target.value)}
            className="w-48"
          />
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
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
          >
            Add
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {numbers.map((n) => (
                <TableRow key={n.id}>
                  <TableCell className="font-mono text-sm">{n.number}</TableCell>
                  <TableCell>{n.label ?? '—'}</TableCell>
                  <TableCell className="text-sm text-zinc-500">{n.campaign ?? '—'}</TableCell>
                  <TableCell className="text-sm">{n.clients?.name ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant={n.is_active ? 'default' : 'secondary'}>
                      {n.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {numbers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-zinc-500">
                    No numbers yet.
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

  // Realtime subscription
  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    const channel = supabase
      .channel('crm-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calls' }, () => {
        qc.invalidateQueries({ queryKey: ['calls'] })
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'call_classifications' },
        () => {
          qc.invalidateQueries({ queryKey: ['calls'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [qc])

  const calls = data?.calls ?? []

  function handleExport() {
    window.location.href = '/api/crm/export'
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Pay-Per-Call CRM</h1>
          <p className="text-sm text-zinc-500">Track calls, classifications, and revenue</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport}>
          Export CSV
        </Button>
      </div>

      {/* Metrics */}
      {isLoading ? (
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <MetricsCards calls={calls} />
      )}

      {/* Tabs */}
      <Tabs defaultValue="calls">
        <TabsList>
          <TabsTrigger value="calls">Calls</TabsTrigger>
          <TabsTrigger value="clients">Clients</TabsTrigger>
          <TabsTrigger value="numbers">Numbers</TabsTrigger>
        </TabsList>

        <TabsContent value="calls" className="mt-4">
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <CallsTable calls={calls} onSelect={setSelectedCallId} />
          )}
        </TabsContent>

        <TabsContent value="clients" className="mt-4">
          <ClientsTab />
        </TabsContent>

        <TabsContent value="numbers" className="mt-4">
          <NumbersTab clients={clients} />
        </TabsContent>
      </Tabs>

      {/* Call detail dialog */}
      <CallDetailDialog
        callId={selectedCallId}
        open={!!selectedCallId}
        onClose={() => setSelectedCallId(null)}
      />
    </div>
  )
}
