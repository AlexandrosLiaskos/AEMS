import { jwtDecode } from 'jwt-decode';

// Types
interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
  role: string;
  status: string;
}

interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  picture?: string;
  role: string;
  iat: number;
  exp: number;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

/**
 * @class AuthService
 * @purpose Authentication service for managing user sessions
 */
class AuthService {
  private readonly TOKEN_KEY = 'aems_auth_token';
  private readonly USER_KEY = 'aems_user';
  private readonly API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  
  private listeners: Array<(state: AuthState) => void> = [];
  private currentState: AuthState = {
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
  };

  constructor() {
    this.initialize();
  }

  /**
   * @method initialize
   * @purpose Initialize auth service and restore session
   */
  private initialize(): void {
    try {
      const token = localStorage.getItem(this.TOKEN_KEY);
      const userStr = localStorage.getItem(this.USER_KEY);

      if (token && userStr) {
        const user = JSON.parse(userStr);
        
        // Check if token is expired
        if (this.isTokenValid(token)) {
          this.currentState = {
            user,
            token,
            isAuthenticated: true,
            isLoading: false,
          };
        } else {
          // Token expired, clear storage
          this.clearStorage();
          this.currentState = {
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
          };
        }
      } else {
        this.currentState = {
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        };
      }
    } catch (error) {
      console.error('Failed to initialize auth service:', error);
      this.clearStorage();
      this.currentState = {
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      };
    }

    this.notifyListeners();
  }

  /**
   * @method login
   * @purpose Authenticate user with email and password
   */
  async login(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
      this.setLoading(true);

      const response = await fetch(`${this.API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || 'Login failed',
        };
      }

      // Store token and user data
      this.setAuthData(data.token, data.user);

      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: 'Network error. Please try again.',
      };
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * @method loginWithGoogle
   * @purpose Authenticate user with Google OAuth
   */
  async loginWithGoogle(): Promise<{ success: boolean; error?: string }> {
    try {
      // Redirect to Google OAuth endpoint
      window.location.href = `${this.API_URL}/api/auth/google`;
      return { success: true };
    } catch (error) {
      console.error('Google login error:', error);
      return {
        success: false,
        error: 'Failed to initiate Google login',
      };
    }
  }

  /**
   * @method handleOAuthCallback
   * @purpose Handle OAuth callback with token
   */
  async handleOAuthCallback(token: string): Promise<{ success: boolean; error?: string }> {
    try {
      this.setLoading(true);

      // Decode token to get user info
      const decoded = jwtDecode<JwtPayload>(token);
      const user: User = {
        id: decoded.sub,
        email: decoded.email,
        name: decoded.name,
        picture: decoded.picture,
        role: decoded.role,
        status: 'active',
      };

      this.setAuthData(token, user);

      return { success: true };
    } catch (error) {
      console.error('OAuth callback error:', error);
      return {
        success: false,
        error: 'Failed to process authentication',
      };
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * @method logout
   * @purpose Log out user and clear session
   */
  async logout(): Promise<void> {
    try {
      // Call logout endpoint to invalidate server session
      await fetch(`${this.API_URL}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.currentState.token}`,
        },
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local storage and state regardless of server response
      this.clearStorage();
      this.currentState = {
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      };
      this.notifyListeners();
    }
  }

  /**
   * @method refreshToken
   * @purpose Refresh authentication token
   */
  async refreshToken(): Promise<boolean> {
    try {
      const response = await fetch(`${this.API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.currentState.token}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();
      this.setAuthData(data.token, data.user);

      return true;
    } catch (error) {
      console.error('Token refresh error:', error);
      this.logout();
      return false;
    }
  }

  /**
   * @method getToken
   * @purpose Get current authentication token
   */
  getToken(): string | null {
    return this.currentState.token;
  }

  /**
   * @method getUser
   * @purpose Get current user
   */
  getUser(): User | null {
    return this.currentState.user;
  }

  /**
   * @method getState
   * @purpose Get current authentication state
   */
  getState(): AuthState {
    return { ...this.currentState };
  }

  /**
   * @method isAuthenticated
   * @purpose Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.currentState.isAuthenticated;
  }

  /**
   * @method isLoading
   * @purpose Check if auth is loading
   */
  isLoading(): boolean {
    return this.currentState.isLoading;
  }

  /**
   * @method subscribe
   * @purpose Subscribe to auth state changes
   */
  subscribe(listener: (state: AuthState) => void): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * @method setAuthData
   * @purpose Set authentication data
   */
  private setAuthData(token: string, user: User): void {
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));

    this.currentState = {
      user,
      token,
      isAuthenticated: true,
      isLoading: false,
    };

    this.notifyListeners();
  }

  /**
   * @method clearStorage
   * @purpose Clear authentication storage
   */
  private clearStorage(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  }

  /**
   * @method setLoading
   * @purpose Set loading state
   */
  private setLoading(isLoading: boolean): void {
    this.currentState = {
      ...this.currentState,
      isLoading,
    };
    this.notifyListeners();
  }

  /**
   * @method isTokenValid
   * @purpose Check if token is valid and not expired
   */
  private isTokenValid(token: string): boolean {
    try {
      const decoded = jwtDecode<JwtPayload>(token);
      const currentTime = Date.now() / 1000;
      
      // Check if token is expired (with 5 minute buffer)
      return decoded.exp > currentTime + 300;
    } catch (error) {
      return false;
    }
  }

  /**
   * @method notifyListeners
   * @purpose Notify all listeners of state changes
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.getState());
      } catch (error) {
        console.error('Auth listener error:', error);
      }
    });
  }
}

// Export singleton instance
export const authService = new AuthService();