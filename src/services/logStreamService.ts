import { EventEmitter } from 'events';
import { Response } from 'express';

export interface IngestLogEvent {
  id: string;
  type: 'info' | 'scan' | 'enrich' | 'save' | 'complete' | 'error';
  message: string;
  timestamp: string;
  data?: any;
}

class LogStreamService extends EventEmitter {
  private clients: Set<Response> = new Set();
  private recentLogs: IngestLogEvent[] = [];

  constructor() {
    super();
    this.setMaxListeners(50);
  }

  public addClient(res: Response): void {
    this.clients.add(res);

    // Send recent history (last 15 events) immediately upon connecting
    if (this.recentLogs.length > 0) {
      res.write(`data: ${JSON.stringify({ type: 'history', logs: this.recentLogs })}\n\n`);
    }

    res.on('close', () => {
      this.clients.delete(res);
    });
  }

  public emitLog(
    type: 'info' | 'scan' | 'enrich' | 'save' | 'complete' | 'error',
    message: string,
    data?: any
  ): void {
    const event: IngestLogEvent = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type,
      message,
      timestamp: new Date().toLocaleTimeString(),
      data,
    };

    // Keep last 30 logs in buffer
    this.recentLogs.push(event);
    if (this.recentLogs.length > 30) {
      this.recentLogs.shift();
    }

    const payload = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of this.clients) {
      try {
        client.write(payload);
      } catch {
        this.clients.delete(client);
      }
    }
  }

  public getRecentLogs(): IngestLogEvent[] {
    return this.recentLogs;
  }
}

export const logStream = new LogStreamService();
export default logStream;
