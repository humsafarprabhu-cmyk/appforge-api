import { config } from '../config';
import { Platform } from 'react-native';

// AdMob Test IDs (safe for development)
const TEST_BANNER = Platform.select({
  android: 'ca-app-pub-3940256099942544/6300978111',
  ios: 'ca-app-pub-3940256099942544/2934735716',
}) || '';

const TEST_INTERSTITIAL = Platform.select({
  android: 'ca-app-pub-3940256099942544/1033173712',
  ios: 'ca-app-pub-3940256099942544/4411468910',
}) || '';

const TEST_REWARDED = Platform.select({
  android: 'ca-app-pub-3940256099942544/5224354917',
  ios: 'ca-app-pub-3940256099942544/1712485313',
}) || '';

class AdsService {
  private _initialized = false;

  get bannerId(): string {
    return config.admobBannerId && !config.admobBannerId.startsWith('{{')
      ? config.admobBannerId
      : TEST_BANNER;
  }

  get interstitialId(): string {
    return config.admobInterstitialId && !config.admobInterstitialId.startsWith('{{')
      ? config.admobInterstitialId
      : TEST_INTERSTITIAL;
  }

  get rewardedId(): string {
    return config.admobRewardedId && !config.admobRewardedId.startsWith('{{')
      ? config.admobRewardedId
      : TEST_REWARDED;
  }

  get isEnabled(): boolean {
    return config.features.ads;
  }

  async initialize(): Promise<void> {
    if (!this.isEnabled || this._initialized) return;
    // AdMob initialization would go here
    // Requires expo-ads-admob or react-native-google-mobile-ads
    this._initialized = true;
    console.log('[Ads] Initialized with banner:', this.bannerId);
  }

  async showInterstitial(): Promise<boolean> {
    if (!this.isEnabled) return false;
    try {
      // Implementation depends on ad library
      console.log('[Ads] Show interstitial:', this.interstitialId);
      return true;
    } catch (err) {
      console.error('[Ads] Interstitial failed:', err);
      return false;
    }
  }

  async showRewarded(): Promise<boolean> {
    if (!this.isEnabled) return false;
    try {
      console.log('[Ads] Show rewarded:', this.rewardedId);
      return true;
    } catch (err) {
      console.error('[Ads] Rewarded failed:', err);
      return false;
    }
  }
}

export const ads = new AdsService();
