'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  Controller,
  type DeepPartial,
  type Path,
  useFieldArray,
  useForm,
} from 'react-hook-form';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select';
import {
  invoiceProfileValues,
  invoiceReviewSchema,
  normalizeInvoiceReviewPayload,
  type InvoiceReviewFormInput,
  type InvoiceReviewFormValues,
} from '@/src/lib/validators/invoice-review';

const paymentMeansValues = [
  { value: 'bankTransfer', label: 'Überweisung' },
  { value: 'card', label: 'Karte' },
  { value: 'directDebit', label: 'Lastschrift' },
  { value: 'cash', label: 'Bar' },
  { value: 'other', label: 'Sonstiges' },
] as const;

const vatRateValues = ['0', '7', '19'] as const;

interface ApiErrorPayload {
  error?: {
    message?: string;
    details?: {
      fieldErrors?: Record<string, string>;
    };
  };
}

interface ApiWarningPayload {
  code?: string;
  field?: string;
  message?: string;
}

interface ApiSuccessPayload {
  warnings?: ApiWarningPayload[];
}

export interface InvoiceReviewFormProps {
  initialData?: DeepPartial<InvoiceReviewFormInput>;
  fieldConfidence?: Record<string, number>;
  submitUrl?: string;
  submitLabel?: string;
  successRedirectTo?: string;
  onValidated?: (payload: InvoiceReviewFormValues) => void | Promise<void>;
}

function getTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function inferTaxRateFromTotals(
  netAmount: number,
  taxAmount: number
): 0 | 7 | 19 | undefined {
  if (Math.abs(taxAmount) <= 0.02) {
    return 0;
  }

  if (Math.abs(netAmount) <= 0.02) {
    return undefined;
  }

  const actualRate = (taxAmount / netAmount) * 100;
  const candidates: Array<0 | 7 | 19> = [0, 7, 19];
  let bestRate: 0 | 7 | 19 = 19;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const rate of candidates) {
    const distance = Math.abs(actualRate - rate);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestRate = rate;
    }
  }

  return bestDistance <= 0.5 ? bestRate : undefined;
}

function inferTaxBreakdownSeed(
  initialData?: DeepPartial<InvoiceReviewFormInput>
): { rate: 0 | 7 | 19; taxableAmount: number; taxAmount: number } | undefined {
  const netAmount = toFiniteNumber(initialData?.totals?.netAmount);
  const taxAmount = toFiniteNumber(initialData?.totals?.vatAmount);
  if (netAmount === undefined || taxAmount === undefined) {
    return undefined;
  }

  const rateCandidates = new Set<0 | 7 | 19>();
  if (initialData?.lines) {
    for (const line of initialData.lines) {
      const vatRate = toFiniteNumber(line?.vatRate);
      if (vatRate === 0 || vatRate === 7 || vatRate === 19) {
        rateCandidates.add(vatRate);
      }
    }
  }

  const inferredRate =
    rateCandidates.size === 1
      ? Array.from(rateCandidates)[0]
      : inferTaxRateFromTotals(netAmount, taxAmount);

  return {
    rate: inferredRate ?? 19,
    taxableAmount: netAmount,
    taxAmount,
  };
}

