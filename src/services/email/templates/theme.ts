/**
 * Tribuzz brand tokens for email. Mirrors the app's palette (globals.css),
 * converted from OKLCH to hex because email clients don't support oklch().
 * Images live in the frontend's public/email/ (see its
 * scripts/email-assets), since email clients don't render SVG.
 */
export const colors = {
    night: '#0d1528',
    nightText: '#f1f6fc',
    nightMuted: '#a4aec2',
    paper: '#f0f4f9',
    card: '#f9fbfe',
    ink: '#101828',
    muted: '#545e6f',
    faint: '#7f8793',
    primary: '#cc3148',
    onPrimary: '#fef9f8',
    link: '#ba2840',
    sun: '#f8d14f',
    violet: '#ab79f5',
    teal: '#4cd7c8',
    sunSoft: '#fef2cc',
} as const;

/** Montserrat where web fonts load (Apple Mail, iOS), system sans elsewhere. */
export const fontStack = "'Montserrat', 'Segoe UI', Helvetica, Arial, sans-serif";

/** Speech-bubble corners, like the logo: three round corners and a sharper "tail". */
export const bubbleRadius = '16px 16px 16px 4px';

export const assets = {
    logo: 'logo.png',
    buddiesRow: 'buddies-row.png',
    heroWelcome: 'hero-welcome.png',
    heroPasswordReset: 'hero-password-reset.png',
    heroVerification: 'hero-verification.png',
} as const;
