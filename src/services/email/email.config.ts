export interface EmailConfig {
    appName: string;
    /** Public URL of the frontend, used for links inside emails. */
    appUrl: string;
    /** Base URL of the hosted email images (frontend's public/email/). */
    assetsUrl: string;
    from: string;
    replyTo?: string;
    resendApiKey?: string;
    isProduction: boolean;
}

const DEFAULT_APP_NAME = 'Tribuzz';
const DEFAULT_APP_URL = 'http://localhost:3000';
const DEFAULT_FROM_ADDRESS = 'onboarding@resend.dev';

const stripTrailingSlash = (url: string) => url.replace(/\/+$/, '');

export const loadEmailConfig = (env: NodeJS.ProcessEnv = process.env): EmailConfig => {
    const appName = env.EMAIL_APP_NAME?.trim() || DEFAULT_APP_NAME;
    const fromAddress = env.EMAIL_FROM?.trim() || DEFAULT_FROM_ADDRESS;

    const appUrl = stripTrailingSlash(env.APP_URL?.trim() || DEFAULT_APP_URL);

    return {
        appName,
        appUrl,
        assetsUrl: stripTrailingSlash(env.EMAIL_ASSETS_URL?.trim() || `${appUrl}/email`),
        from: `${appName} <${fromAddress}>`,
        replyTo: env.EMAIL_REPLY_TO?.trim() || undefined,
        resendApiKey: env.RESEND_API_KEY?.trim() || undefined,
        isProduction: env.NODE_ENV === 'production',
    };
};
