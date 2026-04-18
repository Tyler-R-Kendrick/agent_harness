const DEV_SERVICE_WORKER_RESET_KEY = 'agent-browser:dev-service-worker-reset';
const SERVICE_WORKER_CACHE_PREFIX = 'agent-browser-';

type ServiceWorkerRegistrationLike = {
  unregister(): Promise<boolean> | boolean;
};

type ServiceWorkerContainerLike = {
  controller?: unknown;
  getRegistrations(): Promise<readonly ServiceWorkerRegistrationLike[]>;
  register(scriptUrl: string): Promise<unknown>;
};

type CacheStorageLike = {
  keys(): Promise<string[]>;
  delete(cacheName: string): Promise<boolean>;
};

type SessionStorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type ServiceWorkerSetupOptions = {
  isDev: boolean;
  serviceWorker?: ServiceWorkerContainerLike;
  cacheStorage?: CacheStorageLike;
  sessionStorage?: SessionStorageLike;
  addLoadListener(listener: () => void): void;
  reload(): void;
};

export async function resetDevelopmentServiceWorker({
  serviceWorker,
  cacheStorage,
  sessionStorage,
  reload,
}: Pick<ServiceWorkerSetupOptions, 'serviceWorker' | 'cacheStorage' | 'sessionStorage' | 'reload'>): Promise<void> {
  if (!serviceWorker) {
    return;
  }

  const registrations = await serviceWorker.getRegistrations().catch(() => []);
  const isControlled = Boolean(serviceWorker.controller);
  const didReloadAlready = sessionStorage?.getItem(DEV_SERVICE_WORKER_RESET_KEY) === 'true';

  await Promise.all(
    registrations.map((registration) => Promise.resolve(registration.unregister()).catch(() => false)),
  );

  if (cacheStorage) {
    const cacheNames = await cacheStorage.keys().catch(() => []);
    await Promise.all(
      cacheNames
        .filter((cacheName) => cacheName.startsWith(SERVICE_WORKER_CACHE_PREFIX))
        .map((cacheName) => cacheStorage.delete(cacheName).catch(() => false)),
    );
  }

  if (isControlled) {
    if (!didReloadAlready) {
      sessionStorage?.setItem(DEV_SERVICE_WORKER_RESET_KEY, 'true');
      reload();
    }
    return;
  }

  sessionStorage?.removeItem(DEV_SERVICE_WORKER_RESET_KEY);
}

export function configureServiceWorker(options?: Partial<ServiceWorkerSetupOptions>): void {
  const serviceWorker = options?.serviceWorker ?? navigator.serviceWorker;

  if (!serviceWorker) {
    return;
  }

  if (options?.isDev ?? import.meta.env.DEV) {
    void resetDevelopmentServiceWorker({
      serviceWorker,
      cacheStorage: options?.cacheStorage ?? (typeof caches === 'undefined' ? undefined : caches),
      sessionStorage: options?.sessionStorage ?? window.sessionStorage,
      reload: options?.reload ?? (() => window.location.reload()),
    });
    return;
  }

  (options?.addLoadListener ?? ((listener) => window.addEventListener('load', listener)))(() => {
    serviceWorker.register('/sw.js').catch(() => undefined);
  });
}