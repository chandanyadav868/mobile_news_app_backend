import fs from 'fs';
import path from 'path';

export interface BetaTesterRecord {
    id: string;
    email: string;
    name?: string | null;
    deviceType: 'ANDROID' | 'IOS' | 'BOTH';
    notes?: string | null;
    status: 'PENDING' | 'INVITED' | 'INSTALLED';
    inviteSentAt?: string | null;
    inviteCount: number;
    createdAt: string;
    updatedAt: string;
}

const DATA_FILE = path.join(process.cwd(), 'data', 'beta_testers.json');

export class BetaTesterService {
    private static testers: Map<string, BetaTesterRecord> = new Map();
    private static isLoaded = false;

    private static ensureLoaded(): void {
        if (this.isLoaded) return;
        try {
            if (fs.existsSync(DATA_FILE)) {
                const raw = fs.readFileSync(DATA_FILE, 'utf8');
                const list: BetaTesterRecord[] = JSON.parse(raw);
                if (Array.isArray(list)) {
                    list.forEach((t) => this.testers.set(t.email.toLowerCase().trim(), t));
                }
            }
        } catch (e) {
            console.warn('[BetaTesterService] Could not read beta_testers.json:', e);
        }
        this.isLoaded = true;
    }

    private static saveToDisk(): void {
        try {
            const dir = path.dirname(DATA_FILE);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            const list = Array.from(this.testers.values());
            fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), 'utf8');
        } catch (e) {
            console.error('[BetaTesterService] Failed to write beta_testers.json:', e);
        }
    }

    /**
     * Register a new beta tester from the public waitlist landing page
     */
    public static async register(data: {
        email: string;
        name?: string | null;
        deviceType?: string;
        notes?: string | null;
    }): Promise<{ tester: BetaTesterRecord; isNew: boolean }> {
        this.ensureLoaded();

        const cleanEmail = data.email.toLowerCase().trim();
        const existing = this.testers.get(cleanEmail);

        if (existing) {
            // Update deviceType or name if provided
            if (data.name) existing.name = data.name.trim();
            if (data.deviceType) existing.deviceType = data.deviceType.toUpperCase() as any;
            if (data.notes) existing.notes = data.notes.trim();
            existing.updatedAt = new Date().toISOString();
            this.saveToDisk();
            return { tester: existing, isNew: false };
        }

        const newTester: BetaTesterRecord = {
            id: `beta-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            email: cleanEmail,
            name: data.name ? data.name.trim() : null,
            deviceType: (data.deviceType ? data.deviceType.toUpperCase() : 'ANDROID') as any,
            notes: data.notes ? data.notes.trim() : null,
            status: 'PENDING',
            inviteSentAt: null,
            inviteCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        this.testers.set(cleanEmail, newTester);
        this.saveToDisk();
        return { tester: newTester, isNew: true };
    }

    /**
     * Get all registered beta testers
     */
    public static getAll(): BetaTesterRecord[] {
        this.ensureLoaded();
        return Array.from(this.testers.values()).sort((a, b) => {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
    }

    /**
     * Find by ID or Email
     */
    public static find(idOrEmail: string): BetaTesterRecord | null {
        this.ensureLoaded();
        const byEmail = this.testers.get(idOrEmail.toLowerCase().trim());
        if (byEmail) return byEmail;
        return Array.from(this.testers.values()).find((t) => t.id === idOrEmail) || null;
    }

    /**
     * Mark an invitation as sent
     */
    public static markInviteSent(email: string): BetaTesterRecord | null {
        this.ensureLoaded();
        const tester = this.testers.get(email.toLowerCase().trim());
        if (tester) {
            tester.status = 'INVITED';
            tester.inviteSentAt = new Date().toISOString();
            tester.inviteCount += 1;
            tester.updatedAt = new Date().toISOString();
            this.saveToDisk();
            return tester;
        }
        return null;
    }

    /**
     * Delete a tester
     */
    public static delete(idOrEmail: string): boolean {
        this.ensureLoaded();
        const tester = this.find(idOrEmail);
        if (tester) {
            this.testers.delete(tester.email.toLowerCase().trim());
            this.saveToDisk();
            return true;
        }
        return false;
    }

    /**
     * Get Summary Metrics
     */
    public static getMetrics(): {
        total: number;
        android: number;
        ios: number;
        both: number;
        pending: number;
        invited: number;
    } {
        this.ensureLoaded();
        const list = Array.from(this.testers.values());
        return {
            total: list.length,
            android: list.filter((t) => t.deviceType === 'ANDROID').length,
            ios: list.filter((t) => t.deviceType === 'IOS').length,
            both: list.filter((t) => t.deviceType === 'BOTH').length,
            pending: list.filter((t) => t.status === 'PENDING').length,
            invited: list.filter((t) => t.status === 'INVITED').length,
        };
    }
}