function createDefaultValues(
  initialData?: DeepPartial<InvoiceReviewFormInput>
): InvoiceReviewFormInput {
  const line = initialData?.lines?.[0];
  const tax = initialData?.taxBreakdown?.[0];
  const inferredTaxSeed = inferTaxBreakdownSeed(initialData);

  return {
    header: {
      profile: initialData?.header?.profile ?? 'EN16931',
      invoiceNumber: initialData?.header?.invoiceNumber ?? '',
      issueDate: initialData?.header?.issueDate ?? getTodayIso(),
      currency: initialData?.header?.currency ?? 'EUR',
      dueDate: initialData?.header?.dueDate ?? '',
      buyerReference: initialData?.header?.buyerReference ?? '',
    },
    seller: {
      name: initialData?.seller?.name ?? '',
      street: initialData?.seller?.street ?? '',
      postCode: initialData?.seller?.postCode ?? '',
      city: initialData?.seller?.city ?? '',
      countryCode: initialData?.seller?.countryCode ?? 'DE',
      vatId: initialData?.seller?.vatId ?? '',
      taxNumber: initialData?.seller?.taxNumber ?? '',
    },
    buyer: {
      name: initialData?.buyer?.name ?? '',
      street: initialData?.buyer?.street ?? '',
      postCode: initialData?.buyer?.postCode ?? '',
      city: initialData?.buyer?.city ?? '',
      countryCode: initialData?.buyer?.countryCode ?? 'DE',
    },
    payment: {
      means: initialData?.payment?.means ?? 'bankTransfer',
      iban: initialData?.payment?.iban ?? '',
      termsText: initialData?.payment?.termsText ?? '',
    },
    lines:
      initialData?.lines && initialData.lines.length > 0
        ? initialData.lines.map((item) => ({
            description: item?.description ?? '',
            quantity: item?.quantity ?? 1,
            unit: item?.unit ?? 'Stk',
            unitPrice: item?.unitPrice ?? 0,
            netAmount: item?.netAmount ?? 0,
            vatRate: item?.vatRate ?? 19,
            vatCategory: item?.vatCategory ?? 'S',
          }))
        : [
            {
              description: line?.description ?? '',
              quantity: line?.quantity ?? 1,
              unit: line?.unit ?? 'Stk',
              unitPrice: line?.unitPrice ?? 0,
              netAmount: line?.netAmount ?? 0,
              vatRate: line?.vatRate ?? 19,
              vatCategory: line?.vatCategory ?? 'S',
            },
          ],
    totals: {
      netAmount: initialData?.totals?.netAmount ?? 0,
      vatAmount: initialData?.totals?.vatAmount ?? 0,
      grossAmount: initialData?.totals?.grossAmount ?? 0,
    },
    taxBreakdown:
      initialData?.taxBreakdown && initialData.taxBreakdown.length > 0
        ? initialData.taxBreakdown.map((item) => ({
            rate: item?.rate ?? 19,
            taxableAmount: item?.taxableAmount ?? 0,
            taxAmount: item?.taxAmount ?? 0,
          }))
        : [
            {
              rate: tax?.rate ?? inferredTaxSeed?.rate ?? 19,
              taxableAmount:
                tax?.taxableAmount ?? inferredTaxSeed?.taxableAmount ?? 0,
              taxAmount: tax?.taxAmount ?? inferredTaxSeed?.taxAmount ?? 0,
            },
          ],
  };
}

