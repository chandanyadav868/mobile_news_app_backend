import { Request, Response } from 'express';

export interface SduiUiConfig {
    version: string;
    updatedAt: string;
    theme: {
        primaryColor: string;
        accentColor: string;
        cardBorderRadius: number;
        darkBg: string;
        lightBg: string;
    };
    topNav: {
        tabs: Array<{
            id: string;
            label: string;
            badge?: string | null;
        }>;
    };
    cardLayout: {
        imageHeightPercent: number;
        showGeminiVoice: boolean;
        showEdgeTts: boolean;
        showReactionRow: boolean;
        showPublisherPill: boolean;
        counterPosition: 'top-left' | 'top-right' | 'hidden';
        storyFontSize: 'small' | 'medium' | 'large';
    };
    monetization: {
        interstitialEnabled: boolean;
        firstAdIndex: number;
        adFrequency: number;
    };
    features: {
        enableDeepDive: boolean;
        enableLiveTranslation: boolean;
        enableOfflineCaching: boolean;
    };
}

export const defaultUiConfig: SduiUiConfig = {
    version: '1.0.0',
    updatedAt: new Date().toISOString(),
    theme: {
        primaryColor: '#E53935',
        accentColor: '#3B82F6',
        cardBorderRadius: 16,
        darkBg: '#070A12',
        lightBg: '#FFFFFF',
    },
    topNav: {
        tabs: [
            { id: 'My Feed', label: 'My Feed', badge: null },
            { id: '⏰ Daily Dose', label: '⏰ Daily Dose', badge: 'HOT' },
            { id: 'Timelines', label: 'Timelines', badge: null },
            { id: 'Insights', label: 'Insights', badge: 'NEW' },
            { id: 'National', label: 'National', badge: null },
            { id: 'World', label: 'World', badge: null },
            { id: 'Business', label: 'Business', badge: null },
            { id: 'Technology', label: 'Technology', badge: null },
            { id: 'Entertainment', label: 'Entertainment', badge: null },
            { id: 'Sports', label: 'Sports', badge: null },
        ],
    },
    cardLayout: {
        imageHeightPercent: 34,
        showGeminiVoice: true,
        showEdgeTts: true,
        showReactionRow: true,
        showPublisherPill: true,
        counterPosition: 'top-left',
        storyFontSize: 'medium',
    },
    monetization: {
        interstitialEnabled: true,
        firstAdIndex: 5,
        adFrequency: 6,
    },
    features: {
        enableDeepDive: true,
        enableLiveTranslation: true,
        enableOfflineCaching: true,
    },
};

export class SduiController {
    public static async getUiConfig(_req: Request, res: Response): Promise<void> {
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.json({
            success: true,
            config: defaultUiConfig,
        });
    }

    public static async updateUiConfig(req: Request, res: Response): Promise<void> {
        const updates = req.body;
        if (updates && typeof updates === 'object') {
            Object.assign(defaultUiConfig, updates, { updatedAt: new Date().toISOString() });
        }
        res.json({
            success: true,
            config: defaultUiConfig,
        });
    }
}
