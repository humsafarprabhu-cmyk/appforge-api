// AppForge Configuration
// Mode: 'managed' = AppForge handles everything | 'self-managed' = your own backend

export const config = {
  // App Info
  appName: '{{appName}}',
  appId: '{{appId}}',

  // Database Mode
  mode: '{{dbMode}}' as 'managed' | 'self-managed',

  // Managed Mode (AppForge backend)
  appforgeApiUrl: 'https://api.appforge.dev',

  // Self-Managed Mode: Supabase
  supabaseUrl: '{{supabaseUrl}}',
  supabaseAnonKey: '{{supabaseAnonKey}}',

  // Self-Managed Mode: Firebase (alternative)
  // firebaseConfig: {
  //   apiKey: '{{firebaseApiKey}}',
  //   authDomain: '{{firebaseAuthDomain}}',
  //   projectId: '{{firebaseProjectId}}',
  //   storageBucket: '{{firebaseStorageBucket}}',
  //   messagingSenderId: '{{firebaseMessagingSenderId}}',
  //   appId: '{{firebaseAppId}}',
  // },

  // Monetization
  admobAppId: '{{admobAppId}}',
  admobBannerId: '{{admobBannerId}}',
  admobInterstitialId: '{{admobInterstitialId}}',
  admobRewardedId: '{{admobRewardedId}}',

  // Payments
  stripePublishableKey: '{{stripePublishableKey}}',
  razorpayKeyId: '{{razorpayKeyId}}',

  // Features
  features: {
    auth: {{authEnabled}},
    ads: {{adsEnabled}},
    payments: {{paymentsEnabled}},
    pushNotifications: {{pushEnabled}},
    analytics: {{analyticsEnabled}},
  },
};
