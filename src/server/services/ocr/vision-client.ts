/**
 * Google Cloud Vision API Client
 *
 * Handles communication with Google Cloud Vision API for text detection.
 */

import { logger } from '@/src/lib/logging';
import { OcrError, OcrErrorCode } from './errors';
import type { OcrOptions } from './index';

// Google Cloud Vision API response types
interface AnnotateImageResponse {
  fullTextAnnotation?: FullTextAnnotation;
  textAnnotations?: TextAnnotation[];
  error?: {
    code: number;
    message: string;
  };
}

interface FullTextAnnotation {
  text: string;
  pages: Page[];
}

interface Page {
  blocks: Block[];
  confidence: number;
}

interface Block {
  paragraphs: Paragraph[];
  blockType: string;
}

interface Paragraph {
  words: Word[];
}

interface Word {
  symbols: Symbol[];
}

interface Symbol {
  text: string;
  confidence: number;
}

interface TextAnnotation {
  description: string;
  confidence: number;
  boundingPoly?: {
    vertices: { x: number; y: number }[];
  };
}

interface BatchAnnotateFilesResponse {
  responses: AnnotateFileResponse[];
}

interface AnnotateFileResponse {
  responses: AnnotateImageResponse[];
  error?: {
    code: number;
    message: string;
  };
}

export class VisionClient {
  private apiKey: string;
  private projectId: string | undefined;
  private baseUrl = 'https://vision.googleapis.com/v1';

  constructor(apiKey?: string, projectId?: string) {
    this.apiKey = apiKey || process.env.GOOGLE_CLOUD_VISION_API_KEY || '';
    this.projectId = projectId || process.env.GOOGLE_CLOUD_PROJECT_ID;

    if (!this.apiKey) {
      throw new OcrError(
        OcrErrorCode.CONFIGURATION_ERROR,
        'Google Cloud Vision API key is not configured'
      );
    }
  }

  /**
   * Annotate a single image using DOCUMENT_TEXT_DETECTION
   * Best for dense text and structured documents
   */
  async annotateImage(
    imageBuffer: Buffer,
    mimeType: string,
    options: OcrOptions
  ): Promise<AnnotateImageResponse> {
    const base64Image = imageBuffer.toString('base64');

    const request = {
      requests: [
        {
          image: {
            content: base64Image,
          },
          features: [
            {
              type: 'DOCUMENT_TEXT_DETECTION',
              model: 'latest',
            },
          ],
          imageContext: {
            languageHints: options.languageHints || ['de', 'en'],
          },
        },
      ],
    };

    logger.debug('Sending image annotation request to Vision API');

    const response = await this.makeApiRequest<{
      responses: AnnotateImageResponse[];
    }>('images:annotate', request, options.timeoutMs);

    if (response.responses[0]?.error) {
      throw new OcrError(
        OcrErrorCode.API_ERROR,
        `Vision API error: ${response.responses[0].error.message}`,
        { code: response.responses[0].error.code }
      );
    }

    return response.responses[0];
  }

  /**
   * Batch annotate files (PDF, TIFF with multiple pages)
   * Uses async batch processing for large documents
   */
  async batchAnnotateFiles(
    fileBuffer: Buffer,
    mimeType: string,
    options: OcrOptions
  ): Promise<AnnotateFileResponse[]> {
    const base64Content = fileBuffer.toString('base64');

    const request = {
      requests: [
        {
          inputConfig: {
            content: base64Content,
            mimeType: mimeType,
          },
          features: [
            {
              type: 'DOCUMENT_TEXT_DETECTION',
            },
          ],
          imageContext: {
            languageHints: options.languageHints || ['de', 'en'],
          },
        },
      ],
    };

    logger.debug('Sending batch file annotation request to Vision API');

    // For files (PDF/TIFF), we use the files:annotate endpoint
    const response = await this.makeApiRequest<BatchAnnotateFilesResponse>(
      'files:annotate',
      request,
      options.timeoutMs
    );

    // Handle errors in responses
    for (const fileResponse of response.responses) {
      if (fileResponse.error) {
        throw new OcrError(
          OcrErrorCode.API_ERROR,
          `Vision API batch error: ${fileResponse.error.message}`,
          { code: fileResponse.error.code }
        );
      }
    }

    return response.responses;
  }

  /**
   * Make API request to Google Cloud Vision
   */
  private async makeApiRequest<T>(
    endpoint: string,
    body: unknown,
    timeoutMs: number = 60000
  ): Promise<T> {
    const url = `${this.baseUrl}/${endpoint}?key=${this.apiKey}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new OcrError(
          OcrErrorCode.API_ERROR,
          `Vision API HTTP error: ${response.status} ${response.statusText}`,
          { status: response.status, error: errorData }
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof OcrError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new OcrError(
            OcrErrorCode.TIMEOUT,
            `Vision API request timed out after ${timeoutMs}ms`
          );
        }
        throw new OcrError(
          OcrErrorCode.NETWORK_ERROR,
          `Network error: ${error.message}`
        );
      }

      throw error;
    }
  }
}

export type {
  AnnotateImageResponse,
  FullTextAnnotation,
  TextAnnotation,
  AnnotateFileResponse,
};
