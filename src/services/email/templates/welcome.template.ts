import { RenderedEmail } from '../email.types';
import { escapeHtml, renderButton, renderLayout } from './layout';

interface WelcomeTemplateData {
    appName: string;
    appUrl: string;
    name?: string | null;
}

export const welcomeTemplate = ({ appName, appUrl, name }: WelcomeTemplateData): RenderedEmail => {
    const exploreUrl = `${appUrl}/tribus`;
    const greeting = name?.trim() ? `¡Hola, ${name.trim()}!` : '¡Hola!';
    const subject = `Te damos la bienvenida a ${appName}`;

    const html = renderLayout({
        appName,
        title: `Bienvenido a ${appName}`,
        body: `
            <p>${escapeHtml(greeting)}</p>
            <p>Nos alegra tenerte aquí. En ${escapeHtml(appName)} encontrarás tribus de lo que te apasiona y gente con quien conversar en tiempo real.</p>
            ${renderButton('Explorar tribus', exploreUrl)}
        `,
    });

    const text = [
        greeting,
        '',
        `Nos alegra tenerte aquí. En ${appName} encontrarás tribus de lo que te apasiona y gente con quien conversar en tiempo real.`,
        '',
        `Explora tribus: ${exploreUrl}`,
    ].join('\n');

    return { subject, html, text };
};
