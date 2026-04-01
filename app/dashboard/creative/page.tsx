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
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'

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

// ─── Form ─────────────────────────────────────────────────────────────────────

const GenerateSchema = z.object({
  niche: z.string().min(1, 'Required'),
  target_audience: z.string().min(1, 'Required'),
  problem_clusters: z
    .array(z.object({ value: z.string().min(1) }))
    .min(1, 'Add at least one problem'),
})

type GenerateForm = z.infer<typeof GenerateSchema>

// ─── Ad card ─────────────────────────────────────────────────────────────────

function AdCreativeCard({ ad }: { ad: AdCreative }) {
  const [showLanding, setShowLanding] = useState(false)
  const [copied, setCopied] = useState(false)

  const variantColors: Record<string, string> = {
    A: 'bg-blue-100 text-blue-800',
    B: 'bg-purple-100 text-purple-800',
    C: 'bg-emerald-100 text-emerald-800',
  }

  function copyAd() {
    const text = [
      `[Variant ${ad.ab_variant}] ${ad.format?.toUpperCase()} AD`,
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
    <Card className="flex flex-col">
      <CardHeader className="pb-2 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                variantColors[ad.ab_variant ?? ''] ?? 'bg-zinc-100 text-zinc-700'
              }`}
            >
              {ad.ab_variant}
            </span>
            <Badge variant="outline" className="text-xs">
              {ad.format}
            </Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={copyAd} className="text-xs">
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-3 pb-4 text-sm">
        {ad.hook && (
          <div>
            <p className="text-xs font-semibold uppercase text-zinc-400">Hook</p>
            <p className="font-semibold text-zinc-900 dark:text-zinc-100">{ad.hook}</p>
          </div>
        )}

        {ad.primary_text && (
          <div>
            <p className="text-xs font-semibold uppercase text-zinc-400">Primary Text</p>
            <p className="text-zinc-700 dark:text-zinc-300">{ad.primary_text}</p>
          </div>
        )}

        <div className="flex gap-4">
          {ad.headline && (
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase text-zinc-400">Headline</p>
              <p className="font-medium">{ad.headline}</p>
            </div>
          )}
          {ad.cta && (
            <div>
              <p className="text-xs font-semibold uppercase text-zinc-400">CTA</p>
              <span className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white">
                {ad.cta}
              </span>
            </div>
          )}
        </div>

        {ad.image_concept && (
          <div className="rounded-md bg-zinc-50 p-3 dark:bg-zinc-900">
            <p className="text-xs font-semibold uppercase text-zinc-400">Visual Concept</p>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">{ad.image_concept}</p>
          </div>
        )}

        {ad.shot_list && ad.shot_list.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase text-zinc-400">Shot List</p>
            <ol className="list-inside list-decimal space-y-0.5 text-xs text-zinc-500">
              {ad.shot_list.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </div>
        )}

        <Separator />

        <button
          onClick={() => setShowLanding(!showLanding)}
          className="w-full text-left text-xs font-semibold uppercase text-blue-600 hover:text-blue-700"
        >
          {showLanding ? '▾' : '▸'} Landing Page Copy
        </button>

        {showLanding && ad.landing_copy && (
          <div className="space-y-2 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
            <p className="font-semibold">{ad.landing_copy.headline}</p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{ad.landing_copy.subhead}</p>
            <ul className="list-inside list-disc space-y-1 text-sm">
              {ad.landing_copy.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
            <span className="inline-block rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white">
              {ad.landing_copy.cta}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
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
      // Poll until ads are generated (worker is async)
      const data = query.state.data
      return data && data.length > 0 ? false : 3000
    },
  })

  if (isLoading || ads.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-zinc-500">Generating creatives… this takes ~15 seconds.</p>
        <div className="grid gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-80 w-full rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-zinc-600">{ads.length} ad variants generated</p>
      <div className="grid gap-3 md:grid-cols-3">
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

  // Group by brief_id
  const briefs = ads.reduce<Record<string, AdCreative[]>>((acc, ad) => {
    if (!acc[ad.brief_id]) acc[ad.brief_id] = []
    acc[ad.brief_id].push(ad)
    return acc
  }, {})

  if (isLoading) return <Skeleton className="h-32 w-full" />

  if (Object.keys(briefs).length === 0) {
    return (
      <p className="rounded-lg border border-zinc-200 p-8 text-center text-sm text-zinc-500 dark:border-zinc-800">
        No generated creatives yet.
      </p>
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
            className="flex w-full items-center justify-between rounded-lg border border-zinc-200 p-3 text-left hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
          >
            <div>
              <p className="text-sm font-medium">{first.creative_briefs?.niche ?? '—'}</p>
              <p className="text-xs text-zinc-500">
                {first.creative_briefs?.target_audience ?? ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400">{briefAds.length} variants</span>
              <span className="text-xs text-zinc-400">
                {new Date(first.created_at).toLocaleDateString()}
              </span>
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
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Creative Factory</h1>
        <p className="text-sm text-zinc-500">Generate ad creatives, copy, and A/B testing plans</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="generate">Generate</TabsTrigger>
          <TabsTrigger value="results" disabled={!activeBriefId}>
            Results
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="mt-4">
          <form
            onSubmit={handleSubmit((v) => generateMutation.mutate(v))}
            className="max-w-xl space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="niche">Niche</Label>
              <Input id="niche" placeholder="e.g. HVAC repair" {...register('niche')} />
              {errors.niche && (
                <p className="text-xs text-red-500">{errors.niche.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="target_audience">Target Audience</Label>
              <Textarea
                id="target_audience"
                placeholder="e.g. Homeowners aged 35-65 in Miami with aging AC units"
                {...register('target_audience')}
                rows={2}
              />
              {errors.target_audience && (
                <p className="text-xs text-red-500">{errors.target_audience.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Problem Clusters</Label>
              <p className="text-xs text-zinc-500">
                Enter the main problems your audience faces (one per line)
              </p>
              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-2">
                  <Input
                    placeholder={`Problem ${index + 1}`}
                    {...register(`problem_clusters.${index}.value`)}
                  />
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => remove(index)}
                    >
                      ×
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ value: '' })}
              >
                + Add Problem
              </Button>
              {errors.problem_clusters && (
                <p className="text-xs text-red-500">Add at least one problem cluster</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={generateMutation.isPending}
              className="w-full"
            >
              {generateMutation.isPending ? 'Submitting…' : 'Generate Creatives'}
            </Button>

            {generateMutation.isError && (
              <p className="text-sm text-red-500">
                Generation failed. Check your Anthropic API key.
              </p>
            )}
          </form>
        </TabsContent>

        <TabsContent value="results" className="mt-4">
          {activeBriefId ? (
            <GeneratedCreativesView briefId={activeBriefId} />
          ) : (
            <p className="text-sm text-zinc-500">Generate creatives first.</p>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
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
