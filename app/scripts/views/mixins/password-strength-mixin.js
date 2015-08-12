/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

define([
  'lib/promise',
  'lib/runtime-require',
  'lib/url'
], function (p, runtimeRequire, Url) {
  'use strict';

  var PasswordStrengthMixin = {
    initialize: function (options) {
      this._able = options.able;
    },

    _isPasswordStrengthCheckEnabledValue: undefined,
    _isPasswordStrengthCheckEnabled: function () {
      var self = this;
      if (typeof this._isPasswordStrengthCheckEnabledValue === 'undefined') {
        var abData = {
          isMetricsEnabledValue: this.metrics.isCollectionEnabled(),
          uniqueUserId: this.user.get('uniqueUserId'),
          // the window parameter will override any ab testing features
          forcePasswordStrengthCheck: Url.searchParam('passwordStrengthCheck', this.window.location.search)
        };

        this._isPasswordStrengthCheckEnabledValue =
              this._able.choose('passwordStrengthCheckEnabled', abData);
        var eventName = 'experiment.pw_strength.password_strength_check_enabled';
        self.logScreenEvent(eventName);
      }
      return this._isPasswordStrengthCheckEnabledValue;
    },

    _passwordStrengthCheckerPromise: undefined,
    _getPasswordStrengthChecker: function () {
      // returns a promise that resolves once the library is loaded.
      var self = this;
      if (! self._passwordStrengthCheckerPromise) {
        self._passwordStrengthCheckerPromise = runtimeRequire('passwordcheck')
          .then(function (PasswordCheck) {
            return new PasswordCheck();
          });
      }
      return self._passwordStrengthCheckerPromise;
    },

    /**
     * Check the password strength. Returns a promise that resolves
     * when the check is complete. Promise resolves to `DISABLED` if
     * password strength checker is disabled.
     *
     * Usage:
     *
     *   view.checkPasswordStrength(password)
     *     .then(function (status) {
     *      // do something with the status
     *     });
     *
     * @method checkPasswordStrength
     * @returns {Promise}
     */
    checkPasswordStrength: function (password) {
      var self = this;
      if (! this._isPasswordStrengthCheckEnabled()) {
        return p('DISABLED');
      }

      return this._getPasswordStrengthChecker()
        .then(function (passwordStrengthChecker) {
          var deferred = p.defer();
          passwordStrengthChecker(password, function (passwordCheckStatus) {
            // in the future, do some fancy tooltip here.
            passwordCheckStatus = passwordCheckStatus || 'UNKNOWN';

            if (passwordCheckStatus.toLowerCase() === 'bloomfilter_hit'
                      || passwordCheckStatus.toLowerCase() === 'bloomfilter_miss') {
              self.logScreenEvent('experiment.pw_strength.bloomfilter_used');
            }
            var eventName = 'experiment.pw_strength.' +
                                passwordCheckStatus.toLowerCase();
            self.logScreenEvent(eventName);
            deferred.resolve(passwordCheckStatus);
          });
          return deferred.promise;
        });
    }
  };
  return PasswordStrengthMixin;
});
