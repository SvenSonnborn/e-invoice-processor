import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { PDFDocument, PDFName, PDFRef, PDFStream } from 'pdf-lib';
import { env } from '@/src/lib/config/env';
import { validateXRechnungXML } from '@/src/lib/generators/xrechnungGenerator';
import { extractXMLFromPDF } from '@/src/lib/zugferd/zugferd-parser';

const execFileAsync = promisify(execFile);
const DEFAULT_VALIDATOR_TIMEOUT_MS = 30000;

export type EInvoiceValidationFormat = 'XRECHNUNG' | 'ZUGFERD';
export type EInvoiceValidationIssueSeverity = 'error' | 'warning';
export type EInvoiceValidationIssueSource = 'builtin' | 'official';

export interface EInvoiceValidationIssue {
  severity: EInvoiceValidationIssueSeverity;
  source: EInvoiceValidationIssueSource;
  message: string;
}

export interface EInvoiceValidationResult {
  valid: boolean;
  usedOfficialValidator: boolean;
  issues: EInvoiceValidationIssue[];
}

interface BuiltinXRechnungValidation {
  valid: boolean;
  errors: string[];
}

interface ValidateXRechnungExportInput {
  xml: string;
  builtinValidation?: BuiltinXRechnungValidation;
}

interface ValidateZugferdExportInput {
  pdf: Uint8Array;
  xrechnungXml: string;
}

export async function validateXRechnungExport(
  input: ValidateXRechnungExportInput
): Promise<EInvoiceValidationResult> {
  const issues: EInvoiceValidationIssue[] = [];

  const builtin =
    input.builtinValidation ??
    (await validateXRechnungXML(input.xml).then((result) => ({
      valid: result.valid,
      errors: result.errors,
    })));

  if (!builtin.valid) {
    for (const error of builtin.errors) {
      issues.push({
        severity: 'error',
        source: 'builtin',
        message: error,
      });
    }
  }

  const officialCommand = env.XRECHNUNG_VALIDATOR_COMMAND?.trim();
  let usedOfficialValidator = false;

  if (officialCommand) {
    usedOfficialValidator = true;
    const officialResult = await runOfficialValidatorCommand({
      commandTemplate: officialCommand,
      extension: '.xml',
      payload: input.xml,
    });
    issues.push(...officialResult.issues);
  } else {
    issues.push({
      severity: 'warning',
      source: 'official',
      message:
        'Official XRechnung validator command is not configured. Manual official validation can be performed via https://www.xrechnung.org/validator.',
    });
  }

  return {
    valid: issues.every((issue) => issue.severity !== 'error'),
    usedOfficialValidator,
    issues,
  };
}

export async function validateZugferdExport(
  input: ValidateZugferdExportInput
): Promise<EInvoiceValidationResult> {
  const issues: EInvoiceValidationIssue[] = [];

  const embeddedXml = await extractXMLFromPDF(input.pdf).catch((error) => {
    issues.push({
      severity: 'error',
      source: 'builtin',
      message: `Embedded XML extraction failed: ${getErrorMessage(error)}`,
    });
    return null;
  });

  if (embeddedXml && embeddedXml.trim() !== input.xrechnungXml.trim()) {
    issues.push({
      severity: 'error',
      source: 'builtin',
      message:
        'Embedded XML in generated ZUGFeRD PDF does not match generated XRechnung XML.',
    });
  }

  const xrechnungValidation = await validateXRechnungXML(
    input.xrechnungXml
  ).catch((error) => ({
    valid: false,
    errors: [`XRechnung XML validation failed: ${getErrorMessage(error)}`],
  }));

  if (!xrechnungValidation.valid) {
    for (const error of xrechnungValidation.errors) {
      issues.push({
        severity: 'error',
        source: 'builtin',
        message: error,
      });
    }
  }

  const metadataXml = await readMetadataXml(input.pdf).catch((error) => {
    issues.push({
      severity: 'error',
      source: 'builtin',
      message: `PDF metadata inspection failed: ${getErrorMessage(error)}`,
    });
    return null;
  });

  if (metadataXml) {
    if (!metadataXml.includes('<pdfaid:part>3</pdfaid:part>')) {
      issues.push({
        severity: 'error',
        source: 'builtin',
        message: 'Generated PDF is missing pdfaid:part=3 metadata marker.',
      });
    }
    if (
      !metadataXml.includes('<pdfaid:conformance>B</pdfaid:conformance>')
    ) {
      issues.push({
        severity: 'error',
        source: 'builtin',
        message:
          'Generated PDF is missing pdfaid:conformance=B metadata marker.',
      });
    }
    if (!metadataXml.includes('<fx:DocumentFileName>')) {
      issues.push({
        severity: 'error',
        source: 'builtin',
        message:
          'Generated PDF metadata is missing fx:DocumentFileName for ZUGFeRD attachment.',
      });
    }
  }

  const officialCommand = env.ZUGFERD_VALIDATOR_COMMAND?.trim();
  let usedOfficialValidator = false;

  if (officialCommand) {
    usedOfficialValidator = true;
    const officialResult = await runOfficialValidatorCommand({
      commandTemplate: officialCommand,
      extension: '.pdf',
      payload: Buffer.from(input.pdf),
    });
    issues.push(...officialResult.issues);
  } else {
    issues.push({
      severity: 'warning',
      source: 'official',
      message:
        'Official ZUGFeRD validator command is not configured. Manual official validation can be performed via https://www.ferd-net.de/werkzeuge/prueftools/index.html.',
    });
  }

  return {
    valid: issues.every((issue) => issue.severity !== 'error'),
    usedOfficialValidator,
    issues,
  };
}

