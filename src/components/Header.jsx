import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../contexts/LanguageContext'

export default function Header() {
  const navigate = useNavigate()
  const location = useLocation()
  const { lang, setLang, t } = useLanguage()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <header className="bg-[#111318]/95 backdrop-blur-md border-b border-gray-800/80 sticky top-0 z-50 shadow-2xl relative">
      <div className="w-full px-4 lg:px-8 xl:px-12 2xl:px-16 mx-auto py-3 md:py-4 flex flex-row justify-between items-center gap-4 max-w-[2000px]">
        <div 
          className="flex items-center gap-4 cursor-pointer group"
          onClick={() => navigate('/')}
        >
          <div className="w-8 h-8 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-amber-500 to-orange-700 flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.4)] group-hover:shadow-[0_0_20px_rgba(245,158,11,0.6)] transition-all duration-300 shrink-0">
            <i className="fa-solid fa-hat-wizard text-sm md:text-2xl text-white"></i>
          </div>
          <h1 className="text-xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-orange-400 tracking-wider mtg-font group-hover:brightness-110 transition-all duration-300 whitespace-nowrap">
            SEACARDS
          </h1>
        </div>
        {/* Desktop Nav */}
        <div className="hidden md:flex gap-2 sm:gap-3 items-center">
          <div className="relative group mr-2">
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className="bg-gray-900 border border-gray-700 text-gray-300 text-xs rounded-lg px-2 py-1.5 focus:ring-amber-500 focus:border-amber-500 outline-none appearance-none pr-6 cursor-pointer"
            >
              <option value="es">🇪🇸 ES</option>
              <option value="en">🇬🇧 EN</option>
            </select>
            <i className="fa-solid fa-chevron-down absolute right-2 top-2 text-[10px] text-gray-500 pointer-events-none"></i>
          </div>

          <button
            onClick={() => navigate('/')}
            className={`text-sm font-bold px-3 sm:px-4 py-2 rounded-lg transition-all border flex items-center ${location.pathname === '/' ? 'text-amber-400 bg-amber-500/20 border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.2)]' : 'text-gray-400 hover:text-amber-400 bg-gray-900/80 border-gray-700 hover:border-amber-500/30'}`}
          >
            <i className="fa-solid fa-bolt mr-1 sm:mr-2"></i> <span className="hidden sm:inline">{t('invokeBtn')}</span>
          </button>
          
          <button
            onClick={() => navigate('/search')}
            className={`text-sm font-bold px-3 sm:px-4 py-2 rounded-lg transition-all border flex items-center ${location.pathname === '/search' ? 'text-amber-400 bg-amber-500/20 border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.2)]' : 'text-gray-400 hover:text-amber-400 bg-gray-900/80 border-gray-700 hover:border-amber-500/30'}`}
          >
            <i className="fa-solid fa-magnifying-glass mr-1 sm:mr-2"></i> <span className="hidden sm:inline">{t('searchNav')}</span>
          </button>
          
          <button
            onClick={() => navigate('/saved')}
            className={`text-sm font-bold px-3 sm:px-4 py-2 rounded-lg transition-all border flex items-center ${location.pathname === '/saved' ? 'text-amber-400 bg-amber-500/20 border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.2)]' : 'text-gray-400 hover:text-amber-400 bg-gray-900/80 border-gray-700 hover:border-amber-500/30'}`}
          >
            <i className="fa-solid fa-book-journal-whills mr-1 sm:mr-2"></i> <span className="hidden sm:inline">{t('savedNav')}</span>
          </button>

          <button
            onClick={() => navigate('/decks')}
            className={`text-sm font-bold px-3 sm:px-4 py-2 rounded-lg transition-all border flex items-center ${location.pathname === '/decks' ? 'text-amber-400 bg-amber-500/20 border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.2)]' : 'text-gray-400 hover:text-amber-400 bg-gray-900/80 border-gray-700 hover:border-amber-500/30'}`}
          >
            <i className="fa-solid fa-layer-group mr-1 sm:mr-2"></i> <span className="hidden sm:inline">{t('decksNav')}</span>
          </button>
          
          <div className="w-px h-6 bg-gray-700 mx-1"></div>
          
          <button
            onClick={handleSignOut}
            className="text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-red-900/80 px-3 sm:px-4 py-2 rounded-lg transition-colors border border-gray-700 hover:border-red-500/50"
            title={t('logoutTitle')}
          >
            <i className="fa-solid fa-power-off"></i>
          </button>
        </div>

        {/* Mobile Nav Toggle */}
        <div className="md:hidden flex items-center gap-3">
          <div className="relative group mr-1">
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className="bg-gray-900 border border-gray-700 text-gray-300 text-xs rounded-lg px-2 py-1.5 focus:ring-amber-500 focus:border-amber-500 outline-none appearance-none pr-6 cursor-pointer"
            >
              <option value="es">🇪🇸 ES</option>
              <option value="en">🇬🇧 EN</option>
            </select>
            <i className="fa-solid fa-chevron-down absolute right-2 top-2 text-[10px] text-gray-500 pointer-events-none"></i>
          </div>
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-gray-400 hover:text-white bg-gray-800 p-2 rounded-lg transition-colors border border-gray-700"
          >
            <i className={`fa-solid ${mobileMenuOpen ? 'fa-xmark' : 'fa-bars'} text-xl w-5 h-5 flex items-center justify-center`}></i>
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-full right-4 mt-2 w-56 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-2 flex flex-col gap-1 z-50 animate-fade-in-down origin-top-right">
          <button
            onClick={() => { navigate('/'); setMobileMenuOpen(false) }}
            className={`text-left text-sm font-bold px-4 py-3 rounded-lg transition-all ${location.pathname === '/' ? 'text-amber-400 bg-amber-500/10' : 'text-gray-400 hover:bg-gray-800'}`}
          >
            <i className="fa-solid fa-bolt mr-3 w-4 text-center"></i> {t('invokeBtn')}
          </button>
          <button
            onClick={() => { navigate('/search'); setMobileMenuOpen(false) }}
            className={`text-left text-sm font-bold px-4 py-3 rounded-lg transition-all ${location.pathname === '/search' ? 'text-amber-400 bg-amber-500/10' : 'text-gray-400 hover:bg-gray-800'}`}
          >
            <i className="fa-solid fa-magnifying-glass mr-3 w-4 text-center"></i> {t('searchNav')}
          </button>
          <button
            onClick={() => { navigate('/saved'); setMobileMenuOpen(false) }}
            className={`text-left text-sm font-bold px-4 py-3 rounded-lg transition-all ${location.pathname === '/saved' ? 'text-amber-400 bg-amber-500/10' : 'text-gray-400 hover:bg-gray-800'}`}
          >
            <i className="fa-solid fa-book-journal-whills mr-3 w-4 text-center"></i> {t('savedNav')}
          </button>
          <button
            onClick={() => { navigate('/decks'); setMobileMenuOpen(false) }}
            className={`text-left text-sm font-bold px-4 py-3 rounded-lg transition-all ${location.pathname === '/decks' ? 'text-amber-400 bg-amber-500/10' : 'text-gray-400 hover:bg-gray-800'}`}
          >
            <i className="fa-solid fa-layer-group mr-3 w-4 text-center"></i> {t('decksNav')}
          </button>
          
          <div className="w-full h-px bg-gray-800 my-1"></div>
          
          <button
            onClick={() => { handleSignOut(); setMobileMenuOpen(false) }}
            className="text-left text-sm text-gray-400 hover:text-white hover:bg-red-900/80 px-4 py-3 rounded-lg transition-colors"
          >
            <i className="fa-solid fa-power-off mr-3 w-4 text-center"></i> {t('logoutTitle')}
          </button>
        </div>
      )}
    </header>
  )
}
