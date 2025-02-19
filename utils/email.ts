import nodemailer from 'nodemailer';

interface EmailConfig {
    from: string;
    host: string;
    port: number;
    auth: {
        user: string;
        pass: string;
    }
}

interface EmailService {
    send(to: string, subject: string, text: string): Promise<void>;
}

const email: EmailService = {
    async send(to: string, subject: string, text: string): Promise<void> {
        const transporter = nodemailer.createTransport(emailConfig);
        await transporter.sendMail({
            from: emailConfig.from,
            to,
            subject,
            html: text
        });
    }
}; 