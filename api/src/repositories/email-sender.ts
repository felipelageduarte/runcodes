import nodemailer, { type Transporter } from "nodemailer";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** Decouples services from nodemailer — same repository-pattern
 * decoupling as everywhere else, so UserService never knows SMTP
 * exists, just "a place to send an email". */
export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

export class SmtpEmailSender implements EmailSender {
  private readonly transporter: Transporter;

  constructor(
    private readonly from: string,
    config: { host: string; port: number; secure: boolean; user?: string; password?: string },
  ) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      ...(config.user && config.password
        ? { auth: { user: config.user, pass: config.password } }
        : {}),
    });
  }

  async send(message: EmailMessage): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }
}
