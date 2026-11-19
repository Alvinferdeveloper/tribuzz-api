import { RenderedEmail } from '../email.types';
import { button, fallbackLink, note, paragraph } from './components';
import { BrandContext, renderLayout } from './layout';
import { assets } from './theme';

interface PasswordResetTemplateData extends BrandContext {
    resetUrl: string;
    expiresInMinutes: number;
}

export const passwordResetTemplate = ({ resetUrl, expiresInMinutes, ...brand }: PasswordResetTemplateData): RenderedEmail => {
    const intro = 'Recibimos una solicitud para restablecer la contraseña de tu cuenta. Elige una nueva y vuelve a tus tribus.';
    const expiry = `El enlace caduca en ${expiresInMinutes} minutos y solo funciona una vez. Si no pediste este cambio, ignora este correo: tu contraseña seguirá igual.`;

    const html = renderLayout({
        ...brand,
        preheader: `Elige una nueva contraseña. El enlace caduca en ${expiresInMinutes} minutos.`,
        hero: { file: assets.heroPasswordReset, alt: 'Un Buddy sostiene una burbuja con una llave.' },
        kicker: 'Recupera tu acceso',
        title: 'Restablece tu contraseña',
        body: [
            paragraph(intro),
            button('Elegir nueva contraseña', resetUrl),
            note(expiry),
            fallbackLink(resetUrl),
        ].join(''),
        reason: `Recibes este correo porque alguien pidió restablecer la contraseña de tu cuenta en ${brand.appName}.`,
    });

    const text = ['Restablece tu contraseña', '', intro, '', resetUrl, '', expiry].join('\n');

    return { subject: `Restablece tu contraseña de ${brand.appName}`, html, text };
};
