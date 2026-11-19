import { EmailService } from '../../services/email/email.service';
import { loadEmailConfig } from '../../services/email/email.config';
import { createEmailProvider, ConsoleEmailProvider, ResendEmailProvider } from '../../services/email/providers';
import { EmailProvider } from '../../services/email/email.types';

jest.mock('../../lib/logger', () => ({
    __esModule: true,
    default: { info: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const buildProvider = (send: EmailProvider['send'] = jest.fn().mockResolvedValue(undefined)): EmailProvider => ({
    name: 'fake',
    send,
});

describe('loadEmailConfig', () => {
    it('applies defaults when env vars are missing', () => {
        const config = loadEmailConfig({});
        expect(config.appName).toBe('Tribuzz');
        expect(config.from).toBe('Tribuzz <onboarding@resend.dev>');
        expect(config.resendApiKey).toBeUndefined();
        expect(config.isProduction).toBe(false);
    });

    it('builds the sender from EMAIL_APP_NAME and EMAIL_FROM', () => {
        const config = loadEmailConfig({ EMAIL_APP_NAME: 'Acme', EMAIL_FROM: 'no-reply@acme.com', NODE_ENV: 'production' });
        expect(config.from).toBe('Acme <no-reply@acme.com>');
        expect(config.isProduction).toBe(true);
    });
});

describe('createEmailProvider', () => {
    it('returns the Resend provider when an API key is present', () => {
        const provider = createEmailProvider(loadEmailConfig({ RESEND_API_KEY: 're_test' }));
        expect(provider).toBeInstanceOf(ResendEmailProvider);
    });

    it('falls back to the console provider outside production', () => {
        const provider = createEmailProvider(loadEmailConfig({}));
        expect(provider).toBeInstanceOf(ConsoleEmailProvider);
    });

    it('fails fast in production without an API key', () => {
        expect(() => createEmailProvider(loadEmailConfig({ NODE_ENV: 'production' }))).toThrow('RESEND_API_KEY');
    });
});

describe('EmailService', () => {
    const config = loadEmailConfig({ EMAIL_APP_NAME: 'Tribuzz' });

    it('sends the verification email with html, text and escaped url', async () => {
        const provider = buildProvider();
        const service = new EmailService(provider, config);
        const url = 'https://app.test/verify?token=abc&next="/"';

        await service.sendVerificationEmail('user@test.com', url);

        expect(provider.send).toHaveBeenCalledTimes(1);
        const message = (provider.send as jest.Mock).mock.calls[0][0];
        expect(message.to).toBe('user@test.com');
        expect(message.subject).toBe('Verifica tu cuenta en Tribuzz');
        expect(message.text).toContain(url);
        expect(message.html).toContain('token=abc&amp;next=&quot;/&quot;');
        expect(message.html).not.toContain(url);
    });

    it('wraps provider failures in a user-facing error', async () => {
        const provider = buildProvider(jest.fn().mockRejectedValue(new Error('boom')));
        const service = new EmailService(provider, config);

        await expect(service.sendVerificationEmail('user@test.com', 'https://x')).rejects.toThrow('No se pudo enviar el correo.');
    });
});
