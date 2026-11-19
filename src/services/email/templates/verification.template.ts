import { RenderedEmail } from '../email.types';
import { button, fallbackLink, note, paragraph } from './components';
import { BrandContext, renderLayout } from './layout';
import { assets } from './theme';

interface VerificationTemplateData extends BrandContext {
    verificationUrl: string;
}

export const verificationTemplate = ({ verificationUrl, ...brand }: VerificationTemplateData): RenderedEmail => {
    const intro = `Confirma que este correo es tuyo para dejar tu cuenta de ${brand.appName} lista. Solo te tomará un clic.`;
    const ignore = `Si no creaste una cuenta en ${brand.appName}, puedes ignorar este correo sin problema.`;

    const html = renderLayout({
        ...brand,
        preheader: 'Un clic y tu cuenta queda lista.',
        hero: { file: assets.heroVerification, alt: 'Un Buddy sonriente junto a una burbuja con un visto bueno.' },
        kicker: 'Un paso más',
        title: 'Confirma tu correo',
        body: [
            paragraph(intro),
            button('Confirmar mi correo', verificationUrl),
            note(ignore),
            fallbackLink(verificationUrl),
        ].join(''),
        reason: `Recibes este correo porque se usó esta dirección para crear una cuenta en ${brand.appName}.`,
    });

    const text = ['Confirma tu correo', '', intro, '', verificationUrl, '', ignore].join('\n');

    return { subject: `Confirma tu correo en ${brand.appName}`, html, text };
};
