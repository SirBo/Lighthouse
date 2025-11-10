import angular from 'angular';
import { getEnvironments } from '@/react/portainer/environments/environment.service';
import { dispatchCacheRefreshEvent } from '@/portainer/services/http-request.helper';
import { AuthenticationMethod } from '@/react/portainer/settings/types';

class AuthenticationController {
  /* @ngInject */
  constructor(
    $async,
    $analytics,
    $scope,
    $state,
    $stateParams,
    $window,
    Authentication,
    UserService,
    StateManager,
    Notifications,
    SettingsService,
    LocalStorage
  ) {
    this.$async = $async;
    this.$analytics = $analytics;
    this.$scope = $scope;
    this.$state = $state;
    this.$stateParams = $stateParams;
    this.$window = $window;
    this.Authentication = Authentication;
    this.UserService = UserService;
    this.StateManager = StateManager;
    this.Notifications = Notifications;
    this.SettingsService = SettingsService;
    this.LocalStorage = LocalStorage;

    this.logo = this.StateManager.getState().application.logo;
    this.formValues = {
      Username: '',
      Password: '',
    };
    this.state = {
      passwordInputType: 'password',
      AuthenticationError: '',
      loginInProgress: true,
      authDisabled: false,
    };

    this.checkForEndpointsAsync = this.checkForEndpointsAsync.bind(this);
    this.postLoginSteps = this.postLoginSteps.bind(this);

    this.internalLoginAsync = this.internalLoginAsync.bind(this);

    this.authenticateUserAsync = this.authenticateUserAsync.bind(this);

    this.authEnabledFlowAsync = this.authEnabledFlowAsync.bind(this);
    this.onInit = this.onInit.bind(this);
  }

  /**
   * UTILS FUNCTIONS SECTION
   */

  toggleShowPassword() {
    this.state.passwordInputType = this.state.passwordInputType === 'text' ? 'password' : 'text';
  }

  // set the password input type to password, so that browser autofills don't treat the input as text
  setPasswordInputType(inputType) {
    this.state.passwordInputType = inputType;
    document.getElementById('password').setAttribute('type', inputType);
  }

  logout(error) {
    this.Authentication.logout();
    this.state.loginInProgress = false;
    this.LocalStorage.storeLogoutReason(error);
    this.$window.location.reload();
  }

  error(err, message) {
    this.state.AuthenticationError = message;
    if (!err) {
      err = {};
    }
    this.Notifications.error('Failure', err, message);
    this.state.loginInProgress = false;
  }

  /**
   * END UTILS FUNCTIONS SECTION
   */

  /**
   * POST LOGIN STEPS SECTION
   */

  async checkForEndpointsAsync() {
    try {
      const isAdmin = this.Authentication.isAdmin();
      const endpoints = await getEnvironments({ limit: 1, query: { excludeSnapshots: true } });

      if (this.Authentication.getUserDetails().forceChangePassword) {
        return this.$state.go('portainer.account');
      }

      if (endpoints.value.length === 0 && isAdmin) {
        return this.$state.go('portainer.wizard');
      } else {
        return this.$state.go('portainer.home');
      }
    } catch (err) {
      this.error(err, 'Unable to retrieve environments');
    }
  }

  async postLoginSteps() {
    await this.StateManager.initialize();

    const isAdmin = this.Authentication.isAdmin();
    this.$analytics.setUserRole(isAdmin ? 'admin' : 'standard-user');

    await this.checkForEndpointsAsync();
  }
  /**
   * END POST LOGIN STEPS SECTION
   */

  /**
   * LOGIN METHODS SECTION
   */

  async internalLoginAsync(username, password) {
    await this.Authentication.login(username, password);
    await this.postLoginSteps();
  }

  /**
   * END LOGIN METHODS SECTION
   */

  /**
   * AUTHENTICATE USER SECTION
   */

  async authenticateUserAsync() {
    try {
      var username = this.formValues.Username;
      var password = this.formValues.Password;
      this.state.loginInProgress = true;
      await this.internalLoginAsync(username, password);
    } catch (err) {
      this.error(err, 'Unable to login');
    }
  }

  authenticateUser() {
    this.setPasswordInputType('password');
    return this.$async(this.authenticateUserAsync);
  }

  /**
   * END AUTHENTICATE USER SECTION
   */

  /**
   * ON INIT SECTION
   */
  async authEnabledFlowAsync() {
    try {
      const exists = await this.UserService.administratorExists();
      if (!exists) {
        this.$state.go('portainer.init.admin');
      }
    } catch (err) {
      this.error(err, 'Unable to verify administrator account existence');
    }
  }

  async onInit() {
    try {
      const settings = await this.SettingsService.publicSettings();
      this.state.authDisabled = settings.AuthenticationMethod === AuthenticationMethod.None;

      if (!this.logo) {
        await this.StateManager.initialize();
        this.logo = this.StateManager.getState().application.logo;
      }

      if (this.$stateParams.logout || this.$stateParams.error) {
        this.logout(this.$stateParams.error);
        return;
      }
      const error = this.LocalStorage.getLogoutReason();
      if (error) {
        this.state.AuthenticationError = error;
        this.LocalStorage.cleanLogoutReason();
      }

      // always clear the kubernetes cache on login
      dispatchCacheRefreshEvent();

      if (this.state.authDisabled) {
        await this.Authentication.init();
        await this.postLoginSteps();
        this.state.loginInProgress = false;
        await this.authEnabledFlowAsync();
        return;
      }

      if (this.Authentication.isAuthenticated()) {
        await this.postLoginSteps();
      }
      this.state.loginInProgress = false;

      await this.authEnabledFlowAsync();
    } catch (err) {
      this.Notifications.error('Failure', err, 'Unable to initialize authentication view');
    }
  }

  $onInit() {
    return this.$async(this.onInit);
  }

  /**
   * END ON INIT SECTION
   */
}

export default AuthenticationController;
angular.module('portainer.app').controller('AuthenticationController', AuthenticationController);
