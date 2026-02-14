import { describe, expect, it } from 'bun:test';
import {
  buildAttachmentContentDisposition,
  sanitizeExportFilename,
} from '@/src/lib/exports/filename';

describe('export filename hardening', () => {
  it('sanitizes custom filenames and enforces format extension', () => {
    const filename = sanitizeExportFilename('../../evil\r\nname.pdf', 'CSV');
    expect(filename).toBe('evilname.csv');
  });

  it('adds missing extension for xrechnung exports', () => {
    const filename = sanitizeExportFilename('RE-2026-1001', 'XRECHNUNG');
    expect(filename).toBe('RE-2026-1001.xml');
  });

  it('builds Content-Disposition with sanitized fallback and utf-8 filename', () => {
    const header = buildAttachmentContentDisposition('evil"\r\n.txt');
    expect(header).toContain('attachment;');
    expect(header).toContain('filename="evil___.txt"');
    expect(header).toContain("filename*=UTF-8''");
    expect(header.includes('\r')).toBe(false);
    expect(header.includes('\n')).toBe(false);
  });
});
