// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';
import appConfig from './config.json';

const userPool = new CognitoUserPool({ // gitleaks:allow — reads from config.json placeholders
  UserPoolId: appConfig.userPool,
  ClientId: appConfig.clientId,
});

let currentSession: CognitoUserSession | null = null;

export const auth = {
  // Sign in with username and password
  signIn: (username: string, password: string): Promise<CognitoUserSession> => {
    return new Promise((resolve, reject) => {
      const user = new CognitoUser({
        Username: username,
        Pool: userPool,
      });

      const authDetails = new AuthenticationDetails({
        Username: username,
        Password: password,
      });

      user.authenticateUser(authDetails, {
        onSuccess: (session) => {
          currentSession = session;
          resolve(session);
        },
        onFailure: (err) => {
          reject(err);
        },
        newPasswordRequired: (userAttributes) => {
          // Auto-complete new password challenge with the same password
          delete userAttributes.email_verified;
          delete userAttributes.phone_number_verified;
          user.completeNewPasswordChallenge(password, userAttributes, {
            onSuccess: (session) => {
              currentSession = session;
              resolve(session);
            },
            onFailure: (err) => {
              reject(err);
            },
          });
        },
      });
    });
  },

  // Sign out
  signOut: (): void => {
    const user = userPool.getCurrentUser();
    if (user) {
      user.signOut();
    }
    currentSession = null;
  },

  // Get current session (refreshes if needed)
  getSession: (): Promise<CognitoUserSession | null> => {
    return new Promise((resolve) => {
      const user = userPool.getCurrentUser();
      if (!user) {
        resolve(null);
        return;
      }

      user.getSession((err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session?.isValid()) {
          resolve(null);
          return;
        }
        currentSession = session;
        resolve(session);
      });
    });
  },

  // Get ID token for API calls
  getIdToken: async (): Promise<string | null> => {
    const session = await auth.getSession();
    return session?.getIdToken().getJwtToken() || null;
  },

  // Check if user is authenticated
  isAuthenticated: async (): Promise<boolean> => {
    const session = await auth.getSession();
    return session?.isValid() || false;
  },

  // Get current username
  getUsername: (): string | null => {
    const user = userPool.getCurrentUser();
    return user?.getUsername() || null;
  },
};
