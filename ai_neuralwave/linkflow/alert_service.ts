import nodemailer from "nodemailer"

export interface AlertConfig {
  email?: {
    host: string
    port: number
    user: string
    pass: string
    from: string
    to: string[]
    secure?: boolean
  }
  console?: boolean
}

export interface AlertSignal {
  title: string
  message: string
  level: "info" | "warning" | "critical"
  timestamp?: string
}

export class AlertService {
  constructor(private cfg: AlertConfig) {}

  private async sendEmail(signal: AlertSignal) {
    if (!this.cfg.email) return
    const { host, port, user, pass, from, to, secure } = this.cfg.email
    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: secure ?? false,
        auth: { user, pass },
      })
      await transporter.sendMail({
        from,
        to,
        subject: `[${signal.level.toUpperCase()}] ${signal.title}`,
        text: `${signal.message}\n\nTimestamp: ${signal.timestamp ?? new Date().toISOString()}`,
      })
    } catch (err) {
      console.error("Failed to send email alert:", err)
    }
  }

  private logConsole(signal: AlertSignal) {
    if (!this.cfg.console) return
    const prefix = `[Alert][${signal.level.toUpperCase()}]`
    const time = signal.timestamp ?? new Date().toISOString()
    console.log(`${prefix} ${signal.title} @ ${time}\n${signal.message}`)
  }

  async dispatch(signals: AlertSignal[]) {
    for (const sig of signals) {
      const enriched: AlertSignal = {
        ...sig,
        timestamp: sig.timestamp ?? new Date().toISOString(),
      }
      await this.sendEmail(enriched)
      this.logConsole(enriched)
    }
  }

  /**
   * Helper to send a single alert directly
   */
  async send(signal: AlertSignal) {
    return this.dispatch([signal])
  }
}
