import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/http';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (tentativas, error) =>
        !(error instanceof ApiError && error.status < 500) && tentativas < 2,
    },
    mutations: {
      retry: false,
    },
  },
});
