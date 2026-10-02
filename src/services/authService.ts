import { supabase } from '../lib/supabase';
import type { User, AuthResponse } from '@supabase/supabase-js';
import { apiService } from './apiService';

export interface SignUpMetadata {
  fullName: string;
  mobile?: string;
  plan?: string;
  [key: string]: any;
}

export interface StoredUser {
  name?: string;
  email?: string;
  plan?: string;
}

export const AUTH_STORAGE_KEYS = {
  NAME: 'user_name',
  EMAIL: 'user_email',
  PLAN: 'user_plan',
  PROFILE_CACHE: 'master_profile_data',
} as const;

/**
 * Sanitizes technical error messages for end-users, mirroring Flutter ResilienceUtils.
 */
export function sanitizeErrorMessage(error: unknown): string {
  let rawMsg = '';
  if (error instanceof Error) {
    rawMsg = error.message;
  } else if (typeof error === 'object' && error !== null && 'message' in error) {
    rawMsg = String((error as any).message);
  } else {
    rawMsg = String(error);
  }
  const msg = rawMsg.toLowerCase();

  if (
    msg.includes('network') ||
    msg.includes('socket') ||
    msg.includes('failed host') ||
    msg.includes('fetch')
  ) {
    return 'Connection issue detected. Please check your internet and try again.';
  }
  if (msg.includes('429') || msg.includes('rate limit')) {
    return "Servers are busy right now. We'll refresh your data in a moment.";
  }
  if (msg.includes('timeout')) {
    return 'The request took too long. Please try refreshing again.';
  }
  if (msg.includes('auth') || msg.includes('401') || msg.includes('403')) {
    return 'Session expired or unauthorized. Please log in again.';
  }

  return "Something went wrong on our end. We've logged this and are looking into it.";
}

export class AuthService {
  private _currentUser: User | null = null;

  setCurrentUser(user: User | null): void {
    this._currentUser = user;
  }

