'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Keyword {
  id?: string
  keyword: string
  cpc_estimate: string
  cpc_value: number | null
  competition: string
  intent: string
}

interface CompetitorAd {
  id?: string
  source: string
  hook: string | null
  primary_text: string | null
  headline: string | null
  offer: string | null
  cta: string | null
  angles: string[] | null
  niche: string | null
  city: string | null
}

interface LandingPageAnalysis {
  url: string
  analysis: {
    headline: string
    subheadline: string
    offer: string
    guarantee: string | null
    cta: string
    structure: string[]
    gaps: string[]
    strengths: string[]
  }
}

// ─── Forms ────────────────────────────────────────────────────────────────────

const ResearchSchema = z.object({
  niche: z.string().min(1, 'Required'),
  city: z.string().min(1, 'Required'),
})

const LPSchema = z.object({
  url: z.string().url('Must be a valid URL'),
})

type ResearchForm = z.infer<typeof ResearchSchema>
type LPForm = z.infer<typeof LPSchema>

// ─── Helpers ─────────────────────────────────────────────────────────────────

function tierBadge(tier: string | null) {
  if (!tier) return null
  const map: Record<string, string> = {
    low: 'bg-emerald-100 text-emerald-800',
    medium: 'bg-amber-100 text-amber-800',
    high: 'bg-red-100 text-red-800',
  }
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${map[tier] ?? ''}`}>
      {tier}
    </span>
  )
}

function intentBadge(intent: string | null) {
  if (!intent) return null
  const map: Record<string, string> = {
    emergency: 'bg-red-100 text-red-800',
    transactional: 'bg-blue-100 text-blue-800',
    informational: 'bg-zinc-100 text-zinc-700',
  }
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${map[intent] ?? ''}`}>
      {intent}
    </span>
  )
}

// ─── Keywords table ───────────────────────────────────────────────────────────

