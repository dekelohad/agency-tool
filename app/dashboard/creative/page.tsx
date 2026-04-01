'use client'

import { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Sparkles, Plus, Trash2, Copy, Check, ChevronDown, ChevronRight, History, Wand2 } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LandingCopy {
  headline: string
  subhead: string
  bullets: string[]
  cta: string
}

interface AdCreative {
  id: string
  brief_id: string
  format: string
  hook: string | null
  primary_text: string | null
  headline: string | null
  cta: string | null
  image_concept: string | null
  video_concept: string | null
  storyboard: string | null
  shot_list: string[] | null
  landing_copy: LandingCopy | null
  ab_variant: string | null
  created_at: string
  creative_briefs: { niche: string; target_audience: string } | null
}

// ─── Form schema ──────────────────────────────────────────────────────────────

const GenerateSchema = z.object({
  niche: z.string().min(1, 'Required'),
  target_audience: z.string().min(1, 'Required'),
  problem_clusters: z
    .array(z.object({ value: z.string().min(1) }))
    .min(1, 'Add at least one problem'),
})

type GenerateForm = z.infer<typeof GenerateSchema>

// ─── Variant config ───────────────────────────────────────────────────────────

const VARIANT_CONFIG: Record<string, { gradient: string; badge: string; label: string; icon: string }> = {
  A: {
    gradient: 'from-indigo-500 to-violet-600',
    badge: 'bg-indigo-100 text-indigo-700',
    label: 'Pain Angle',
    icon: '🎯',
  },
  B: {
    gradient: 'from-violet-500 to-purple-600',
    badge: 'bg-violet-100 text-violet-700',
    label: 'Curiosity Angle',
    icon: '🔮',
  },
  C: {
    gradient: 'from-emerald-500 to-teal-600',
    badge: 'bg-emerald-100 text-emerald-700',
    label: 'Social Proof',
    icon: '⭐',
  },
}

// ─── Ad card ─────────────────────────────────────────────────────────────────