  get currentUserId(): string | null {
    if (this._currentUser?.id) {
      return this._currentUser.id;
    }
    // Synchronous fallback by reading Supabase persisted session from localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
            const raw = localStorage.getItem(key);
            if (raw) {
              const parsed = JSON.parse(raw);
              const id = parsed?.user?.id;
              if (id) return id;
            }
          }
        }
      } catch {
        // ignore parse error
      }
    }
    return null;
  }

  async saveUser(user: StoredUser): Promise<void> {
    if (typeof window === 'undefined' || !window.localStorage) return;
    localStorage.setItem(AUTH_STORAGE_KEYS.NAME, user.name ?? '');
    localStorage.setItem(AUTH_STORAGE_KEYS.EMAIL, user.email ?? '');
    const currentPlan = localStorage.getItem(AUTH_STORAGE_KEYS.PLAN);
    if (!currentPlan) {
      localStorage.setItem(AUTH_STORAGE_KEYS.PLAN, user.plan ?? 'b2c');
    }
  }

  async savePlan(plan: string): Promise<void> {
    if (typeof window === 'undefined' || !window.localStorage) return;
    localStorage.setItem(AUTH_STORAGE_KEYS.PLAN, plan);
  }

  async getUserName(): Promise<string | null> {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return localStorage.getItem(AUTH_STORAGE_KEYS.NAME);
  }

  async getUserEmail(): Promise<string | null> {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return localStorage.getItem(AUTH_STORAGE_KEYS.EMAIL);
  }

  async getUserPlan(): Promise<string | null> {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return localStorage.getItem(AUTH_STORAGE_KEYS.PLAN);
  }

  async saveMasterProfileLocally(jsonStr: string): Promise<void> {
    if (typeof window === 'undefined' || !window.localStorage) return;
    localStorage.setItem(AUTH_STORAGE_KEYS.PROFILE_CACHE, jsonStr);
  }

  async getMasterProfileLocally(): Promise<string | null> {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return localStorage.getItem(AUTH_STORAGE_KEYS.PROFILE_CACHE);
  }

  /**
   * Clears app-owned keys and cached items from localStorage.
   * Explicitly preserves 'theme_mode' and other unrelated items.
   */
  clearLocalData(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;

    // Remove static app keys
    localStorage.removeItem(AUTH_STORAGE_KEYS.NAME);
    localStorage.removeItem(AUTH_STORAGE_KEYS.EMAIL);
    localStorage.removeItem(AUTH_STORAGE_KEYS.PLAN);
    localStorage.removeItem(AUTH_STORAGE_KEYS.PROFILE_CACHE);

    // Remove dynamic cache keys and sb-*-auth-token entries
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        if (
          key.startsWith('dashboard_') ||
          key.startsWith('profile_') ||
          key.startsWith('weekly_') ||
          key.startsWith('corp_stats_') ||
          key.startsWith('mm_cache_') ||
          key.startsWith('mm_cache_ts_') ||
          (key.startsWith('sb-') && key.endsWith('-auth-token'))
        ) {
          keysToRemove.push(key);
        }
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));

    // Clear in-memory cache and in-flight API requests
    try {
      apiService.clearAllAppCache();
    } catch {
      // ignore
    }
  }

  /**
   * Logs out the user.
   * Calls signOut, falls back to local signOut on failure, and ensures all local
   * session and app cache data is cleared even if network fails.
   */
  async logout(clientOverride?: any): Promise<void> {
    const client = clientOverride || supabase;
    try {
      const res = await client.auth.signOut();
      if (res?.error) {
        await client.auth.signOut({ scope: 'local' }).catch(() => {});
      }
    } catch {
      try {
        await client.auth.signOut({ scope: 'local' });
      } catch {
        // ignore
      }
    } finally {
      this._currentUser = null;
      this.clearLocalData();
    }
  }

  async isLoggedIn(): Promise<boolean> {
    try {
      const { data } = await supabase.auth.getSession();
      return !!data?.session;
    } catch {
      return false;
    }
  }

  async signUp(email: string, password: string, metadata: SignUpMetadata): Promise<AuthResponse['data']> {
    const mapSignUpError = (message: string, status?: number): string => {
      const normalizedMessage = message.toLowerCase();
      if (normalizedMessage.includes('already registered')) {
        return 'An account already exists with this email.';
      }
      if (normalizedMessage.includes('password')) {
        return message;
      }
      if (normalizedMessage.includes('rate limit') || status === 429) {
        return 'Too many sign-up attempts. Please wait a few minutes and try again.';
      }
      if (normalizedMessage.includes('signups not allowed') || normalizedMessage.includes('signup is disabled')) {
        return 'New registrations are currently disabled.';
      }
      if (normalizedMessage.includes('sending confirmation email') || normalizedMessage.includes('not authorized')) {
        return "We couldn't send the verification email. Please try again later.";
      }
      if (normalizedMessage.includes('database error')) {
        return "We couldn't create your account right now. Please try again later.";
      }
      if (normalizedMessage.includes('network') || normalizedMessage.includes('fetch')) {
        return 'Connection issue detected. Please check your internet and try again.';
      }
      if (import.meta.env.DEV) {
        return `${message} (status ${status})`;
      }
      return sanitizeErrorMessage(message);
    };

    let res: AuthResponse;
    try {
      res = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined,
          data: {
            plan: 'b2c',
            ...metadata,
          },
        },
      });
    } catch (err: any) {
      console.error('[signUp] raw error:', {
        message: err?.message ?? String(err),
        status: err?.status,
        code: err?.code,
      });
      const msg = String(err?.message || err);
      throw new Error(mapSignUpError(msg, err?.status));
    }

    const { data, error } = res;
    if (error) {
      console.error('[signUp] raw error:', {
        message: error.message,
        status: error.status,
        code: (error as any).code,
      });
      throw new Error(mapSignUpError(error.message, error.status));
    }

    if (data.user) {
      if (data.user.identities?.length === 0) {
        throw new Error('An account already exists with this email.');
      }
      this._currentUser = data.user;
    }

    return data;
  }

  async signIn(email: string, password: string): Promise<AuthResponse['data']> {
    const mapSignInError = (message: string, status?: number, code?: string): string => {
      const normalizedMessage = message.toLowerCase();
      if (normalizedMessage.includes('invalid login credentials')) {
        return 'Incorrect email or password. Please try again.';
      }
      if (normalizedMessage.includes('email not confirmed') || code?.toLowerCase() === 'email_not_confirmed') {
        return 'Please verify your email first. Check your inbox (and spam folder) for the confirmation link.';
      }
      if (normalizedMessage.includes('rate limit') || status === 429) {
        return 'Too many attempts. Please wait a few minutes and try again.';
      }
      if (normalizedMessage.includes('network') || normalizedMessage.includes('fetch')) {
        return 'Connection issue detected. Please check your internet and try again.';
      }
      if (import.meta.env.DEV) {
        return `${message} (status ${status})`;
      }
      return sanitizeErrorMessage(message);
    };

    let res: AuthResponse;
    try {
      res = await supabase.auth.signInWithPassword({
        email,
        password,
      });
    } catch (err: any) {
      console.error('[signIn] raw error:', {
        message: err?.message ?? String(err),
        status: err?.status,
        code: err?.code,
      });
      const msg = String(err?.message || err);
      throw new Error(mapSignInError(msg, err?.status, err?.code));
    }

    const { data, error } = res;
    if (error) {
      console.error('[signIn] raw error:', {
        message: error.message,
        status: error.status,
        code: (error as any).code,
      });
      throw new Error(mapSignInError(error.message, error.status, (error as any).code));
    }

    if (data.user) {
      this._currentUser = data.user;
      const metadata = data.user.user_metadata || {};
      await this.saveUser({
        name: metadata.fullName ?? '',
        email: data.user.email ?? '',
        plan: metadata.plan ?? 'b2c',
      });
    }

    return data;
  }

  async resetPassword(email: string): Promise<{}> {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const redirectTo = `${origin}/reset-password`;
    let res: any;

    try {
      res = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
    } catch (err: any) {
      throw new Error(sanitizeErrorMessage(err));
    }

    const { data, error } = res;
    if (error) {
      throw new Error(sanitizeErrorMessage(error));
    }

    return data;
  }

  async updatePassword(newPassword: string): Promise<{ user: User | null }> {
    let res: any;
    try {
      res = await supabase.auth.updateUser({
        password: newPassword,
      });
    } catch (err: any) {
      throw new Error(sanitizeErrorMessage(err));
    }

    const { data, error } = res;
    if (error) {
      throw new Error(sanitizeErrorMessage(error));
    }

    if (data.user) {
      this._currentUser = data.user;
    }

    return data;
  }

  async syncMetadata(): Promise<void> {
    try {
      const { data } = await supabase.auth.getUser();
      const user = data?.user ?? this._currentUser;
      if (user) {
        const existingPlan = typeof window !== 'undefined' ? localStorage.getItem(AUTH_STORAGE_KEYS.PLAN) : null;
        const metadata = user.user_metadata || {};
        await this.saveUser({
          name: metadata.fullName ?? '',
          email: user.email ?? '',
          plan: existingPlan || metadata.plan || 'b2c',
        });
      }
    } catch {
      // ignore sync failure
    }
  }
}

export const authService = new AuthService();
