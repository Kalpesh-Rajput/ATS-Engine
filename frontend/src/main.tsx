import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          className:
            '!text-sm !rounded-xl !border !border-gray-200/90 !bg-white !text-gray-900 !shadow-lg !px-4 !py-3 !font-medium',
          success: {
            duration: 3000,
            iconTheme: { primary: '#059669', secondary: '#fff' },
          },
          error: {
            duration: 5000,
            iconTheme: { primary: '#e11d48', secondary: '#fff' },
          },
        }}
      />
    </QueryClientProvider>
  </React.StrictMode>
)
