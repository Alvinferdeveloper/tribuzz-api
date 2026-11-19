const HTML_ESCAPES: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
};

export const escapeHtml = (value: string): string =>
    value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);

interface LayoutOptions {
    appName: string;
    title: string;
    body: string;
}

/** Shared wrapper so every transactional email looks consistent. */
export const renderLayout = ({ appName, title, body }: LayoutOptions): string => `
<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: auto; border: 1px solid #ddd; padding: 20px;">
    <h1 style="color: #0056b3; text-align: center;">${escapeHtml(title)}</h1>
    ${body}
    <hr style="border: none; border-top: 1px solid #eee; margin-top: 20px;"/>
    <p style="font-size: 0.8em; color: #777; text-align: center;">© ${escapeHtml(appName)}</p>
</div>
`;

export const renderButton = (label: string, href: string): string => `
<p style="text-align: center; margin: 30px 0;">
    <a href="${escapeHtml(href)}" style="background-color: #007bff; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-size: 16px;">
        ${escapeHtml(label)}
    </a>
</p>
`;
