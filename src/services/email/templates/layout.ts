import { escapeHtml } from './components';
import { assets, bubbleRadius, colors, fontStack } from './theme';

export { escapeHtml };

export interface BrandContext {
    appName: string;
    appUrl: string;
    /** Base URL of the hosted email images. */
    assetsUrl: string;
}

interface LayoutOptions extends BrandContext {
    /** Inbox preview text, shown next to the subject. */
    preheader: string;
    hero: { file: string; alt: string };
    /** Short label above the title, in a sun speech bubble. */
    kicker: string;
    title: string;
    /** Body HTML, built with the helpers in components.ts. */
    body: string;
    /** Why the person got this email, shown in the footer. */
    reason: string;
}

const asset = (assetsUrl: string, file: string) => `${assetsUrl}/${file}`;

/**
 * Shared shell for every Tribuzz email: a night-sky header with the logo and
 * a brand illustration, a light card for the content, and a footer with the
 * Buddies. 600px wide, collapsing on phones.
 */
export const renderLayout = ({
    appName, appUrl, assetsUrl, preheader, hero, kicker, title, body, reason,
}: LayoutOptions): string => `<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>${escapeHtml(title)}</title>
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap" rel="stylesheet" />
    <style>
        @media only screen and (max-width: 620px) {
            .container { width: 100% !important; }
            .px { padding-left: 24px !important; padding-right: 24px !important; }
            .title { font-size: 24px !important; }
        }
    </style>
</head>
<body style="margin:0;padding:0;background:${colors.paper};-webkit-text-size-adjust:100%;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(preheader)}&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${colors.paper};">
        <tr>
            <td align="center" style="padding:32px 12px;">
                <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
                    <tr>
                        <td class="px" style="background:${colors.night};border-radius:24px 24px 0 0;padding:26px 36px 4px;">
                            <a href="${escapeHtml(appUrl)}" target="_blank" style="text-decoration:none;">
                                <img src="${asset(assetsUrl, assets.logo)}" width="36" height="36" alt="" style="display:inline-block;vertical-align:middle;border:0;" />
                                <span style="display:inline-block;vertical-align:middle;margin-left:10px;font-family:${fontStack};font-size:21px;font-weight:700;letter-spacing:-0.3px;color:${colors.nightText};">${escapeHtml(appName)}</span>
                            </a>
                        </td>
                    </tr>
                    <tr>
                        <td style="background:${colors.night};line-height:0;font-size:0;">
                            <img src="${asset(assetsUrl, hero.file)}" width="600" alt="${escapeHtml(hero.alt)}" style="display:block;width:100%;max-width:600px;height:auto;border:0;color:${colors.nightMuted};font-family:${fontStack};font-size:14px;" />
                        </td>
                    </tr>
                    <tr>
                        <td class="px" style="background:${colors.card};border-radius:0 0 24px 24px;padding:36px 44px 40px;">
                            <span style="display:inline-block;padding:6px 12px;background:${colors.sunSoft};border-radius:${bubbleRadius};font-family:${fontStack};font-size:12px;font-weight:700;letter-spacing:0.4px;text-transform:uppercase;color:${colors.ink};">${escapeHtml(kicker)}</span>
                            <h1 class="title" style="margin:16px 0 16px;font-family:${fontStack};font-size:28px;line-height:1.2;font-weight:700;letter-spacing:-0.4px;color:${colors.ink};">${escapeHtml(title)}</h1>
                            ${body}
                        </td>
                    </tr>
                    <tr>
                        <td align="center" class="px" style="padding:32px 36px 8px;">
                            <img src="${asset(assetsUrl, assets.buddiesRow)}" width="96" height="24" alt="" style="display:block;border:0;margin:0 auto 14px;" />
                            <p style="margin:0 0 6px;font-family:${fontStack};font-size:13px;line-height:1.5;color:${colors.muted};">
                                <a href="${escapeHtml(appUrl)}" target="_blank" style="color:${colors.muted};font-weight:700;text-decoration:none;">${escapeHtml(appName)}</a> · Donde cada conversación encuentra su lugar
                            </p>
                            <p style="margin:0;font-family:${fontStack};font-size:12px;line-height:1.5;color:${colors.faint};">${escapeHtml(reason)}</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
