import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import SidebarFilters from '../components/SidebarFilters'
import Loader from '../components/Loader'
import Header from '../components/Header'
import CardDetail from '../components/CardDetail'
import { useLanguage } from '../contexts/LanguageContext'
import { useToast } from '../contexts/ToastContext'

export default function Home() {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [card, setCard] = useState(null)
  const [buffer, setBuffer] = useState([])
  const isRefillingRef = useRef(false)
  const navigate = useNavigate()
  
  const [queryStr, setQueryStr] = useState('')

  const handleFilterChange = (f) => {
    let parts = []
    if (f.query.trim()) {
      const textStr = f.query.trim()
      if (textStr.includes(':') || textStr.includes('=')) {
        parts.push(textStr)
      } else {
        let textQueries = []
        if (f.scopes.name) textQueries.push(`"${textStr}"`)
        if (f.scopes.type) textQueries.push(`t:"${textStr}"`)
        if (f.scopes.text) textQueries.push(`o:"${textStr}"`)
        if (textQueries.length > 0) parts.push(`(${textQueries.join(' OR ')})`)
      }
    }
    if (f.colors && typeof f.colors === 'object' && !Array.isArray(f.colors)) {
      const greenColors = Object.entries(f.colors).filter(([_, state]) => state === 'green').map(([c]) => c)
      const redColors = Object.entries(f.colors).filter(([_, state]) => state === 'red').map(([c]) => c)
      const yellowColors = Object.entries(f.colors).filter(([_, state]) => state === 'yellow').map(([c]) => c)

      greenColors.forEach(c => parts.push(c === 'c' ? 'id:c' : `id>=${c}`))
      redColors.forEach(c => parts.push(c === 'c' ? '-id:c' : `-id>=${c}`))
      if (yellowColors.length > 0) {
        const yellowQueries = yellowColors.map(c => c === 'c' ? 'id:c' : `id>=${c}`)
        parts.push(`(${yellowQueries.join(' OR ')})`)
      }
    } else if (f.colors && Array.isArray(f.colors) && f.colors.length > 0) {
      parts.push(`id<=${f.colors.join('')}`)
    }
    if (f.types.length > 0) parts.push(`(${f.types.map(t => `t:${t}`).join(' OR ')})`)
    if (f.rarities.length > 0) parts.push(`(${f.rarities.map(r => `r:${r}`).join(' OR ')})`)
    if (f.formatFilters && Object.keys(f.formatFilters).length > 0) {
      const formatQueries = Object.entries(f.formatFilters).map(([fmt, state]) => {
        if (state === 'legal') return `f:${fmt}`
        if (state === 'not_legal') return `banned:${fmt}`
        return ''
      }).filter(Boolean)
      if (formatQueries.length > 0) {
        parts.push(`(${formatQueries.join(' OR ')})`)
      }
    }
    if (f.set) parts.push(`e:${f.set}`)
    if (f.cmcMin !== '') parts.push(`cmc>=${f.cmcMin}`)
    if (f.cmcMax !== '') parts.push(`cmc<=${f.cmcMax}`)
    if (f.isCommander) parts.push('is:commander')
    if (f.imgLang && f.imgLang !== 'en') parts.push(`lang:${f.imgLang}`)
    setQueryStr(parts.join(' '))
  }

  useEffect(() => {
    setBuffer([])
  }, [queryStr])

  useEffect(() => {
    let mounted = true
    let timeout

    const refillBuffer = async () => {
      if (isRefillingRef.current) return
      isRefillingRef.current = true
      
      try {
        const url = queryStr ? `https://api.scryfall.com/cards/random?q=${encodeURIComponent(queryStr)}` : 'https://api.scryfall.com/cards/random'
        const res = await fetch(url)
        if (res.status === 429) {
          await new Promise(r => setTimeout(r, 2000))
          isRefillingRef.current = false
          return
        }
        if (res.ok) {
          const newCard = await res.json()
          if (mounted) {
            setBuffer(prev => {
              if (prev.length >= 5) return prev
              if (prev.find(c => c.id === newCard.id)) return prev
              return [...prev, newCard]
            })
          }
        }
      } catch (e) {
        console.error("Error refilling buffer", e)
      } finally {
        isRefillingRef.current = false
      }
    }
    
    if (buffer.length < 5 && !isRefillingRef.current) {
      timeout = setTimeout(refillBuffer, 1000) // 1s between refills to respect rate limits
    }
    
    return () => {
      mounted = false
      clearTimeout(timeout)
    }
  }, [buffer.length, queryStr])

  const fetchRandomCard = async () => {
    if (buffer.length > 0) {
      const nextCard = buffer[0]
      setBuffer(prev => prev.slice(1))
      setCard(nextCard)
      return
    }

    setLoading(true)
    try {
      const url = queryStr ? `https://api.scryfall.com/cards/random?q=${encodeURIComponent(queryStr)}` : 'https://api.scryfall.com/cards/random'
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setCard(data)
      } else {
        showToast(t('errorEmpty') || "El multiverso está vacío. No se encontraron cartas con esta combinación de filtros.", 'warning')
      }
    } catch (error) {
      console.error(error)
      showToast("Error inesperado al buscar en el multiverso.", 'error')
      setCard(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault()
        if (!loading) {
          fetchRandomCard()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [buffer, queryStr, loading])

  return (
    <div className="min-h-screen flex flex-col bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] bg-[#0f1115]">
      <Header />

      <div className="w-full px-4 lg:px-8 xl:px-12 2xl:px-16 mx-auto flex flex-col lg:flex-row gap-8 flex-grow items-start mt-4 max-w-[2000px]">
        <SidebarFilters 
          onActionClick={fetchRandomCard}
          actionIcon="fa-bolt"
          actionText={t('invoke')}
          actionLoading={loading}
          onFilterChange={handleFilterChange}
          showAction={true}
          hideActionOnMobile={true}
          bufferCount={buffer.length}
        />
        
        <main className="w-full flex-grow flex flex-col gap-6 min-w-0">
          {loading ? (
            <Loader message={t('scrying')} />
          ) : !card ? (
            <>
              <div className="glass-panel rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[400px] lg:min-h-[500px]">
                <i className="fa-brands fa-wizards-of-the-coast text-7xl text-amber-500/80 mb-8 drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]"></i>
                <h2 className="text-4xl mtg-font text-white mb-4 font-bold">{t('welcomeTitle')}</h2>
                <p className="text-gray-400 text-lg max-w-md">{t('welcomeDesc')}</p>
              </div>
              {/* Mobile invoke button below welcome panel */}
              <button 
                onClick={fetchRandomCard}
                disabled={loading}
                className="lg:hidden w-full bg-gradient-to-b from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.4)] border border-orange-400/50 text-xl disabled:opacity-50"
              >
                <i className={`fa-solid ${loading ? 'fa-spinner fa-spin' : 'fa-bolt'} mr-3`}></i>
                <span className="tracking-wide">{loading ? t('processing') : t('invoke')}</span>
              </button>
            </>
          ) : (
            <CardDetail 
              baseCard={card} 
              mobileActionNode={
                <button 
                  onClick={fetchRandomCard}
                  disabled={loading}
                  className="w-full bg-gradient-to-b from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.3)] border border-orange-400/50 text-lg disabled:opacity-50"
                >
                  <i className={`fa-solid ${loading ? 'fa-spinner fa-spin' : 'fa-bolt'} mr-3`}></i>
                  <span className="tracking-wide">{loading ? t('processing') : t('invoke')}</span>
                </button>
              }
            />
          )}
        </main>
      </div>
    </div>
  )
}
