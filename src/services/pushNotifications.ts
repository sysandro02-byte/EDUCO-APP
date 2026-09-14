import { requestSchoolApi } from './api';

export type PushPermissionState = 'unsupported' | 'default' | 'denied' | 'granted';

export interface PushActivationResult {
  success: boolean;
  permission: PushPermissionState;
  message: string;
}

const isPushSupported = () => typeof window !== 'undefined'
  && window.isSecureContext
  && 'serviceWorker' in navigator
  && 'PushManager' in window
  && 'Notification' in window;

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
};

const sameKey = (left: ArrayBuffer | null, right: Uint8Array) => {
  if (!left) return false;
  const a = new Uint8Array(left);
  if (a.length !== right.length) return false;
  return a.every((value, index) => value === right[index]);
};

export const getPushPermissionState = (): PushPermissionState => {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
};

export async function syncExistingPushSubscription() {
  if (!isPushSupported() || Notification.permission !== 'granted') return false;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return false;
  await requestSchoolApi('/api/push/subscribe', { subscription: subscription.toJSON() });
  return true;
}

export async function enablePushNotifications(): Promise<PushActivationResult> {
  if (!isPushSupported()) {
    return {
      success: false,
      permission: 'unsupported',
      message: 'Les notifications push ne sont pas prises en charge sur cet appareil ou cette connexion n’est pas sécurisée.',
    };
  }

  try {
    const config = await requestSchoolApi('/api/push/config');
    if (!config?.configured || !config?.publicKey) {
      return {
        success: false,
        permission: Notification.permission,
        message: 'Le serveur EDUCO n’a pas encore ses clés VAPID configurées.',
      };
    }

    const permission = Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();

    if (permission !== 'granted') {
      return {
        success: false,
        permission,
        message: permission === 'denied'
          ? 'Les notifications sont bloquées dans les réglages de l’appareil.'
          : 'Autorisation des notifications non accordée.',
      };
    }

    const registration = await navigator.serviceWorker.ready;
    const applicationServerKey = urlBase64ToUint8Array(config.publicKey);
    let subscription = await registration.pushManager.getSubscription();

    if (subscription && !sameKey(subscription.options.applicationServerKey, applicationServerKey)) {
      await subscription.unsubscribe();
      subscription = null;
    }

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
    }

    await requestSchoolApi('/api/push/subscribe', { subscription: subscription.toJSON() });

    return {
      success: true,
      permission: 'granted',
      message: 'Notifications EDUCO activées sur cet appareil.',
    };
  } catch (error: any) {
    return {
      success: false,
      permission: getPushPermissionState(),
      message: error?.message || 'Impossible d’activer les notifications push.',
    };
  }
}

export async function disablePushNotifications() {
  if (!isPushSupported()) return false;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return true;
  await requestSchoolApi('/api/push/unsubscribe', { endpoint: subscription.endpoint }).catch(() => null);
  return subscription.unsubscribe();
}

export async function sendTestPushNotification() {
  return requestSchoolApi('/api/push/test', {
    title: 'EDUCO',
    message: 'Les notifications push sont actives sur cet appareil.',
    link: '/',
  });
}
