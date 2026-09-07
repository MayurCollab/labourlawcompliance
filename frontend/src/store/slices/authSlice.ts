import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { AuthCredentials, User } from '@/types/auth.types';
import {
  clearPersistedAuth,
  loadPersistedAuth,
  savePersistedAuth,
} from '@/utils/storage';

type AuthState = {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  permissions: string[];
  /** True until the silent refresh bootstrap on app load finishes. */
  isBootstrapping: boolean;
};

const persisted = loadPersistedAuth();

const initialState: AuthState = {
  user: persisted?.user ?? null,
  accessToken: null,
  isAuthenticated: false,
  permissions: persisted?.permissions ?? [],
  isBootstrapping: true,
};

const persistSafeAuth = (state: AuthState) => {
  if (state.user) {
    savePersistedAuth({
      user: state.user,
      permissions: state.permissions,
    });
  } else {
    clearPersistedAuth();
  }
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action: PayloadAction<AuthCredentials>) => {
      const { user, accessToken, permissions } = action.payload;
      state.user = user;
      state.accessToken = accessToken;
      state.permissions = permissions ?? user.permissions ?? [];
      state.isAuthenticated = true;
      state.isBootstrapping = false;
      persistSafeAuth(state);
    },
    setAccessToken: (state, action: PayloadAction<string>) => {
      state.accessToken = action.payload;
      state.isAuthenticated = true;
    },
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      state.permissions = action.payload.permissions ?? [];
      state.isAuthenticated = true;
      persistSafeAuth(state);
    },
    clearCredentials: (state) => {
      state.user = null;
      state.accessToken = null;
      state.isAuthenticated = false;
      state.permissions = [];
      state.isBootstrapping = false;
      clearPersistedAuth();
    },
    setBootstrapping: (state, action: PayloadAction<boolean>) => {
      state.isBootstrapping = action.payload;
    },
  },
});

export const {
  setCredentials,
  setAccessToken,
  setUser,
  clearCredentials,
  setBootstrapping,
} = authSlice.actions;

export default authSlice.reducer;
