export interface EmailMessage {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
    replyTo?: string;
}

export interface RenderedEmail {
    subject: string;
    html: string;
    text: string;
}

/**
 * Contract every delivery backend must fulfil. The rest of the app depends
 * only on this interface, so swapping Resend for another provider (or a fake
 * in tests) never touches business code.
 */
export interface EmailProvider {
    readonly name: string;
    send(message: EmailMessage): Promise<void>;
}

export class EmailDeliveryError extends Error {
    constructor(message: string, public readonly cause?: unknown) {
        super(message);
        this.name = 'EmailDeliveryError';
    }
}
