import logger from '../../lib/logger';
import { EmailConfig, loadEmailConfig } from './email.config';
import { EmailProvider, RenderedEmail } from './email.types';
import { createEmailProvider } from './providers';
import { passwordResetTemplate } from './templates/password-reset.template';
import { verificationTemplate } from './templates/verification.template';
import { welcomeTemplate } from './templates/welcome.template';

export class EmailService {
    constructor(
        private readonly provider: EmailProvider,
        private readonly config: EmailConfig,
    ) {}

    async sendVerificationEmail(to: string, verificationUrl: string): Promise<void> {
        const email = verificationTemplate({ appName: this.config.appName, verificationUrl });
        await this.deliver(to, email, 'verification');
    }

    async sendWelcomeEmail(to: string, name?: string | null): Promise<void> {
        const email = welcomeTemplate({ appName: this.config.appName, appUrl: this.config.appUrl, name });
        await this.deliver(to, email, 'welcome');
    }

    async sendPasswordResetEmail(to: string, resetUrl: string, expiresInMinutes: number): Promise<void> {
        const email = passwordResetTemplate({ appName: this.config.appName, resetUrl, expiresInMinutes });
        await this.deliver(to, email, 'password-reset');
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

/**
 * Fire-and-forget delivery for auth flows. Not awaiting keeps response times
 * identical whether or not the account exists (no email enumeration) and a
 * provider outage never breaks sign-up or login. Failures are already logged
 * by EmailService.
 */
export const sendInBackground = (delivery: Promise<void>): void => {
    delivery.catch(() => undefined);
};
