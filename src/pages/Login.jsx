import { useState } from 'react'
import { supabase } from '../lib/supabase'
import Loader from '../components/Loader'
import { useLanguage } from '../contexts/LanguageContext'
import { useToast } from '../contexts/ToastContext'

export default function Login() {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isRegister, setIsRegister] = useState(false)
  const [error, setError] = useState(null)

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    try {
      if (isRegister) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        })
        if (error) throw error
        showToast('¡Revisa tu correo para confirmar el registro!', 'success')
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        showToast('¡Bienvenido al Multiverso!', 'success')
      }
    } catch (error) {
      showToast(error.error_description || error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f1115] bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] p-4">
      <div className="max-w-md w-full bg-[#15181e]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)]">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-amber-500 to-orange-700 flex items-center justify-center mb-4 shadow-[0_0_15px_rgba(245,158,11,0.4)]">
            <span className="text-3xl font-serif text-white">S</span>
          </div>
          <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-orange-400 font-serif">
            SEACARDS
          </h2>
          <p className="text-gray-400 mt-2 text-sm">{t('loginTitle')}</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-gray-900/80 text-white rounded-xl p-3 border border-gray-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all shadow-inner placeholder-gray-600"
              placeholder={t('emailPlaceholder')}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-gray-900/80 text-white rounded-xl p-3 border border-gray-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all shadow-inner placeholder-gray-600"
              placeholder={t('passwordPlaceholder')}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-900/30 border border-red-700/50 rounded-xl text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold py-3 px-4 rounded-xl shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all flex items-center justify-center group disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center"><i className="fa-solid fa-spinner fa-spin mr-2"></i> {t('loggingIn')}</span>
            ) : (
              <span className="flex items-center group-hover:tracking-wider transition-all"><i className="fa-solid fa-key mr-2"></i> {t('loginBtn')}</span>
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-sm">
          <p className="text-gray-400">
            {isRegister ? t('hasAccount') : t('noAccount')}{' '}
            <button
              onClick={() => setIsRegister(!isRegister)}
              className="text-amber-500 font-bold hover:text-amber-400 transition-colors underline decoration-amber-500/30 underline-offset-4"
            >
              {isRegister ? t('loginHere') : t('createAccount')}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
