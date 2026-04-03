import nodemailer, { Transporter } from "nodemailer"

export interface AlertConfig {
  email?: {
    host: string
    port: number
    secure?: boolean
    user: string
    pass: string
    from: string
    to: string[]
  }
  console?: boolean
}

export interface AlertSignal {
  title: string
  message: string
  level: "info" | "warning" | "critical"
  timestamp?: number
}

export class AlertService {
  private transporter?: Transporter

  constructor(private cfg: AlertConfig) {
    if (cfg.email) {
      this.transporter = nodemailer.createTransport({
        host: cfg.email.host,
        port: cfg.email.port,
        secure: cfg.email.secure ?? false,
        auth: { user: cfg.email.user, pass: cfg.email.pass },
      })
    }
  }

  private async sendEmail(signal: AlertSignal): Promise<void> {
    if (!this.transporter || !this.cfg.email) return
    const { from, to } = this.cfg.email
    try {
      await this.transporter.sendMail({
        from,
        to,
        subject: `[${signal.level.toUpperCase()}] ${signal.title}`,
        text: `[${new Date(signal.timestamp ?? Date.now()).toISOString()}]\n${signal.message}`,
      })
    } catch (err: any) {
      console.error(`Email send failed: ${err.message}`)
    }
  }

  private logConsole(signal: AlertSignal): void {
    if (!this.cfg.console) return
    const ts = new Date(signal.timestamp ?? Date.now()).toISOString()
    console.log(
      `[Alert][${signal.level.toUpperCase()}] ${signal.title} @ ${ts}\n${signal.message}`
    )
  }

  async dispatch(signals: AlertSignal[]): Promise<void> {
    for (const sig of signals) {
      await this.sendEmail(sig)
      this.logConsole(sig)
    }
  }
}
