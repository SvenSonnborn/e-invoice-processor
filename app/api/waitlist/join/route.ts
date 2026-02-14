import { prisma } from '@/src/lib/db/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const joinSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  company: z.string().trim().max(120).optional(),
  tier: z.enum(['pro', 'business']),
  referredBy: z.preprocess(
    (value) => (value === null ? undefined : value),
    z.string().trim().min(1).max(100).optional()
  ),
});

const WAITLIST_SUCCESS_MESSAGE =
  "Thanks! If your signup is valid, you'll receive a confirmation email shortly.";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = joinSchema.parse(body);

    // Return a generic success response for existing emails to avoid account enumeration.
    const existing = await prisma.waitlistEntry.findUnique({
      where: { email: validated.email },
    });

    if (existing) {
      return NextResponse.json({
        success: true,
        message: WAITLIST_SUCCESS_MESSAGE,
      });
    }

    // Verify referral code if provided
    let referredById: string | undefined;
    if (validated.referredBy) {
      const referrer = await prisma.waitlistEntry.findUnique({
        where: { referralCode: validated.referredBy },
      });
      if (referrer) {
        referredById = referrer.id;
      }
    }

    // Create waitlist entry
    const entry = await prisma.waitlistEntry.create({
      data: {
        email: validated.email,
        name: validated.name,
        company: validated.company || null,
        tier: validated.tier,
        earlyBird: true,
        referredBy: referredById,
      },
    });

    // Generate referral link
    const referralLink = `${process.env.NEXT_PUBLIC_SITE_URL}/?ref=${entry.referralCode}`;

    // Send confirmation email (async, don't block)
    sendConfirmationEmail(entry, referralLink).catch(console.error);

    return NextResponse.json({
      success: true,
      message: WAITLIST_SUCCESS_MESSAGE,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Waitlist join error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function sendConfirmationEmail(
  entry: {
    id: string;
    email: string;
    name: string;
    referralCode: string;
  },
  referralLink: string
) {
  try {
    // Check if Resend API key is configured
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.log('Resend API key not configured, skipping email send');
      return;
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.FROM_EMAIL || 'noreply@e-rechnung.app',
        to: entry.email,
        subject: "You're on the E-Rechnung waitlist! 🎉",
        html: generateEmailHtml(entry.name, referralLink),
      }),
    });

    if (response.ok) {
      await prisma.waitlistEntry.update({
        where: { id: entry.id },
        data: {
          emailSent: true,
          emailSentAt: new Date(),
        },
      });
    } else {
      console.error('Failed to send waitlist confirmation email', {
        status: response.status,
      });
    }
  } catch (error) {
    console.error('Error sending waitlist confirmation email', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function generateEmailHtml(name: string, referralLink: string): string {
  const safeName = escapeHtml(name);
  const safeReferralLink = escapeHtml(referralLink);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to the E-Rechnung Waitlist</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 40px 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; margin-bottom: 30px; }
    .header h1 { color: white; margin: 0; font-size: 28px; }
    .content { background: #f9fafb; padding: 30px; border-radius: 12px; }
    .button { display: inline-block; padding: 14px 28px; background: #4f46e5; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .referral-box { background: white; border: 2px dashed #e5e7eb; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; }
    .referral-link { font-family: monospace; background: #f3f4f6; padding: 10px; border-radius: 4px; word-break: break-all; }
    .footer { text-align: center; padding: 30px 0; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 You're on the list!</h1>
    </div>
    
    <div class="content">
      <h2>Hi ${safeName},</h2>
      
      <p>Thank you for joining the E-Rechnung waitlist! We're excited to have you on board.</p>
      
      <p>As a waitlist member, you'll get:</p>
      <ul>
        <li>✅ Early access to the beta</li>
        <li>✅ <strong>50% off forever</strong> on any plan</li>
        <li>✅ Priority support</li>
        <li>✅ Influence on product features</li>
      </ul>
      
      <div class="referral-box">
        <h3>📈 Move up the list!</h3>
        <p>Share your unique referral link with friends and colleagues to move up the waitlist:</p>
        <div class="referral-link">${safeReferralLink}</div>
        <p style="margin-top: 15px; font-size: 14px; color: #6b7280;">
          Each referral moves you up one position!
        </p>
      </div>
      
      <p>We'll notify you as soon as we're ready to welcome you to the beta.</p>
      
      <p>Stay tuned!<br>The E-Rechnung Team</p>
    </div>
    
    <div class="footer">
      <p>E-Rechnung - Automated E-Invoice Processing</p>
      <p style="font-size: 12px;">
        You're receiving this because you signed up for the E-Rechnung waitlist.
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
