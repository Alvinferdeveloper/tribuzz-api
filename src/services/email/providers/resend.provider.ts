import { Resend } from 'resend';
import { EmailDeliveryError, EmailMessage, EmailProvider } from '../email.types';

interface ResendProviderOptions {
    apiKey: string;
    from: string;
    replyTo?: string;
}

export class ResendEmailProvider implements EmailProvider {
    readonly name = 'resend';
    private readonly client: Resend;

    constructor(private readonly options: ResendProviderOptions) {
        this.client = new Resend(options.apiKey);
    }

    async send(message: EmailMessage): Promise<void> {
        const { error } = await this.client.emails.send({
            from: this.options.from,
            to: message.to,
            subject: message.subject,
            html: message.html,
            text: message.text,
            replyTo: message.replyTo ?? this.options.replyTo,
        });

        if (error) {
            throw new EmailDeliveryError(`Resend rejected the email: ${error.message}`, error);
        }
    }
}