function confidenceBadge(
  fieldConfidence: Record<string, number> | undefined,
  path: string
) {
  const confidence = fieldConfidence?.[path];
  if (typeof confidence !== 'number' || confidence >= 0.7) {
    return null;
  }

  return (
    <Badge
      variant="outline"
      className="ml-2 border-amber-300 bg-amber-50 text-amber-700"
    >
      <AlertTriangle className="mr-1 h-3 w-3" />
      OCR {Math.round(confidence * 100)}%
    </Badge>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;

  return <p className="text-sm text-destructive">{message}</p>;
}

export function InvoiceReviewForm({
  initialData,
  fieldConfidence,
  submitUrl,
  submitLabel = 'Validieren & weiter',
  successRedirectTo,
  onValidated,
}: InvoiceReviewFormProps) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitWarnings, setSubmitWarnings] = useState<string[]>([]);

  const defaultValues = useMemo(
    () => createDefaultValues(initialData),
    [initialData]
  );

  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<InvoiceReviewFormInput, unknown, InvoiceReviewFormValues>({
    resolver: zodResolver(invoiceReviewSchema),
    mode: 'onBlur',
    defaultValues,
  });

  const lines = useFieldArray({
    control,
    name: 'lines',
  });

  const taxBreakdown = useFieldArray({
    control,
    name: 'taxBreakdown',
  });

  const onSubmit = async (values: InvoiceReviewFormValues) => {
    setSubmitError(null);
    setSubmitSuccess(null);
    setSubmitWarnings([]);

    const normalized = normalizeInvoiceReviewPayload(values);

    if (submitUrl) {
      const response = await fetch(submitUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalized),
      });

      let payload: ApiErrorPayload | ApiSuccessPayload | null = null;
      try {
        payload = (await response.json()) as ApiErrorPayload | ApiSuccessPayload;
      } catch {
        payload = null;
      }

      if (!response.ok) {
        const errorPayload = payload as ApiErrorPayload | null;
        if (!errorPayload) {
          setSubmitError(
            'Validierung fehlgeschlagen. Bitte Eingaben prüfen und erneut versuchen.'
          );
          return;
        }

        const fieldErrors = errorPayload.error?.details?.fieldErrors ?? {};
        for (const [path, message] of Object.entries(fieldErrors)) {
          if (!message) continue;
          setError(path as Path<InvoiceReviewFormValues>, {
            type: 'server',
            message,
          });
        }

        setSubmitError(
          errorPayload.error?.message ??
            'Validierung fehlgeschlagen. Bitte Eingaben prüfen.'
        );
        return;
      }

      const warningMessages =
        (payload as ApiSuccessPayload | null)?.warnings
          ?.map((warning) => warning.message?.trim() ?? '')
          .filter((message): message is string => message.length > 0) ?? [];
      setSubmitWarnings(warningMessages);
    }

    await onValidated?.(normalized);
    setSubmitSuccess('Daten erfolgreich validiert.');

    if (successRedirectTo) {
      router.push(successRedirectTo);
      router.refresh();
    }
  };

  return (
    <Card className="border border-border shadow-sm">
      <CardHeader className="space-y-2">
        <CardTitle>Review/Validate extracted data</CardTitle>
        <CardDescription>
          Bitte prüfen und korrigieren Sie die aus dem PDF extrahierten
          Rechnungsdaten vor dem Export.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form className="space-y-8" onSubmit={handleSubmit(onSubmit)} noValidate>
          <section className="space-y-4">
            <h3 className="text-base font-semibold">Header</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="header.profile">
                  Profil
                  {confidenceBadge(fieldConfidence, 'header.profile')}
                </Label>
                <Controller
                  control={control}
                  name="header.profile"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="header.profile">
                        <SelectValue placeholder="Profil auswählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {invoiceProfileValues.map((profile) => (
                          <SelectItem key={profile} value={profile}>
                            {profile}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError message={errors.header?.profile?.message} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="header.invoiceNumber">
                  Rechnungsnummer
                  {confidenceBadge(fieldConfidence, 'header.invoiceNumber')}
                </Label>
                <Input id="header.invoiceNumber" {...register('header.invoiceNumber')} />
                <FieldError message={errors.header?.invoiceNumber?.message} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="header.issueDate">
                  Rechnungsdatum
                  {confidenceBadge(fieldConfidence, 'header.issueDate')}
                </Label>
                <Input
                  id="header.issueDate"
                  type="date"
                  {...register('header.issueDate')}
                />
                <FieldError message={errors.header?.issueDate?.message} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="header.currency">
                  Währung
                  {confidenceBadge(fieldConfidence, 'header.currency')}
                </Label>
                <Input id="header.currency" {...register('header.currency')} />
                <FieldError message={errors.header?.currency?.message} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="header.dueDate">
                  Fälligkeitsdatum
                  {confidenceBadge(fieldConfidence, 'header.dueDate')}
                </Label>
                <Input
                  id="header.dueDate"
                  type="date"
                  {...register('header.dueDate')}
                />
                <FieldError message={errors.header?.dueDate?.message} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="header.buyerReference">
                  Buyer Reference (Leitweg-ID)
                  {confidenceBadge(fieldConfidence, 'header.buyerReference')}
                </Label>
                <Input
                  id="header.buyerReference"
                  {...register('header.buyerReference')}
                />
                <FieldError message={errors.header?.buyerReference?.message} />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-base font-semibold">Seller</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="seller.name">
                  Name
                  {confidenceBadge(fieldConfidence, 'seller.name')}
                </Label>
                <Input id="seller.name" {...register('seller.name')} />
                <FieldError message={errors.seller?.name?.message} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="seller.street">
                  Straße
                  {confidenceBadge(fieldConfidence, 'seller.street')}
                </Label>
                <Input id="seller.street" {...register('seller.street')} />
                <FieldError message={errors.seller?.street?.message} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="seller.postCode">
                  PLZ
                  {confidenceBadge(fieldConfidence, 'seller.postCode')}
                </Label>
                <Input id="seller.postCode" {...register('seller.postCode')} />
                <FieldError message={errors.seller?.postCode?.message} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="seller.city">
                  Ort
                  {confidenceBadge(fieldConfidence, 'seller.city')}
                </Label>
                <Input id="seller.city" {...register('seller.city')} />
                <FieldError message={errors.seller?.city?.message} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="seller.countryCode">
                  Land (ISO2)
                  {confidenceBadge(fieldConfidence, 'seller.countryCode')}
                </Label>
                <Input id="seller.countryCode" {...register('seller.countryCode')} />
                <FieldError message={errors.seller?.countryCode?.message} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="seller.vatId">
                  USt-IdNr.
                  {confidenceBadge(fieldConfidence, 'seller.vatId')}
                </Label>
                <Input id="seller.vatId" {...register('seller.vatId')} />
                <FieldError message={errors.seller?.vatId?.message} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="seller.taxNumber">
                  Steuernummer
                  {confidenceBadge(fieldConfidence, 'seller.taxNumber')}
                </Label>
                <Input id="seller.taxNumber" {...register('seller.taxNumber')} />
                <FieldError message={errors.seller?.taxNumber?.message} />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-base font-semibold">Buyer</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="buyer.name">
                  Name
                  {confidenceBadge(fieldConfidence, 'buyer.name')}
                </Label>
                <Input id="buyer.name" {...register('buyer.name')} />
                <FieldError message={errors.buyer?.name?.message} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="buyer.street">
                  Straße
                  {confidenceBadge(fieldConfidence, 'buyer.street')}
                </Label>
                <Input id="buyer.street" {...register('buyer.street')} />
                <FieldError message={errors.buyer?.street?.message} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="buyer.postCode">
                  PLZ
                  {confidenceBadge(fieldConfidence, 'buyer.postCode')}
                </Label>
                <Input id="buyer.postCode" {...register('buyer.postCode')} />
                <FieldError message={errors.buyer?.postCode?.message} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="buyer.city">
                  Ort
                  {confidenceBadge(fieldConfidence, 'buyer.city')}
                </Label>
                <Input id="buyer.city" {...register('buyer.city')} />
                <FieldError message={errors.buyer?.city?.message} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="buyer.countryCode">
                  Land (ISO2)
                  {confidenceBadge(fieldConfidence, 'buyer.countryCode')}
                </Label>
                <Input id="buyer.countryCode" {...register('buyer.countryCode')} />
                <FieldError message={errors.buyer?.countryCode?.message} />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-base font-semibold">Payment</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="payment.means">
                  Zahlungsart
                  {confidenceBadge(fieldConfidence, 'payment.means')}
                </Label>
                <Controller
                  control={control}
                  name="payment.means"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="payment.means">
                        <SelectValue placeholder="Zahlungsart wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {paymentMeansValues.map((entry) => (
                          <SelectItem key={entry.value} value={entry.value}>
                            {entry.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError message={errors.payment?.means?.message} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment.iban">
                  IBAN
                  {confidenceBadge(fieldConfidence, 'payment.iban')}
                </Label>
                <Input id="payment.iban" {...register('payment.iban')} />
                <FieldError message={errors.payment?.iban?.message} />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="payment.termsText">
                  Zahlungsbedingungen
                  {confidenceBadge(fieldConfidence, 'payment.termsText')}
                </Label>
                <Input id="payment.termsText" {...register('payment.termsText')} />
                <FieldError message={errors.payment?.termsText?.message} />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Lines</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  lines.append({
                    description: '',
                    quantity: 1,
                    unit: 'Stk',
                    unitPrice: 0,
                    netAmount: 0,
                    vatRate: 19,
                    vatCategory: 'S',
                  })
                }
              >
                <Plus className="mr-1 h-4 w-4" />
                Position
              </Button>
            </div>

            {lines.fields.map((field, index) => (
              <div key={field.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Position {index + 1}</h4>
                  {lines.fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => lines.remove(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor={`lines.${index}.description`}>
                      Beschreibung
                      {confidenceBadge(
                        fieldConfidence,
                        `lines.${index}.description`
                      )}
                    </Label>
                    <Input
                      id={`lines.${index}.description`}
                      {...register(`lines.${index}.description`)}
                    />
                    <FieldError message={errors.lines?.[index]?.description?.message} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`lines.${index}.quantity`}>
                      Menge
                      {confidenceBadge(fieldConfidence, `lines.${index}.quantity`)}
                    </Label>
                    <Input
                      id={`lines.${index}.quantity`}
                      type="number"
                      step="0.0001"
                      {...register(`lines.${index}.quantity`)}
                    />
                    <FieldError message={errors.lines?.[index]?.quantity?.message} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`lines.${index}.unit`}>
                      Einheit
                      {confidenceBadge(fieldConfidence, `lines.${index}.unit`)}
                    </Label>
                    <Input id={`lines.${index}.unit`} {...register(`lines.${index}.unit`)} />
                    <FieldError message={errors.lines?.[index]?.unit?.message} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`lines.${index}.unitPrice`}>
                      Einzelpreis
                      {confidenceBadge(fieldConfidence, `lines.${index}.unitPrice`)}
                    </Label>
                    <Input
                      id={`lines.${index}.unitPrice`}
                      type="number"
                      step="0.01"
                      {...register(`lines.${index}.unitPrice`)}
                    />
                    <FieldError message={errors.lines?.[index]?.unitPrice?.message} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`lines.${index}.netAmount`}>
                      Nettobetrag
                      {confidenceBadge(fieldConfidence, `lines.${index}.netAmount`)}
                    </Label>
                    <Input
                      id={`lines.${index}.netAmount`}
                      type="number"
                      step="0.01"
                      {...register(`lines.${index}.netAmount`)}
                    />
                    <FieldError message={errors.lines?.[index]?.netAmount?.message} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`lines.${index}.vatRate`}>
                      USt. Satz
                      {confidenceBadge(fieldConfidence, `lines.${index}.vatRate`)}
                    </Label>
                    <Controller
                      control={control}
                      name={`lines.${index}.vatRate`}
                      render={({ field: vatField }) => (
                        <Select
                          value={String(vatField.value)}
                          onValueChange={(value) => vatField.onChange(Number(value))}
                        >
                          <SelectTrigger id={`lines.${index}.vatRate`}>
                            <SelectValue placeholder="USt. Satz" />
                          </SelectTrigger>
                          <SelectContent>
                            {vatRateValues.map((rate) => (
                              <SelectItem key={rate} value={rate}>
                                {rate}%
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    <FieldError message={errors.lines?.[index]?.vatRate?.message} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`lines.${index}.vatCategory`}>
                      USt.-Kategorie
                      {confidenceBadge(
                        fieldConfidence,
                        `lines.${index}.vatCategory`
                      )}
                    </Label>
                    <Input
                      id={`lines.${index}.vatCategory`}
                      {...register(`lines.${index}.vatCategory`)}
                    />
                    <FieldError message={errors.lines?.[index]?.vatCategory?.message} />
                  </div>
                </div>
              </div>
            ))}
          </section>

          <section className="space-y-4">
            <h3 className="text-base font-semibold">Totals</h3>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="totals.netAmount">
                  Netto
                  {confidenceBadge(fieldConfidence, 'totals.netAmount')}
                </Label>
                <Input
                  id="totals.netAmount"
                  type="number"
                  step="0.01"
                  {...register('totals.netAmount')}
                />
                <FieldError message={errors.totals?.netAmount?.message} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="totals.vatAmount">
                  Steuer
                  {confidenceBadge(fieldConfidence, 'totals.vatAmount')}
                </Label>
                <Input
                  id="totals.vatAmount"
                  type="number"
                  step="0.01"
                  {...register('totals.vatAmount')}
                />
                <FieldError message={errors.totals?.vatAmount?.message} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="totals.grossAmount">
                  Brutto
                  {confidenceBadge(fieldConfidence, 'totals.grossAmount')}
                </Label>
                <Input
                  id="totals.grossAmount"
                  type="number"
                  step="0.01"
                  {...register('totals.grossAmount')}
                />
                <FieldError message={errors.totals?.grossAmount?.message} />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Tax Breakdown</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  taxBreakdown.append({
                    rate: 19,
                    taxableAmount: 0,
                    taxAmount: 0,
                  })
                }
              >
                <Plus className="mr-1 h-4 w-4" />
                Steuerzeile
              </Button>
            </div>

            {taxBreakdown.fields.map((field, index) => (
              <div key={field.id} className="rounded-lg border p-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor={`taxBreakdown.${index}.rate`}>
                      Satz
                      {confidenceBadge(
                        fieldConfidence,
                        `taxBreakdown.${index}.rate`
                      )}
                    </Label>
                    <Controller
                      control={control}
                      name={`taxBreakdown.${index}.rate`}
                      render={({ field: rateField }) => (
                        <Select
                          value={String(rateField.value)}
                          onValueChange={(value) => rateField.onChange(Number(value))}
                        >
                          <SelectTrigger id={`taxBreakdown.${index}.rate`}>
                            <SelectValue placeholder="Satz" />
                          </SelectTrigger>
                          <SelectContent>
                            {vatRateValues.map((rate) => (
                              <SelectItem key={rate} value={rate}>
                                {rate}%
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    <FieldError message={errors.taxBreakdown?.[index]?.rate?.message} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`taxBreakdown.${index}.taxableAmount`}>
                      Steuerpflichtig
                      {confidenceBadge(
                        fieldConfidence,
                        `taxBreakdown.${index}.taxableAmount`
                      )}
                    </Label>
                    <Input
                      id={`taxBreakdown.${index}.taxableAmount`}
                      type="number"
                      step="0.01"
                      {...register(`taxBreakdown.${index}.taxableAmount`)}
                    />
                    <FieldError
                      message={errors.taxBreakdown?.[index]?.taxableAmount?.message}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`taxBreakdown.${index}.taxAmount`}>
                      Steuerbetrag
                      {confidenceBadge(
                        fieldConfidence,
                        `taxBreakdown.${index}.taxAmount`
                      )}
                    </Label>
                    <Input
                      id={`taxBreakdown.${index}.taxAmount`}
                      type="number"
                      step="0.01"
                      {...register(`taxBreakdown.${index}.taxAmount`)}
                    />
                    <FieldError
                      message={errors.taxBreakdown?.[index]?.taxAmount?.message}
                    />
                  </div>
                </div>

                {taxBreakdown.fields.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-3"
                    onClick={() => taxBreakdown.remove(index)}
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    Entfernen
                  </Button>
                )}
              </div>
            ))}
          </section>

          {submitError && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {submitError}
            </p>
          )}

          {submitSuccess && (
            <p className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {submitSuccess}
            </p>
          )}

          {submitWarnings.length > 0 && (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              {submitWarnings.map((warning, index) => (
                <p key={`${warning}-${index}`}>{warning}</p>
              ))}
            </div>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Validierung...' : submitLabel}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
