'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  CircleCheck,
  CircleDashed,
  Download,
  FileUp,
  Search,
  Timer,
  TriangleAlert,
} from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Badge } from '@/src/components/ui/badge';
import type { DashboardInvoicesResponse } from '@/src/lib/dashboard/contracts';
import {
  DASHBOARD_STATUS_GROUP_LABELS,
  DASHBOARD_STATUS_GROUPS,
  emptyDashboardStatusDistribution,
  isDashboardStatusGroup,
  mapInvoiceStatusToDashboardGroup,
  type DashboardStatusDistribution,
  type DashboardStatusGroup,
} from '@/src/lib/dashboard/invoices';

const DEFAULT_LIMIT = 25;

const DATE_FORMATTER = new Intl.DateTimeFormat('de-DE');
const CURRENCY_FORMATTER = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
});

interface StatusVisual {
  label: string;
  className: string;
  icon: ComponentType<{ className?: string }>;
}

function getStatusVisual(status: string): StatusVisual {
  if (status === 'UPLOADED' || status === 'CREATED') {
    return {
      label: DASHBOARD_STATUS_GROUP_LABELS.uploaded,
      className: 'border-neutral-300 bg-neutral-100 text-neutral-800',
      icon: Timer,
    };
  }

  if (status === 'PARSED' || status === 'VALIDATED') {
    return {
      label: DASHBOARD_STATUS_GROUP_LABELS.processed,
      className: 'border-info/30 bg-info-bg text-info',
      icon: CircleCheck,
    };
  }

  if (status === 'EXPORTED') {
    return {
      label: DASHBOARD_STATUS_GROUP_LABELS.exported,
      className: 'border-success/25 bg-success-bg text-success',
      icon: CircleCheck,
    };
  }

  return {
    label: 'Fehlgeschlagen',
    className: 'border-error/25 bg-error-bg text-error',
    icon: TriangleAlert,
  };
}

function formatDate(value: string | null): string {
  if (!value) return 'Keine Angabe';
  return DATE_FORMATTER.format(new Date(value));
}

function formatAmount(value: number | null): string {
  if (value === null) return 'Keine Angabe';
  return CURRENCY_FORMATTER.format(value);
}

