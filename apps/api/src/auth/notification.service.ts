import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Environment } from '../config/environment';

@Injectable()
export class NotificationService {
  private readonly ses: SESv2Client;

  constructor(private readonly config: ConfigService<Environment, true>) {
    this.ses = new SESv2Client({ region: config.get('AWS_REGION', { infer: true }) });
  }

  async sendPasswordReset(email: string, token: string): Promise<void> {
    const url = `${this.config.get('APP_BASE_URL', { infer: true })}/reset-password?token=${encodeURIComponent(token)}`;
    await this.deliver(
      email,
      'Reset your ConsultFlow password',
      `Use this single-use link within 30 minutes:\n\n${url}`,
    );
  }

  async sendInvitation(email: string, token: string): Promise<void> {
    const url = `${this.config.get('APP_BASE_URL', { infer: true })}/accept-invitation?token=${encodeURIComponent(token)}`;
    await this.deliver(
      email,
      'You are invited to ConsultFlow',
      `Create your password using this single-use link:\n\n${url}`,
    );
  }

  private async deliver(email: string, subject: string, text: string): Promise<void> {
    if (this.config.get('EMAIL_PROVIDER', { infer: true }) === 'console') {
      // This adapter is rejected by production environment validation.
      console.info(`[consultflow-local-email] to=${email} subject=${subject}\n${text}`);
      return;
    }
    await this.ses.send(
      new SendEmailCommand({
        FromEmailAddress: this.config.get('EMAIL_FROM', { infer: true }),
        Destination: { ToAddresses: [email] },
        Content: { Simple: { Subject: { Data: subject }, Body: { Text: { Data: text } } } },
      }),
    );
  }
}
