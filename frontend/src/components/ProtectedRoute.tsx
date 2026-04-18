import { Navigate } from 'react-router-dom';
import { ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const token = localStorage.getItem('access_token');
  const isAuth = localStorage.getItem('isAuthenticated') === 'true';
  
  if (!token || !isAuth) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};