function KeywordsTable({ keywords }: { keywords: Keyword[] }) {
  if (keywords.length === 0) return null
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Keyword</TableHead>
            <TableHead>Intent</TableHead>
            <TableHead>CPC Est.</TableHead>
            <TableHead>CPC Value</TableHead>
            <TableHead>Competition</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {keywords.map((kw, i) => (
            <TableRow key={kw.id ?? i}>
              <TableCell className="font-medium">{kw.keyword}</TableCell>
              <TableCell>{intentBadge(kw.intent)}</TableCell>
              <TableCell>{tierBadge(kw.cpc_estimate)}</TableCell>
              <TableCell>
                {kw.cpc_value != null ? `$${kw.cpc_value.toFixed(2)}` : '—'}
              </TableCell>
              <TableCell>{tierBadge(kw.competition)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// ─── Competitor ads swipe file ─────────────────────────────────────────────────

function AdCard({ ad }: { ad: CompetitorAd }) {
  return (
    <Card>
      <CardHeader className="pb-2 pt-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{ad.source}</Badge>
          {(ad.angles ?? []).map((a) => (
            <span
              key={a}
              className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700"
            >
              {a}
            </span>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pb-4 text-sm">
        {ad.hook && (
          <p className="font-semibold text-zinc-900 dark:text-zinc-100">{ad.hook}</p>
        )}
        {ad.primary_text && <p className="text-zinc-600 dark:text-zinc-400">{ad.primary_text}</p>}
        {ad.headline && (
          <p className="text-xs font-medium text-zinc-500">Headline: {ad.headline}</p>
        )}
        {ad.offer && <p className="text-xs text-zinc-500">Offer: {ad.offer}</p>}
        {ad.cta && (
          <div className="pt-1">
            <span className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white">
              {ad.cta}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Landing page teardown ────────────────────────────────────────────────────

function LandingPageCard({ result }: { result: LandingPageAnalysis }) {
  const a = result.analysis
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <p className="mb-1 text-xs font-semibold uppercase text-zinc-500">URL</p>
        <p className="break-all text-sm text-zinc-600">{result.url}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="mb-2 text-xs font-semibold uppercase text-zinc-500">Headline</p>
          <p className="font-semibold">{a.headline}</p>
          {a.subheadline && <p className="mt-1 text-sm text-zinc-500">{a.subheadline}</p>}
        </div>
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="mb-2 text-xs font-semibold uppercase text-zinc-500">Offer</p>
          <p className="text-sm">{a.offer}</p>
          {a.guarantee && (
            <p className="mt-1 text-xs text-emerald-600">Guarantee: {a.guarantee}</p>
          )}
          <p className="mt-2 font-medium text-blue-600">CTA: {a.cta}</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950">
          <p className="mb-2 text-xs font-semibold uppercase text-emerald-700 dark:text-emerald-400">
            Strengths
          </p>
          <ul className="space-y-1">
            {a.strengths.map((s, i) => (
              <li key={i} className="flex gap-2 text-sm text-emerald-800 dark:text-emerald-300">
                <span>✓</span> {s}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
          <p className="mb-2 text-xs font-semibold uppercase text-red-700 dark:text-red-400">
            Gaps
          </p>
          <ul className="space-y-1">
            {a.gaps.map((g, i) => (
              <li key={i} className="flex gap-2 text-sm text-red-800 dark:text-red-300">
                <span>✗</span> {g}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <p className="mb-2 text-xs font-semibold uppercase text-zinc-500">Page Structure</p>
        <ol className="list-inside list-decimal space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
          {a.structure.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdsIntelPage() {
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [competitorAds, setCompetitorAds] = useState<CompetitorAd[]>([])
  const [lpResult, setLpResult] = useState<LandingPageAnalysis | null>(null)
  const [angleFilter, setAngleFilter] = useState('')

  const {
    register: registerResearch,
    handleSubmit: handleResearch,
    formState: { errors: researchErrors },
  } = useForm<ResearchForm>({ resolver: zodResolver(ResearchSchema) })

  const {
    register: registerLP,
    handleSubmit: handleLP,
    formState: { errors: lpErrors },
  } = useForm<LPForm>({ resolver: zodResolver(LPSchema) })

  const researchMutation = useMutation({
    mutationFn: async (values: ResearchForm) => {
      const res = await fetch('/api/ads-intel/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      if (!res.ok) throw new Error('Research failed')
      return res.json() as Promise<{ keywords: Keyword[]; competitor_ads: CompetitorAd[] }>
    },
    onSuccess: (data) => {
      setKeywords(data.keywords)
      setCompetitorAds(data.competitor_ads)
    },
  })

  const lpMutation = useMutation({
    mutationFn: async (values: LPForm) => {
      const res = await fetch('/api/ads-intel/landing-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      if (!res.ok) throw new Error('LP analysis failed')
      return res.json() as Promise<LandingPageAnalysis>
    },
    onSuccess: setLpResult,
  })

  const allAngles = Array.from(new Set(competitorAds.flatMap((ad) => ad.angles ?? [])))
  const filteredAds = angleFilter
    ? competitorAds.filter((ad) => (ad.angles ?? []).includes(angleFilter))
    : competitorAds

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Market &amp; Ads Intelligence</h1>
        <p className="text-sm text-zinc-500">Research keywords, competitor ads, and landing pages</p>
      </div>

      <Tabs defaultValue="keywords">
        <TabsList>
          <TabsTrigger value="keywords">Keywords</TabsTrigger>
          <TabsTrigger value="ads">Competitor Ads</TabsTrigger>
          <TabsTrigger value="landing">Landing Pages</TabsTrigger>
        </TabsList>

        {/* Keywords + competitor ads */}
        <TabsContent value="keywords" className="mt-4 space-y-4">
          <form
            onSubmit={handleResearch((v) => researchMutation.mutate(v))}
            className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <div className="space-y-1">
              <Label htmlFor="niche">Niche</Label>
              <Input id="niche" placeholder="e.g. HVAC" {...registerResearch('niche')} className="w-40" />
              {researchErrors.niche && (
                <p className="text-xs text-red-500">{researchErrors.niche.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="city">City</Label>
              <Input id="city" placeholder="e.g. Miami" {...registerResearch('city')} className="w-40" />
              {researchErrors.city && (
                <p className="text-xs text-red-500">{researchErrors.city.message}</p>
              )}
            </div>
            <Button type="submit" disabled={researchMutation.isPending}>
              {researchMutation.isPending ? 'Researching…' : 'Run Research'}
            </Button>
          </form>

          {researchMutation.isPending && (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          )}

          {researchMutation.isError && (
            <p className="text-sm text-red-500">Research failed. Check your API keys.</p>
          )}

          {keywords.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-zinc-600">
                {keywords.length} keywords found
              </p>
              <KeywordsTable keywords={keywords} />
            </div>
          )}
        </TabsContent>

        {/* Competitor ads swipe file */}
        <TabsContent value="ads" className="mt-4 space-y-4">
          {competitorAds.length === 0 ? (
            <p className="rounded-lg border border-zinc-200 p-8 text-center text-sm text-zinc-500 dark:border-zinc-800">
              Run keyword research first to populate competitor ads.
            </p>
          ) : (
            <>
              {allAngles.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setAngleFilter('')}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      angleFilter === ''
                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400'
                    }`}
                  >
                    All
                  </button>
                  {allAngles.map((a) => (
                    <button
                      key={a}
                      onClick={() => setAngleFilter(a === angleFilter ? '' : a)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        a === angleFilter
                          ? 'bg-blue-600 text-white'
                          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400'
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-2">
                {filteredAds.map((ad, i) => (
                  <AdCard key={ad.id ?? i} ad={ad} />
                ))}
              </div>
            </>
          )}
        </TabsContent>

        {/* Landing page analysis */}
        <TabsContent value="landing" className="mt-4 space-y-4">
          <form
            onSubmit={handleLP((v) => lpMutation.mutate(v))}
            className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <div className="flex-1 space-y-1">
              <Label htmlFor="lp-url">Landing Page URL</Label>
              <Input
                id="lp-url"
                placeholder="https://competitor.com/hvac-miami"
                {...registerLP('url')}
              />
              {lpErrors.url && (
                <p className="text-xs text-red-500">{lpErrors.url.message}</p>
              )}
            </div>
            <Button type="submit" disabled={lpMutation.isPending}>
              {lpMutation.isPending ? 'Analysing…' : 'Analyse Page'}
            </Button>
          </form>

          {lpMutation.isPending && (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          )}

          {lpMutation.isError && (
            <p className="text-sm text-red-500">Analysis failed. The URL may be unreachable.</p>
          )}

          {lpResult && <LandingPageCard result={lpResult} />}
        </TabsContent>
      </Tabs>
    </div>
  )
}
