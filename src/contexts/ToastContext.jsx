import { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext()

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([])

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
        {toasts.map(toast => (
          <div 
            key={toast.id} 
            className={`px-6 py-4 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] flex items-center gap-4 backdrop-blur-xl border pointer-events-auto transition-all duration-300 ${
              toast.type === 'error' ? 'bg-red-950/90 border-red-500/50 text-red-100' : 
              toast.type === 'warning' ? 'bg-amber-950/90 border-amber-500/50 text-amber-100' :
              'bg-emerald-950/90 border-emerald-500/50 text-emerald-100'
            }`}
            style={{ animation: 'toast-slide-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards' }}
          >
            <i className={`fa-solid text-2xl ${
              toast.type === 'error' ? 'fa-circle-xmark text-red-400' :
              toast.type === 'warning' ? 'fa-triangle-exclamation text-amber-400' :
              'fa-circle-check text-emerald-400'
            }`}></i>
            <span className="font-semibold text-sm tracking-wide">{toast.message}</span>
            <button 
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="ml-2 w-8 h-8 flex items-center justify-center rounded-full bg-black/20 hover:bg-black/40 text-white/70 hover:text-white transition-colors"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes toast-slide-in {
          0% { opacity: 0; transform: translateY(30px) scale(0.9); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