function DashboardDonutChart({
  distribution,
}: {
  distribution: DashboardStatusDistribution;
}) {
  const total = distribution.uploaded + distribution.processed + distribution.exported;
  const safeTotal = total > 0 ? total : 1;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;

  const colors: Record<DashboardStatusGroup, string> = {
    uploaded: '#64748B',
    processed: '#0284C7',
    exported: '#16A34A',
  };

  const segments = DASHBOARD_STATUS_GROUPS.reduce<
    Array<{
      group: DashboardStatusGroup;
      segmentLength: number;
      offset: number;
    }>
  >((acc, group) => {
    const previousLength = acc.reduce(
      (sum, segment) => sum + segment.segmentLength,
      0
    );
    const fraction = distribution[group] / safeTotal;
    const segmentLength = circumference * fraction;
    const offset = -previousLength;
    acc.push({ group, segmentLength, offset });
    return acc;
  }, []);

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <div className="mx-auto w-fit">
        <svg
          viewBox="0 0 120 120"
          className="h-40 w-40"
          role="img"
          aria-label="Verteilung der Rechnungsstatus"
        >
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="#E2E8F0"
            strokeWidth="16"
          />
          {segments.map(({ group, segmentLength, offset }) => {
            if (segmentLength <= 0) {
              return null;
            }

            return (
              <circle
                key={group}
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke={colors[group]}
                strokeWidth="16"
                strokeDasharray={`${segmentLength} ${circumference}`}
                strokeDashoffset={offset}
                transform="rotate(-90 60 60)"
              />
            );
          })}
          <text
            x="60"
            y="56"
            textAnchor="middle"
            className="fill-neutral-900 text-[14px] font-semibold"
          >
            {total}
          </text>
          <text
            x="60"
            y="73"
            textAnchor="middle"
            className="fill-neutral-500 text-[10px]"
          >
            Rechnungen
          </text>
        </svg>
      </div>
      <div className="space-y-3">
        {DASHBOARD_STATUS_GROUPS.map((group) => {
          const value = distribution[group];
          const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
          return (
            <div
              key={group}
              className="flex items-center justify-between rounded-lg border border-border bg-neutral-50 px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: colors[group] }}
                  aria-hidden
                />
                <span className="text-sm font-medium text-neutral-800">
                  {DASHBOARD_STATUS_GROUP_LABELS[group]}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm tabular-nums">
                <span className="font-semibold text-neutral-900">{value}</span>
                <span className="text-neutral-500">{percentage}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DashboardClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const statusGroup = useMemo<DashboardStatusGroup | null>(() => {
    const raw = searchParams.get('statusGroup');
    return isDashboardStatusGroup(raw) ? raw : null;
  }, [searchParams]);

  const queryFromUrl = searchParams.get('q') ?? '';
  const cursor = searchParams.get('cursor');

  const [queryInput, setQueryInput] = useState(queryFromUrl);
  const [data, setData] = useState<DashboardInvoicesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const updateSearchParams = useCallback(
    (updates: Record<string, string | null>) => {
      const nextParams = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(updates)) {
        if (!value) {
          nextParams.delete(key);
        } else {
          nextParams.set(key, value);
        }
      }

      const nextQueryString = nextParams.toString();
      router.replace(
        nextQueryString ? `${pathname}?${nextQueryString}` : pathname,
        { scroll: false }
      );
    },
    [pathname, router, searchParams]
  );

  useEffect(() => {
    setQueryInput(queryFromUrl);
  }, [queryFromUrl]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const trimmed = queryInput.trim();
      const current = queryFromUrl.trim();
      if (trimmed === current) return;
      updateSearchParams({ q: trimmed || null, cursor: null });
    }, 250);

    return () => {
      clearTimeout(timeout);
    };
  }, [queryInput, queryFromUrl, updateSearchParams]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      limit: String(DEFAULT_LIMIT),
    });

    const normalizedQuery = queryFromUrl.trim();
    if (statusGroup) {
      params.set('statusGroup', statusGroup);
    }
    if (normalizedQuery) {
      params.set('q', normalizedQuery);
    }
    if (cursor) {
      params.set('cursor', cursor);
    }

    async function loadDashboard(): Promise<void> {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/invoices?${params.toString()}`, {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal,
        });

        const payload = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(payload?.error?.message ?? 'Dashboard konnte nicht geladen werden');
        }

        setData(payload as DashboardInvoicesResponse);
      } catch (fetchError) {
        if (controller.signal.aborted) return;
        const message =
          fetchError instanceof Error
            ? fetchError.message
            : 'Unbekannter Fehler beim Laden des Dashboards';
        setError(message);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      controller.abort();
    };
  }, [cursor, queryFromUrl, statusGroup]);

  const distribution = data?.stats.statusDistribution ?? emptyDashboardStatusDistribution();
  const primaryDetailsId = data?.items[0]?.id ?? null;
  const selectedGroupCount = statusGroup
    ? distribution[statusGroup]
    : (data?.stats.totalCount ?? 0);

  return (
    <section className="space-y-6 px-3 py-4 sm:px-4 sm:py-6 lg:px-0">
      <header className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-neutral-50 via-white to-brand-50/40 p-5 shadow-sm sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-brand-200/25 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-xs font-semibold tracking-wide text-brand-700">
              <CircleDashed className="h-3.5 w-3.5" />
              Rechnungsmonitoring
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
              Dashboard
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-neutral-600 sm:text-base">
              Überblick über Belegeingang, Verarbeitungsstand und Exportfortschritt.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild>
              <Link href="/invoices/new">
                <FileUp className="h-4 w-4" />
                Upload
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/exports">
                <Download className="h-4 w-4" />
                Export
              </Link>
            </Button>
            {primaryDetailsId ? (
              <Button asChild variant="secondary">
                <Link href={`/invoices/${primaryDetailsId}`}>
                  Details
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <Button variant="secondary" disabled aria-disabled>
                Details
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Gesamt</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {data?.stats.totalCount ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-neutral-500">
            Rechnungen im aktuellen Filter
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Diesen Monat</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {data?.stats.currentMonthCount ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-neutral-500">
            Erstellt seit Monatsbeginn
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Bruttovolumen</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatAmount(data?.stats.totalGrossAmount ?? 0)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-neutral-500">
            Null-safe Summierung verfügbarer Beträge
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>
              {statusGroup
                ? DASHBOARD_STATUS_GROUP_LABELS[statusGroup]
                : 'Alle Status'}
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">{selectedGroupCount}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-neutral-500">
            Segmentgröße in der aktuellen Verteilung
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div
              className="inline-flex w-full max-w-md rounded-lg border border-border bg-neutral-50 p-1"
              role="tablist"
              aria-label="Statusfilter"
            >
              <button
                type="button"
                role="tab"
                aria-selected={statusGroup === null}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
                  statusGroup === null
                    ? 'bg-white text-neutral-900 shadow-sm'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
                onClick={() =>
                  updateSearchParams({
                    statusGroup: null,
                    cursor: null,
                  })
                }
              >
                Alle Status
              </button>
              {DASHBOARD_STATUS_GROUPS.map((group) => {
                const active = group === statusGroup;
                return (
                  <button
                    key={group}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
                      active
                        ? 'bg-white text-neutral-900 shadow-sm'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                    onClick={() =>
                      updateSearchParams({
                        statusGroup: group,
                        cursor: null,
                      })
                    }
                  >
                    {DASHBOARD_STATUS_GROUP_LABELS[group]}
                  </button>
                );
              })}
            </div>
            <div className="relative w-full lg:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <Input
                value={queryInput}
                onChange={(event) => setQueryInput(event.target.value)}
                className="pl-9"
                placeholder="Suche nach Rechnungsnummer oder Lieferant"
                aria-label="Rechnungen durchsuchen"
              />
            </div>
          </div>
          <p className="text-xs text-neutral-500">
            Filtert nach Rechnungsnummer (`number`) und Lieferantenname (`supplierName`).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Statusverteilung</CardTitle>
          <CardDescription>
            Aggregiert auf UI-Gruppen: Eingegangen, Verarbeitet, Exportiert.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DashboardDonutChart distribution={distribution} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rechnungen</CardTitle>
          <CardDescription>
            Neueste Belege zuerst, sortiert nach Erstellungsdatum.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-neutral-500">Lade Rechnungen...</p>
          ) : error ? (
            <p className="rounded-lg border border-error/30 bg-error-bg px-3 py-2 text-sm text-error">
              {error}
            </p>
          ) : data && data.items.length > 0 ? (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wide text-neutral-500">
                      <th className="px-3 py-2 font-semibold">Nummer</th>
                      <th className="px-3 py-2 font-semibold">Lieferant</th>
                      <th className="px-3 py-2 font-semibold">Issue Date</th>
                      <th className="px-3 py-2 font-semibold">Created</th>
                      <th className="px-3 py-2 font-semibold">Brutto</th>
                      <th className="px-3 py-2 font-semibold">Status</th>
                      <th className="px-3 py-2 font-semibold">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((item) => {
                      const visual = getStatusVisual(item.status);
                      const StatusIcon = visual.icon;
                      return (
                        <tr
                          key={item.id}
                          className="border-b border-border/70 transition hover:bg-neutral-50"
                        >
                          <td className="px-3 py-3 font-medium text-neutral-900">
                            {item.number || 'Ohne Nummer'}
                          </td>
                          <td className="px-3 py-3 text-neutral-700">
                            {item.supplierName || 'Unbekannter Lieferant'}
                          </td>
                          <td className="px-3 py-3 tabular-nums text-neutral-700">
                            {formatDate(item.issueDate)}
                          </td>
                          <td className="px-3 py-3 tabular-nums text-neutral-700">
                            {formatDate(item.createdAt)}
                          </td>
                          <td className="px-3 py-3 tabular-nums font-medium text-neutral-900">
                            {formatAmount(item.grossAmount)}
                          </td>
                          <td className="px-3 py-3">
                            <Badge
                              className={`inline-flex items-center gap-1.5 border ${visual.className}`}
                            >
                              <StatusIcon className="h-3.5 w-3.5" />
                              <span>{visual.label}</span>
                            </Badge>
                          </td>
                          <td className="px-3 py-3">
                            <Button asChild size="sm" variant="ghost">
                              <Link href={`/invoices/${item.id}`}>Öffnen</Link>
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-3 md:hidden">
                {data.items.map((item) => {
                  const visual = getStatusVisual(item.status);
                  const StatusIcon = visual.icon;
                  const mappedGroup = mapInvoiceStatusToDashboardGroup(item.status);
                  return (
                    <article
                      key={item.id}
                      className="rounded-xl border border-border bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-neutral-900">
                            {item.number || 'Ohne Nummer'}
                          </p>
                          <p className="mt-1 text-xs text-neutral-500">
                            {item.supplierName || 'Unbekannter Lieferant'}
                          </p>
                        </div>
                        <Badge
                          className={`inline-flex items-center gap-1.5 border ${visual.className}`}
                        >
                          <StatusIcon className="h-3.5 w-3.5" />
                          <span>{visual.label}</span>
                        </Badge>
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <dt className="text-neutral-500">Issue Date</dt>
                          <dd className="tabular-nums text-neutral-800">
                            {formatDate(item.issueDate)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-neutral-500">Created</dt>
                          <dd className="tabular-nums text-neutral-800">
                            {formatDate(item.createdAt)}
                          </dd>
                        </div>
                        <div className="col-span-2">
                          <dt className="text-neutral-500">Brutto</dt>
                          <dd className="tabular-nums font-semibold text-neutral-900">
                            {formatAmount(item.grossAmount)}
                          </dd>
                        </div>
                      </dl>
                      <div className="mt-3 flex items-center justify-between">
                        <p className="text-xs text-neutral-500">
                          Gruppe:{' '}
                          <span className="font-medium text-neutral-700">
                            {mappedGroup
                              ? DASHBOARD_STATUS_GROUP_LABELS[mappedGroup]
                              : 'Nicht zugeordnet'}
                          </span>
                        </p>
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/invoices/${item.id}`}>Details</Link>
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>

              {data.nextCursor ? (
                <div className="mt-4 flex justify-end">
                  <Button
                    variant="outline"
                    onClick={() => updateSearchParams({ cursor: data.nextCursor })}
                  >
                    Nächste Seite
                  </Button>
                </div>
              ) : null}
            </>
          ) : (
            <p className="rounded-lg border border-border bg-neutral-50 px-3 py-4 text-sm text-neutral-600">
              Keine Rechnungen für den aktuellen Filter gefunden.
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
