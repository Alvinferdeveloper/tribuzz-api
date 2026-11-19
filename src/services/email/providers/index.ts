import { EmailConfig } from '../email.config';
import { EmailProvider } from '../email.types';
import { ConsoleEmailProvider } from './console.provider';
import { ResendEmailProvider } from './resend.provider';

export const createEmailProvider = (config: EmailConfig): EmailProvider => {
    if (config.resendApiKey) {
        return new ResendEmailProvider({
            apiKey: config.resendApiKey,
            from: config.from,
            replyTo: config.replyTo,
        });
    }

    if (config.isProduction) {
        throw new Error('RESEND_API_KEY is required in production to send emails.');
    }

    return new ConsoleEmailProvider();
};

export { ConsoleEmailProvider, ResendEmailProvider };
