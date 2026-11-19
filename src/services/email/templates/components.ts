import { bubbleRadius, colors, fontStack } from './theme';

/**
 * Small, composable HTML blocks for email bodies. Table-based and fully
 * inline-styled, which is what email clients reliably support. Every
 * dynamic value goes through escapeHtml.
 */

const HTML_ESCAPES: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
};

export const escapeHtml = (value: string): string =>
    value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);

export const paragraph = (text: string): string =>
    `<p style="margin:0 0 16px;font-family:${fontStack};font-size:16px;line-height:1.65;color:${colors.muted};">${escapeHtml(text)}</p>`;

/** Primary call to action, shaped like a speech bubble. */
export const button = (label: string, href: string): string => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px;">
    <tr>
        <td style="background:${colors.primary};border-radius:${bubbleRadius};">
            <a href="${escapeHtml(href)}" target="_blank" style="display:inline-block;padding:15px 30px;font-family:${fontStack};font-size:16px;font-weight:700;line-height:1;color:${colors.onPrimary};text-decoration:none;border-radius:${bubbleRadius};">${escapeHtml(label)}</a>
        </td>
    </tr>
</table>`;

/** Plain link for when the button doesn't work (some clients block styled links). */
export const fallbackLink = (href: string): string => `
<p style="margin:24px 0 0;font-family:${fontStack};font-size:13px;line-height:1.6;color:${colors.faint};">
    ¿El botón no funciona? Copia y pega este enlace en tu navegador:<br />
    <a href="${escapeHtml(href)}" target="_blank" style="color:${colors.link};word-break:break-all;">${escapeHtml(href)}</a>
</p>`;

/** Quiet aside: expiry times, security notes. */
export const note = (text: string): string => `
<p style="margin:20px 0 0;padding:14px 16px;background:${colors.paper};border-radius:12px;font-family:${fontStack};font-size:14px;line-height:1.55;color:${colors.muted};">${escapeHtml(text)}</p>`;

const STEP_TONES = [colors.sun, colors.violet, colors.teal] as const;

/** Numbered steps, each number sitting in a logo-colored bubble. */
export const steps = (items: string[]): string => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 4px;">
    ${items.map((item, i) => `
    <tr>
        <td valign="top" style="padding:0 14px 14px 0;">
            <div style="width:30px;height:30px;line-height:30px;text-align:center;background:${STEP_TONES[i % STEP_TONES.length]};border-radius:${bubbleRadius};font-family:${fontStack};font-size:14px;font-weight:700;color:${colors.ink};">${i + 1}</div>
        </td>
        <td valign="top" style="padding:5px 0 14px;font-family:${fontStack};font-size:15px;line-height:1.5;color:${colors.ink};">${escapeHtml(item)}</td>
    </tr>`).join('')}
</table>`;
