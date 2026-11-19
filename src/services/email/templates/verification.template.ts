import { RenderedEmail } from '../email.types';
import { escapeHtml, renderButton, renderLayout } from './layout';

interface VerificationTemplateData {
    appName: string;
    verificationUrl: string;
}

export const verificationTemplate = ({ appName, verificationUrl }: VerificationTemplateData): RenderedEmail => {
    const subject = `Verifica tu cuenta en ${appName}`;

    const html = renderLayout({
        appName,
        title: `¡Bienvenido a ${appName}!`,
        body: `
            <p>Gracias por registrarte. Solo falta un paso más. Por favor, haz clic en el siguiente botón para verificar tu dirección de correo electrónico y activar tu cuenta:</p>
            ${renderButton('Verificar mi cuenta', verificationUrl)}
            <p>Si el botón no funciona, copia y pega la siguiente URL en tu navegador:</p>
            <p style="font-size: 0.9em; word-break: break-all; color: #007bff;">${escapeHtml(verificationUrl)}</p>
            <p>Si no te registraste en ${escapeHtml(appName)}, puedes ignorar este mensaje de forma segura.</p>
        `,
    });

    const text = [
        `¡Bienvenido a ${appName}!`,
        '',
        'Gracias por registrarte. Verifica tu correo visitando el siguiente enlace:',
        verificationUrl,
        '',
        `Si no te registraste en ${appName}, puedes ignorar este mensaje.`,
    ].join('\n');

    return { subject, html, text };
};
