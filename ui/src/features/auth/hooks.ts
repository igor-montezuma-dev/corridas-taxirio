import { useMutation } from '@tanstack/react-query';
import { authApi } from '../../api/auth';

export function useValidarToken() {
  return useMutation({
    mutationFn: async (token: string) => (await authApi.me(token)).body,
  });
}
