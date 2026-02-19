import { config } from '../config';
import { Linking } from 'react-native';

class PaymentsService {
  get isEnabled(): boolean {
    return config.features.payments;
  }

  // ─── STRIPE CHECKOUT (via WebView or browser) ─────────────────
  async createStripeCheckout(priceId: string, successUrl?: string): Promise<string | null> {
    if (!this.isEnabled || !config.stripePublishableKey || config.stripePublishableKey.startsWith('{{')) {
      console.warn('[Payments] Stripe not configured');
      return null;
    }

    try {
      // In managed mode, AppForge creates the checkout session
      if (config.mode === 'managed') {
        const res = await fetch(`${config.appforgeApiUrl}/sdk/${config.appId}/payments/checkout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ priceId, successUrl }),
        });
        const data = await res.json();
        return data.url || null;
      }

      // Self-managed: user needs their own backend endpoint
      console.warn('[Payments] Self-managed Stripe requires a backend endpoint');
      return null;
    } catch (err) {
      console.error('[Payments] Checkout failed:', err);
      return null;
    }
  }

  // ─── RAZORPAY (India) ─────────────────────────────────────────
  async createRazorpayOrder(amount: number, currency = 'INR'): Promise<any> {
    if (!config.razorpayKeyId || config.razorpayKeyId.startsWith('{{')) {
      console.warn('[Payments] Razorpay not configured');
      return null;
    }

    // Razorpay requires a backend to create orders
    if (config.mode === 'managed') {
      const res = await fetch(`${config.appforgeApiUrl}/sdk/${config.appId}/payments/razorpay-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, currency }),
      });
      return res.json();
    }

    return null;
  }

  // ─── OPEN PAYMENT LINK ────────────────────────────────────────
  async openPaymentLink(url: string): Promise<void> {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    }
  }

  // ─── CHECK PREMIUM STATUS ─────────────────────────────────────
  async isPremium(userId: string): Promise<boolean> {
    if (config.mode === 'managed') {
      try {
        const res = await fetch(
          `${config.appforgeApiUrl}/sdk/${config.appId}/payments/status/${userId}`
        );
        const data = await res.json();
        return data.isPremium || false;
      } catch {
        return false;
      }
    }
    // Self-managed: check from user's DB
    return false;
  }
}

export const payments = new PaymentsService();
