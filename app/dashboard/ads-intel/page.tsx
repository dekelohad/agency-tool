'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { BarChart2, Search, Globe, TrendingUp, CheckCircle, XCircle, Layers } from 'lucide-react'

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

// ─── Schemas ─────────────────────────────────────────────────────────────────

const ResearchSchema = z.object({
  niche: z.string().min(1, 'Required'),
  city: z.string().min(1, 'Required'),
})

const LPSchema = z.object({
  url: z.string().url('Must be a valid URL'),
})

type ResearchForm = z.infer<typeof ResearchSchema>
type LPForm = z.infer<typeof LPSchema>

// ─── Badges ──────────────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: string | null }) {
  if (!tier) return <span className="text-slate-300">—</span>
  const config: Record<string, { bg: string; text: string; dot: string }> = {
    low: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    medium: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
    high: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  }
  const cfg = config[tier] ?? { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {tier}
    </span>
  )
}

function IntentBadge({ intent }: { intent: string | null }) {
  if (!intent) return <span className="text-slate-300">—</span>
  const config: Record<string, { bg: string; text: string }> = {
    emergency: { bg: 'bg-red-50', text: 'text-red-700' },
    transactional: { bg: 'bg-indigo-50', text: 'text-indigo-700' },
    informational: { bg: 'bg-slate-100', text: 'text-slate-600' },
  }
  const cfg = config[intent] ?? { bg: 'bg-slate-100', text: 'text-slate-600' }
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      {intent}
    </span>
  )
}

// ─── Keywords table ───────────────────────────────────────────────────────────

