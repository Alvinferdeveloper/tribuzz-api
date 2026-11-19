import { RenderedEmail } from '../email.types';
import { escapeHtml, renderButton, renderLayout } from './layout';

interface PasswordResetTemplateData {
    appName: string;
    resetUrl: string;
    expiresInMinutes: number;
}

export const passwordResetTemplate = ({ appName, resetUrl, expiresInMinutes }: PasswordResetTemplateData): RenderedEmail => {
    const subject = `Restablece tu contraseña de ${appName}`;

    const html = renderLayout({
        appName,
        title: 'Restablece tu contraseña',
        body: `
            <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta. Haz clic en el botón para elegir una nueva:</p>
            ${renderButton('Elegir nueva contraseña', resetUrl)}
            <p>El enlace caduca en ${expiresInMinutes} minutos y solo se puede usar una vez.</p>
            <p>Si el botón no funciona, copia y pega la siguiente URL en tu navegador:</p>
            <p style="font-size: 0.9em; word-break: break-all; color: #007bff;">${escapeHtml(resetUrl)}</p>
            <p>Si no pediste este cambio, ignora este mensaje: tu contraseña seguirá siendo la misma.</p>
        `,
    });

    const text = [
        'Restablece tu contraseña',
        '',
        'Recibimos una solicitud para restablecer la contraseña de tu cuenta. Abre este enlace para elegir una nueva:',
        resetUrl,
        '',
        `El enlace caduca en ${expiresInMinutes} minutos y solo se puede usar una vez.`,
        'Si no pediste este cambio, ignora este mensaje.',
    ].join('\n');

    return { subject, html, text };
};
