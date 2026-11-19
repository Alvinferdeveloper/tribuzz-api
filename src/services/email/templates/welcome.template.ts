import { RenderedEmail } from '../email.types';
import { button, paragraph, steps } from './components';
import { BrandContext, renderLayout } from './layout';
import { assets } from './theme';

interface WelcomeTemplateData extends BrandContext {
    name?: string | null;
}

const STEPS = [
    'Explora las tribus y encuentra la de lo que te apasiona.',
    'Entra y únete a la conversación en tiempo real.',
    '¿No existe la tuya? Créala e invita a tu gente.',
];

export const welcomeTemplate = ({ name, ...brand }: WelcomeTemplateData): RenderedEmail => {
    const exploreUrl = `${brand.appUrl}/tribus`;
    const firstName = name?.trim().split(/\s+/)[0];
    const title = firstName ? `¡Hola, ${firstName}! Ya eres parte de ${brand.appName}` : `¡Ya eres parte de ${brand.appName}!`;
    const intro = 'Aquí cada conversación encuentra su lugar: tribus de lo que te gusta y gente que lo vive igual que tú, hablando en tiempo real.';

    const html = renderLayout({
        ...brand,
        preheader: 'Tu tribu te espera alrededor de la fogata. Así puedes empezar.',
        hero: { file: assets.heroWelcome, alt: 'Una tribu de Buddies conversa alrededor de una fogata mientras llega alguien nuevo a saludar.' },
        kicker: 'Tu tribu te espera',
        title,
        body: [
            paragraph(intro),
            steps(STEPS),
            button('Explorar tribus', exploreUrl),
        ].join(''),
        reason: `Recibes este correo porque creaste una cuenta en ${brand.appName}.`,
    });

    const text = [
        title,
        '',
        intro,
        '',
        ...STEPS.map((step, i) => `${i + 1}. ${step}`),
        '',
        `Explora tribus: ${exploreUrl}`,
    ].join('\n');

    return { subject: `Te damos la bienvenida a ${brand.appName}`, html, text };
};
