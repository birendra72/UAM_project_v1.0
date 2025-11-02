import { useAuth } from "./useAuth";

export function useUser() {
  const { user, isLoading, error } = useAuth();
  return { data: user, isLoading, error };
}

export function useIsAdmin() {
  const { role } = useAuth();
  return role === "admin";
}