function AdCreativeCard({ ad }: { ad: AdCreative }) {
  const [showLanding, setShowLanding] = useState(false)
  const [copied, setCopied] = useState(false)
  const variant = ad.ab_variant ?? 'A'
  const cfg = VARIANT_CONFIG[variant] ?? VARIANT_CONFIG['A']

  function copyAd() {
    const text = [
      `[Variant ${variant}] ${ad.format?.toUpperCase()} AD`,
      '',
      `Hook: ${ad.hook}`,
      '',
      `Primary Text:`,
      ad.primary_text,
      '',
      `Headline: ${ad.headline}`,
      `CTA: ${ad.cta}`,
    ]
      .filter((l) => l !== undefined)
      .join('\n')
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      {/* Variant header */}
      <div className={`bg-gradient-to-r ${cfg.gradient} px-5 py-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{cfg.icon}</span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">Variant {variant}</span>
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                  {ad.format}
                </span>
              </div>
              <p className="text-xs text-white/70">{cfg.label}</p>
            </div>
          </div>
          <button
            onClick={copyAd}
            className="flex items-center gap-1.5 rounded-lg bg-white/20 px-3 py-1.5 text-xs font-medium text-white transition-all hover:bg-white/30"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 space-y-4 p-5 text-sm">
        {ad.hook && (
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Hook</p>
            <p className="text-base font-bold leading-snug text-slate-900">{ad.hook}</p>
          </div>
        )}

        {ad.primary_text && (
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Primary Text</p>
            <p className="leading-relaxed text-slate-600">{ad.primary_text}</p>
          </div>
        )}

        <div className="flex items-start gap-4">
          {ad.headline && (
            <div className="flex-1">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Headline</p>
              <p className="font-semibold text-slate-800">{ad.headline}</p>
            </div>
          )}
          {ad.cta && (
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">CTA</p>
              <span className="inline-flex rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm shadow-indigo-200">
                {ad.cta}
              </span>
            </div>
          )}
        </div>

        {ad.image_concept && (
          <div className="rounded-xl bg-slate-50 px-3.5 py-3">
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Visual Concept</p>
            <p className="text-xs leading-relaxed text-slate-600">{ad.image_concept}</p>
          </div>
        )}

        {ad.shot_list && ad.shot_list.length > 0 && (
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Shot List</p>
            <ol className="space-y-1">
              {ad.shot_list.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-500">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[9px] font-bold text-slate-500">
                    {i + 1}
                  </span>
                  {s}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      {/* Landing copy toggle */}
      <div className="border-t border-slate-100 px-5 pb-4 pt-3">
        <button
          onClick={() => setShowLanding(!showLanding)}
          className="flex w-full items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
        >
          {showLanding ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          Landing Page Copy
        </button>

        {showLanding && ad.landing_copy && (
          <div className="mt-3 space-y-2 rounded-xl bg-indigo-50/60 p-4">
            <p className="font-bold text-slate-900">{ad.landing_copy.headline}</p>
            <p className="text-sm leading-relaxed text-slate-600">{ad.landing_copy.subhead}</p>
            <ul className="space-y-1">
              {ad.landing_copy.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
                  {b}
                </li>
              ))}
            </ul>
            <span className="inline-flex rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white">
              {ad.landing_copy.cta}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Generated set ────────────────────────────────────────────────────────────

function GeneratedCreativesView({ briefId }: { briefId: string }) {
  const { data: ads = [], isLoading } = useQuery<AdCreative[]>({
    queryKey: ['ads', briefId],
    queryFn: async () => {
      const res = await fetch(`/api/creative/generate?brief_id=${briefId}`)
      if (!res.ok) throw new Error('Failed to load ads')
      return res.json()
    },
    refetchInterval: (query) => {
      const data = query.state.data
      return data && data.length > 0 ? false : 3000
    },
  })

  if (isLoading || ads.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50 px-5 py-4">
          <div className="h-2 w-2 animate-pulse rounded-full bg-indigo-500" />
          <p className="text-sm font-medium text-indigo-700">Generating creatives… this takes ~15 seconds</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-96 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">{ads.length} variants generated</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {ads.map((ad) => (
          <AdCreativeCard key={ad.id} ad={ad} />
        ))}
      </div>
    </div>
  )
}

// ─── History tab ─────────────────────────────────────────────────────────────

function HistoryTab({ onSelect }: { onSelect: (briefId: string) => void }) {
  const { data: ads = [], isLoading } = useQuery<AdCreative[]>({
    queryKey: ['ads-history'],
    queryFn: async () => {
      const res = await fetch('/api/creative/generate')
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
  })

  const briefs = ads.reduce<Record<string, AdCreative[]>>((acc, ad) => {
    if (!acc[ad.brief_id]) acc[ad.brief_id] = []
    acc[ad.brief_id].push(ad)
    return acc
  }, {})

  if (isLoading) return <Skeleton className="h-32 w-full rounded-2xl" />

  if (Object.keys(briefs).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
          <History size={22} className="text-slate-400" />
        </div>
        <p className="text-sm font-medium text-slate-600">No generated creatives yet</p>
        <p className="mt-1 text-xs text-slate-400">Generate your first creative set to see history</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {Object.entries(briefs).map(([briefId, briefAds]) => {
        const first = briefAds[0]
        return (
          <button
            key={briefId}
            onClick={() => onSelect(briefId)}
            className="flex w-full items-center justify-between rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-sm transition-all hover:border-indigo-200 hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50">
                <Sparkles size={15} className="text-indigo-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{first.creative_briefs?.niche ?? '—'}</p>
                <p className="text-xs text-slate-400">{first.creative_briefs?.target_audience ?? ''}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                {briefAds.length} variants
              </span>
              <span className="text-xs text-slate-400">
                {new Date(first.created_at).toLocaleDateString()}
              </span>
              <ChevronRight size={14} className="text-slate-300" />
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CreativePage() {
  const qc = useQueryClient()
  const [activeBriefId, setActiveBriefId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('generate')

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<GenerateForm>({
    resolver: zodResolver(GenerateSchema),
    defaultValues: {
      problem_clusters: [{ value: '' }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'problem_clusters' })

  const generateMutation = useMutation({
    mutationFn: async (values: GenerateForm) => {
      const res = await fetch('/api/creative/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          niche: values.niche,
          target_audience: values.target_audience,
          problem_clusters: values.problem_clusters.map((p) => p.value),
        }),
      })
      if (!res.ok) throw new Error('Generation failed')
      return res.json() as Promise<{ briefId: string; jobId: string }>
    },
    onSuccess: (data) => {
      setActiveBriefId(data.briefId)
      setActiveTab('results')
      qc.invalidateQueries({ queryKey: ['ads-history'] })
    },
  })

  return (
    <div className="min-h-screen p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="mb-1 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100">
            <Sparkles size={14} className="text-violet-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Creative Factory</h1>
        </div>
        <p className="text-sm text-slate-500">Generate ad creatives, copy, and A/B testing plans with AI</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6 h-10 rounded-xl bg-slate-100 p-1">
          <TabsTrigger value="generate" className="flex items-center gap-1.5 rounded-lg text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Wand2 size={13} />
            Generate
          </TabsTrigger>
          <TabsTrigger
            value="results"
            disabled={!activeBriefId}
            className="flex items-center gap-1.5 rounded-lg text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <Sparkles size={13} />
            Results
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-1.5 rounded-lg text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <History size={13} />
            History
          </TabsTrigger>
        </TabsList>

        {/* Generate tab */}
        <TabsContent value="generate">
          <div className="max-w-xl">
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <form onSubmit={handleSubmit((v) => generateMutation.mutate(v))} className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="niche" className="text-xs font-semibold text-slate-700">Niche</Label>
                  <Input
                    id="niche"
                    placeholder="e.g. HVAC repair"
                    {...register('niche')}
                    className="rounded-xl"
                  />
                  {errors.niche && <p className="text-xs text-red-500">{errors.niche.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="target_audience" className="text-xs font-semibold text-slate-700">Target Audience</Label>
                  <Textarea
                    id="target_audience"
                    placeholder="e.g. Homeowners aged 35-65 in Miami with aging AC units"
                    {...register('target_audience')}
                    rows={2}
                    className="rounded-xl resize-none"
                  />
                  {errors.target_audience && (
                    <p className="text-xs text-red-500">{errors.target_audience.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <div>
                    <Label className="text-xs font-semibold text-slate-700">Problem Clusters</Label>
                    <p className="mt-0.5 text-xs text-slate-400">Main problems your audience faces</p>
                  </div>
                  <div className="space-y-2">
                    {fields.map((field, index) => (
                      <div key={field.id} className="flex gap-2">
                        <Input
                          placeholder={`Problem ${index + 1}`}
                          {...register(`problem_clusters.${index}.value`)}
                          className="rounded-xl"
                        />
                        {fields.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => remove(index)}
                            className="rounded-xl px-3 text-slate-400 hover:text-red-500"
                          >
                            <Trash2 size={13} />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append({ value: '' })}
                    className="gap-1.5 rounded-xl text-slate-600"
                  >
                    <Plus size={13} />
                    Add Problem
                  </Button>
                  {errors.problem_clusters && (
                    <p className="text-xs text-red-500">Add at least one problem cluster</p>
                  )}
                </div>

                <Separator />

                <Button
                  type="submit"
                  disabled={generateMutation.isPending}
                  className="w-full gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-5 text-sm font-semibold shadow-lg shadow-indigo-200 hover:from-indigo-700 hover:to-violet-700"
                >
                  <Sparkles size={16} />
                  {generateMutation.isPending ? 'Submitting…' : 'Generate Creatives'}
                </Button>

                {generateMutation.isError && (
                  <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                    Generation failed. Check your DeepSeek API key.
                  </div>
                )}
              </form>
            </div>
          </div>
        </TabsContent>

        {/* Results tab */}
        <TabsContent value="results">
          {activeBriefId ? (
            <GeneratedCreativesView briefId={activeBriefId} />
          ) : (
            <p className="text-sm text-slate-500">Generate creatives first.</p>
          )}
        </TabsContent>

        {/* History tab */}
        <TabsContent value="history">
          <HistoryTab
            onSelect={(id) => {
              setActiveBriefId(id)
              setActiveTab('results')
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
