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
        expect(config.appUrl).toBe('http://localhost:3000');
        expect(config.assetsUrl).toBe('http://localhost:3000/email');
        expect(config.isProduction).toBe(false);
    });

    it('builds the sender from EMAIL_APP_NAME and EMAIL_FROM', () => {
        const config = loadEmailConfig({ EMAIL_APP_NAME: 'Acme', EMAIL_FROM: 'no-reply@acme.com', NODE_ENV: 'production' });
        expect(config.from).toBe('Acme <no-reply@acme.com>');
        expect(config.isProduction).toBe(true);
    });

    it('strips trailing slashes from APP_URL', () => {
        expect(loadEmailConfig({ APP_URL: 'https://tribuzz.app/' }).appUrl).toBe('https://tribuzz.app');
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
        expect(message.subject).toBe('Confirma tu correo en Tribuzz');
        expect(message.text).toContain(url);
        expect(message.html).toContain('token=abc&amp;next=&quot;/&quot;');
        expect(message.html).not.toContain(url);
    });

    it('sends a welcome email with an escaped name and a link to the app', async () => {
        const provider = buildProvider();
        const service = new EmailService(provider, { ...config, appUrl: 'https://tribuzz.app' });

        await service.sendWelcomeEmail('user@test.com', '<b>Ana</b>');

        const message = (provider.send as jest.Mock).mock.calls[0][0];
        expect(message.subject).toBe('Te damos la bienvenida a Tribuzz');
        expect(message.html).toContain('&lt;b&gt;Ana&lt;/b&gt;');
        expect(message.html).toContain('https://tribuzz.app/tribus');
        expect(message.text).toContain('¡Hola, <b>Ana</b>!');
    });

    it('greets generically when the user has no name', async () => {
        const provider = buildProvider();
        await new EmailService(provider, config).sendWelcomeEmail('user@test.com', null);

        expect((provider.send as jest.Mock).mock.calls[0][0].text).toMatch(/^¡Ya eres parte de Tribuzz!/);
    });

    it('greets by first name and loads brand images from the assets URL', async () => {
        const provider = buildProvider();
        const service = new EmailService(provider, { ...config, assetsUrl: 'https://cdn.test/email' });

        await service.sendWelcomeEmail('user@test.com', 'Ana María López');

        const message = (provider.send as jest.Mock).mock.calls[0][0];
        expect(message.text).toMatch(/^¡Hola, Ana!/);
        expect(message.html).toContain('https://cdn.test/email/logo.png');
        expect(message.html).toContain('https://cdn.test/email/hero-welcome.png');
    });

    it('sends a password reset email with the link and expiry', async () => {
        const provider = buildProvider();
        await new EmailService(provider, config).sendPasswordResetEmail('user@test.com', 'https://api.test/reset/abc', 60);

        const message = (provider.send as jest.Mock).mock.calls[0][0];
        expect(message.subject).toBe('Restablece tu contraseña de Tribuzz');
        expect(message.text).toContain('https://api.test/reset/abc');
        expect(message.text).toContain('60 minutos');
    });

    it('wraps provider failures in a user-facing error', async () => {
        const provider = buildProvider(jest.fn().mockRejectedValue(new Error('boom')));
        const service = new EmailService(provider, config);

        await expect(service.sendVerificationEmail('user@test.com', 'https://x')).rejects.toThrow('No se pudo enviar el correo.');
    });
});
