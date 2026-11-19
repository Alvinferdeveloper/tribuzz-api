import logger from '../../lib/logger';
import { EmailConfig, loadEmailConfig } from './email.config';
import { EmailProvider, RenderedEmail } from './email.types';
import { createEmailProvider } from './providers';
import { verificationTemplate } from './templates/verification.template';

export class EmailService {
    constructor(
        private readonly provider: EmailProvider,
        private readonly config: EmailConfig,
    ) {}

    async sendVerificationEmail(to: string, verificationUrl: string): Promise<void> {
        const email = verificationTemplate({ appName: this.config.appName, verificationUrl });
        await this.deliver(to, email, 'verification');
    }

    private async deliver(to: string, email: RenderedEmail, kind: string): Promise<void> {
        try {
            await this.provider.send({ to, ...email });
            logger.info('Email sent', { kind, provider: this.provider.name });
        } catch (error) {
            logger.error('Error sending email', {
                kind,
                provider: this.provider.name,
                error: (error as Error).message,
            });
            throw new Error('No se pudo enviar el correo.');
        }
    }
}

const config = loadEmailConfig();

export const emailService = new EmailService(createEmailProvider(config), config);
