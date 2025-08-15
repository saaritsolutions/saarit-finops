import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { User } from '../types';

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
}

export const useAuth = () => {
  const auth = useSelector((state: RootState) => state.auth as AuthState);

  return {
    isAuthenticated: auth.isAuthenticated,
    user: auth.user,
    token: auth.token,
    isLoading: auth.isLoading,
    error: auth.error,
  };
};