export function formatValidationErrorMessage(
  format: EInvoiceValidationFormat,
  result: EInvoiceValidationResult
): string {
  const details = result.issues
    .filter((issue) => issue.severity === 'error')
    .map((issue) => `[${issue.source}] ${issue.message}`)
    .join(' | ');

  return `${format} validation failed: ${details || 'Unknown validation error'}`;
}

interface RunValidatorCommandInput {
  commandTemplate: string;
  extension: '.xml' | '.pdf';
  payload: string | Buffer;
}

async function runOfficialValidatorCommand(
  input: RunValidatorCommandInput
): Promise<Pick<EInvoiceValidationResult, 'issues'>> {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'einvoice-validator-'));
  const inputFilePath = path.join(tempDir, `invoice${input.extension}`);
  const timeoutMs = parseTimeoutMs(env.EINVOICE_VALIDATOR_TIMEOUT_MS);

  try {
    await writeFile(inputFilePath, input.payload);

    const command = buildCommand(input.commandTemplate, inputFilePath);

    await execFileAsync('/bin/sh', ['-c', command], {
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024 * 10,
    });

    return { issues: [] };
  } catch (error) {
    const outputLines = extractCommandOutputLines(error);
    if (outputLines.length === 0) {
      outputLines.push(getErrorMessage(error));
    }

    return {
      issues: outputLines.map((line) => ({
        severity: 'error' as const,
        source: 'official' as const,
        message: line,
      })),
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function buildCommand(commandTemplate: string, inputFilePath: string): string {
  const escapedPath = shellEscape(inputFilePath);
  if (commandTemplate.includes('{input}')) {
    return commandTemplate.replaceAll('{input}', escapedPath);
  }
  return `${commandTemplate} ${escapedPath}`;
}

function parseTimeoutMs(raw: string | undefined): number {
  if (!raw) {
    return DEFAULT_VALIDATOR_TIMEOUT_MS;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_VALIDATOR_TIMEOUT_MS;
  }
  return parsed;
}

function extractCommandOutputLines(error: unknown): string[] {
  if (!error || typeof error !== 'object') {
    return [];
  }

  const maybeError = error as {
    stdout?: string | Buffer;
    stderr?: string | Buffer;
    message?: string;
  };

  const lines = [
    ...splitOutputLines(maybeError.stderr),
    ...splitOutputLines(maybeError.stdout),
  ];

  if (lines.length > 0) {
    return lines.slice(0, 20);
  }

  if (maybeError.message?.trim()) {
    return [maybeError.message.trim()];
  }

  return [];
}

function splitOutputLines(value: string | Buffer | undefined): string[] {
  if (!value) return [];
  const text = Buffer.isBuffer(value) ? value.toString('utf8') : value;
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  return 'Unknown error';
}

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

async function readMetadataXml(pdfBytes: Uint8Array): Promise<string> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const metadataRef = pdfDoc.catalog.get(PDFName.of('Metadata')) as
    | PDFRef
    | undefined;

  if (!metadataRef) {
    throw new Error('Metadata stream not found.');
  }

  const metadataStream = pdfDoc.context.lookup(metadataRef) as
    | PDFStream
    | undefined;
  if (!metadataStream) {
    throw new Error('Metadata stream is not readable.');
  }

  const bytes = (
    metadataStream as unknown as {
      getContents(): Uint8Array;
    }
  ).getContents();

  return new TextDecoder('utf-8').decode(bytes);
}
