import logger from '../../../lib/logger';
import { EmailMessage, EmailProvider } from '../email.types';

/**
 * Development fallback used when no Resend API key is configured.
 * Logs the email instead of sending it so local flows (e.g. verification)
 * keep working without external credentials.
 */
export class ConsoleEmailProvider implements EmailProvider {
    readonly name = 'console';

    async send(message: EmailMessage): Promise<void> {
        logger.info('[email:console] Email not sent (no provider configured)', {
            to: message.to,
            subject: message.subject,
            text: message.text,
        });
    }
}
