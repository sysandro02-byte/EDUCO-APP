declare module 'web-push' {
  interface WebPushOptions {
    TTL?: number;
    urgency?: 'very-low' | 'low' | 'normal' | 'high';
    topic?: string;
  }

  interface WebPushSubscription {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  }

  const webpush: {
    setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
    sendNotification(subscription: WebPushSubscription, payload?: string, options?: WebPushOptions): Promise<any>;
  };

  export default webpush;
}
