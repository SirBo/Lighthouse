import { describe, it, expect, vi, beforeEach } from 'vitest';
import AuthenticationController from './authController';
import { getEnvironments } from '@/react/portainer/environments/environment.service';
import { dispatchCacheRefreshEvent } from '@/portainer/services/http-request.helper';
import { AuthenticationMethod } from '@/react/portainer/settings/types';

vi.mock('@/react/portainer/environments/environment.service', () => ({
  getEnvironments: vi.fn().mockResolvedValue({ value: [] }),
}));

vi.mock('@/portainer/services/http-request.helper', () => ({
  dispatchCacheRefreshEvent: vi.fn(),
}));

type Mock = ReturnType<typeof vi.fn>;

const getEnvironmentsMock = getEnvironments as unknown as Mock;
const dispatchCacheRefreshEventMock = dispatchCacheRefreshEvent as unknown as Mock;

function createController(overrides?: {
  stateManagerLogo?: string | null;
  localStorage?: Partial<ReturnType<typeof defaultLocalStorage>>;
  authentication?: Partial<ReturnType<typeof defaultAuthentication>>;
  userService?: Partial<ReturnType<typeof defaultUserService>>;
  settingsService?: Partial<ReturnType<typeof defaultSettingsService>>;
  state?: Partial<ReturnType<typeof defaultState>>;
}) {
  const asyncWrapper = (fn: (...args: any[]) => Promise<any> | any, ...args: any[]) => Promise.resolve(fn(...args));
  const analytics = { setUserRole: vi.fn() };
  const scope = {};
  const state = { ...defaultState(), ...(overrides?.state || {}) };
  const stateParams = {};
  const windowStub = { location: { reload: vi.fn() } };
  const authentication = { ...defaultAuthentication(), ...(overrides?.authentication || {}) };
  const userService = { ...defaultUserService(), ...(overrides?.userService || {}) };
  const stateManager = defaultStateManager(overrides?.stateManagerLogo ?? 'logo.svg');
  const notifications = { error: vi.fn() };
  const localStorage = { ...defaultLocalStorage(), ...(overrides?.localStorage || {}) };
  const settingsService = { ...defaultSettingsService(), ...(overrides?.settingsService || {}) };

  const controller = new AuthenticationController(
    asyncWrapper,
    analytics,
    scope,
    state,
    stateParams,
    windowStub,
    authentication,
    userService,
    stateManager,
    notifications,
    settingsService,
    localStorage
  );

  return {
    controller,
    dependencies: {
      analytics,
      state,
      authentication,
      userService,
      stateManager,
      notifications,
      localStorage,
      settingsService,
      windowStub,
    },
  };
}

function defaultAuthentication() {
  return {
    login: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
    isAdmin: vi.fn().mockReturnValue(true),
    getUserDetails: vi.fn().mockReturnValue({ forceChangePassword: false }),
    isAuthenticated: vi.fn().mockReturnValue(false),
    init: vi.fn().mockResolvedValue(true),
  };
}

function defaultUserService() {
  return {
    administratorExists: vi.fn().mockResolvedValue(true),
  };
}

function defaultSettingsService() {
  return {
    publicSettings: vi.fn().mockResolvedValue({ AuthenticationMethod: AuthenticationMethod.Internal }),
  };
}

function defaultStateManager(logo: string | null) {
  return {
    getState: () => ({ application: { logo } }),
    initialize: vi.fn().mockResolvedValue(undefined),
    clean: vi.fn(),
  };
}

function defaultState() {
  return {
    go: vi.fn(),
  };
}

function defaultLocalStorage() {
  return {
    storeLogoutReason: vi.fn(),
    getLogoutReason: vi.fn().mockReturnValue(''),
    cleanLogoutReason: vi.fn(),
    storeLoginStateUUID: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getEnvironmentsMock.mockResolvedValue({ value: [] });
});

describe('AuthenticationController', () => {
  it('authenticates via internal credentials and performs post-login navigation', async () => {
    const { controller, dependencies } = createController();
    controller.formValues.Username = 'alice';
    controller.formValues.Password = 'secret';

    await controller.authenticateUserAsync();

    expect(dependencies.authentication.login).toHaveBeenCalledWith('alice', 'secret');
    expect(dependencies.stateManager.initialize).toHaveBeenCalled();
    expect(getEnvironmentsMock).toHaveBeenCalledWith({ limit: 1, query: { excludeSnapshots: true } });
    expect(dependencies.state.go).toHaveBeenCalledWith('portainer.wizard');
  });

  it('logs out and records the logout reason', () => {
    const { controller, dependencies } = createController();

    controller.logout('session expired');

    expect(dependencies.authentication.logout).toHaveBeenCalled();
    expect(dependencies.localStorage.storeLogoutReason).toHaveBeenCalledWith('session expired');
    expect(dependencies.windowStub.location.reload).toHaveBeenCalled();
  });

  it('initializes logo state and clears stored logout errors on init', async () => {
    const storedError = 'token expired';
    const { controller, dependencies } = createController({
      stateManagerLogo: null,
      localStorage: {
        getLogoutReason: vi.fn().mockReturnValue(storedError),
      },
    });

    await controller.onInit();

    expect(dependencies.settingsService.publicSettings).toHaveBeenCalled();
    expect(dependencies.stateManager.initialize).toHaveBeenCalled();
    expect(controller.state.AuthenticationError).toBe(storedError);
    expect(dependencies.localStorage.cleanLogoutReason).toHaveBeenCalled();
    expect(dispatchCacheRefreshEventMock).toHaveBeenCalled();
    expect(controller.state.loginInProgress).toBe(false);
  });

  it('bypasses login when authentication is disabled', async () => {
    const authentication = {
      ...defaultAuthentication(),
      isAuthenticated: vi.fn().mockReturnValue(false),
    };

    const { controller, dependencies } = createController({
      authentication,
      settingsService: {
        publicSettings: vi.fn().mockResolvedValue({
          AuthenticationMethod: AuthenticationMethod.None,
        }),
      },
    });

    await controller.onInit();

    expect(dependencies.authentication.init).toHaveBeenCalled();
    expect(dependencies.state.go).toHaveBeenCalledWith('portainer.wizard');
    expect(controller.state.loginInProgress).toBe(false);
  });

  it('toggles password visibility', () => {
    const { controller } = createController();
    expect(controller.state.passwordInputType).toBe('password');

    controller.toggleShowPassword();
    expect(controller.state.passwordInputType).toBe('text');

    controller.toggleShowPassword();
    expect(controller.state.passwordInputType).toBe('password');
  });
});