function KeywordsTable({ keywords }: { keywords: Keyword[] }) {
  if (keywords.length === 0) return null
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {keywords.length} keywords found
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50 hover:bg-slate-50">
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-400">Keyword</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-400">Intent</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-400">CPC Tier</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-400">CPC Value</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-400">Competition</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {keywords.map((kw, i) => (
            <TableRow key={kw.id ?? i} className="border-slate-50 hover:bg-slate-50/80">
              <TableCell className="font-medium text-slate-800">{kw.keyword}</TableCell>
              <TableCell><IntentBadge intent={kw.intent} /></TableCell>
              <TableCell><TierBadge tier={kw.cpc_estimate} /></TableCell>
              <TableCell>
                {kw.cpc_value != null ? (
                  <span className="font-semibold text-slate-700">${kw.cpc_value.toFixed(2)}</span>
                ) : '—'}
              </TableCell>
              <TableCell><TierBadge tier={kw.competition} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// ─── Ad card ─────────────────────────────────────────────────────────────────

const ANGLE_COLORS = [
  'bg-indigo-50 text-indigo-700',
  'bg-violet-50 text-violet-700',
  'bg-blue-50 text-blue-700',
  'bg-emerald-50 text-emerald-700',
  'bg-amber-50 text-amber-700',
]

function AdCard({ ad }: { ad: CompetitorAd }) {
  return (
    <div className="flex flex-col rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <span className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600">
          {ad.source}
        </span>
        {(ad.angles ?? []).map((a, i) => (
          <span
            key={a}
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${ANGLE_COLORS[i % ANGLE_COLORS.length]}`}
          >
            {a}
          </span>
        ))}
      </div>

      <div className="flex-1 space-y-3">
        {ad.hook && (
          <div>
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Hook</p>
            <p className="text-sm font-semibold leading-snug text-slate-900">{ad.hook}</p>
          </div>
        )}
        {ad.primary_text && (
          <div>
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Copy</p>
            <p className="text-sm leading-relaxed text-slate-600">{ad.primary_text}</p>
          </div>
        )}
        {ad.offer && (
          <div className="rounded-xl bg-indigo-50 px-3 py-2">
            <p className="text-xs font-medium text-indigo-700">Offer: {ad.offer}</p>
          </div>
        )}
      </div>

      {ad.cta && (
        <div className="mt-4 pt-3 border-t border-slate-100">
          <span className="inline-flex rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm shadow-indigo-200">
            {ad.cta}
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Landing page teardown ────────────────────────────────────────────────────

function LandingPageCard({ result }: { result: LandingPageAnalysis }) {
  const a = result.analysis
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Analyzed URL</p>
        <p className="break-all text-sm font-medium text-indigo-600">{result.url}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Headline</p>
          <p className="text-base font-bold text-slate-900">{a.headline}</p>
          {a.subheadline && <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{a.subheadline}</p>}
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Offer</p>
          <p className="text-sm font-medium text-slate-800">{a.offer}</p>
          {a.guarantee && (
            <p className="mt-2 text-xs font-medium text-emerald-600">Guarantee: {a.guarantee}</p>
          )}
          <div className="mt-3">
            <span className="inline-flex rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white">
              {a.cta}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5">
          <div className="mb-3 flex items-center gap-2">
            <CheckCircle size={14} className="text-emerald-600" />
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Strengths</p>
          </div>
          <ul className="space-y-2">
            {a.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-emerald-800">
                <span className="mt-0.5 text-emerald-500">✓</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-red-100 bg-red-50/60 p-5">
          <div className="mb-3 flex items-center gap-2">
            <XCircle size={14} className="text-red-500" />
            <p className="text-xs font-semibold uppercase tracking-wider text-red-600">Gaps</p>
          </div>
          <ul className="space-y-2">
            {a.gaps.map((g, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-red-800">
                <span className="mt-0.5 text-red-400">✗</span>
                <span>{g}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Layers size={13} className="text-slate-400" />
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Page Structure</p>
        </div>
        <ol className="space-y-1.5">
          {a.structure.map((s, i) => (
            <li key={i} className="flex items-center gap-2.5 text-sm text-slate-600">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">
                {i + 1}
              </span>
              {s}
            </li>
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
    <div className="min-h-screen p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="mb-1 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100">
            <BarChart2 size={14} className="text-indigo-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Market &amp; Ads Intelligence</h1>
        </div>
        <p className="text-sm text-slate-500">Research keywords, competitor ads, and landing pages</p>
      </div>

      <Tabs defaultValue="keywords">
        <TabsList className="mb-6 h-10 rounded-xl bg-slate-100 p-1">
          <TabsTrigger value="keywords" className="flex items-center gap-1.5 rounded-lg text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Search size={13} />
            Keywords
          </TabsTrigger>
          <TabsTrigger value="ads" className="flex items-center gap-1.5 rounded-lg text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <TrendingUp size={13} />
            Competitor Ads
          </TabsTrigger>
          <TabsTrigger value="landing" className="flex items-center gap-1.5 rounded-lg text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Globe size={13} />
            Landing Pages
          </TabsTrigger>
        </TabsList>

        {/* Keywords */}
        <TabsContent value="keywords" className="space-y-5">
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <p className="mb-4 text-sm font-semibold text-slate-800">Run Keyword Research</p>
            <form
              onSubmit={handleResearch((v) => researchMutation.mutate(v))}
              className="flex flex-wrap items-end gap-3"
            >
              <div className="space-y-1.5">
                <Label htmlFor="niche" className="text-xs font-medium text-slate-600">Niche</Label>
                <Input id="niche" placeholder="e.g. HVAC" {...registerResearch('niche')} className="w-44 rounded-xl" />
                {researchErrors.niche && (
                  <p className="text-xs text-red-500">{researchErrors.niche.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="city" className="text-xs font-medium text-slate-600">City</Label>
                <Input id="city" placeholder="e.g. Miami" {...registerResearch('city')} className="w-44 rounded-xl" />
                {researchErrors.city && (
                  <p className="text-xs text-red-500">{researchErrors.city.message}</p>
                )}
              </div>
              <Button
                type="submit"
                disabled={researchMutation.isPending}
                className="gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700"
              >
                <Search size={14} />
                {researchMutation.isPending ? 'Researching…' : 'Run Research'}
              </Button>
            </form>
          </div>

          {researchMutation.isPending && (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          )}

          {researchMutation.isError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
              Research failed. Check your API keys.
            </div>
          )}

          {keywords.length > 0 && <KeywordsTable keywords={keywords} />}
        </TabsContent>

        {/* Competitor ads */}
        <TabsContent value="ads" className="space-y-4">
          {competitorAds.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
                <TrendingUp size={22} className="text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-600">No competitor ads yet</p>
              <p className="mt-1 text-xs text-slate-400">Run keyword research first to populate this tab</p>
            </div>
          ) : (
            <>
              {allAngles.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setAngleFilter('')}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                      angleFilter === ''
                        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                        : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
                    }`}
                  >
                    All ({competitorAds.length})
                  </button>
                  {allAngles.map((a) => (
                    <button
                      key={a}
                      onClick={() => setAngleFilter(a === angleFilter ? '' : a)}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                        a === angleFilter
                          ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                          : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                {filteredAds.map((ad, i) => (
                  <AdCard key={ad.id ?? i} ad={ad} />
                ))}
              </div>
            </>
          )}
        </TabsContent>

        {/* Landing pages */}
        <TabsContent value="landing" className="space-y-5">
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <p className="mb-4 text-sm font-semibold text-slate-800">Analyze a Landing Page</p>
            <form
              onSubmit={handleLP((v) => lpMutation.mutate(v))}
              className="flex flex-wrap items-end gap-3"
            >
              <div className="flex-1 space-y-1.5" style={{ minWidth: 280 }}>
                <Label htmlFor="lp-url" className="text-xs font-medium text-slate-600">Landing Page URL</Label>
                <Input
                  id="lp-url"
                  placeholder="https://competitor.com/hvac-miami"
                  {...registerLP('url')}
                  className="rounded-xl"
                />
                {lpErrors.url && (
                  <p className="text-xs text-red-500">{lpErrors.url.message}</p>
                )}
              </div>
              <Button
                type="submit"
                disabled={lpMutation.isPending}
                className="gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700"
              >
                <Globe size={14} />
                {lpMutation.isPending ? 'Analysing…' : 'Analyse Page'}
              </Button>
            </form>
          </div>

          {lpMutation.isPending && (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-28 w-full rounded-2xl" />
              ))}
            </div>
          )}

          {lpMutation.isError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
              Analysis failed. The URL may be unreachable.
            </div>
          )}

          {lpResult && <LandingPageCard result={lpResult} />}
        </TabsContent>
      </Tabs>
    </div>
  )
}
