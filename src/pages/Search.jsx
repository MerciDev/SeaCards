import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import SidebarFilters from '../components/SidebarFilters'
import Loader from '../components/Loader'
import Header from '../components/Header'
import { useLanguage } from '../contexts/LanguageContext'
import { useToast } from '../contexts/ToastContext'
import { useNavigate } from 'react-router-dom'

export default function Search() {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  
  const currentFilterRef = useRef(null)

  const buildQuery = (f) => {
    let parts = []
    if (f.query.trim()) {
      const textStr = f.query.trim()
      if (textStr.includes(':') || textStr.includes('=')) {
        parts.push(textStr)
      } else {
        let textQueries = []
        if (f.scopes.name) textQueries.push(`name:${textStr}`)
        if (f.scopes.type) textQueries.push(`t:${textStr}`)
        if (f.scopes.text) textQueries.push(`o:${textStr}`)
        if (textQueries.length > 0) parts.push(`(${textQueries.join(' OR ')})`)
      }
    }
    if (f.colors.length > 0) parts.push(`id<=${f.colors.join('')}`)
    if (f.types.length > 0) parts.push(`(${f.types.map(t => `t:${t}`).join(' OR ')})`)
    if (f.rarities.length > 0) parts.push(`(${f.rarities.map(r => `r:${r}`).join(' OR ')})`)
    if (f.formatFilters && Object.keys(f.formatFilters).length > 0) {
      const fq = Object.entries(f.formatFilters).map(([fmt, state]) => {
        if (state === 'legal') return `f:${fmt}`
        if (state === 'not_legal') return `banned:${fmt}`
        return ''
      }).filter(Boolean)
      if (fq.length > 0) parts.push(`(${fq.join(' OR ')})`)
    }
    if (f.set) parts.push(`e:${f.set}`)
    if (f.cmcMin !== '') parts.push(`cmc>=${f.cmcMin}`)
    if (f.cmcMax !== '') parts.push(`cmc<=${f.cmcMax}`)
    if (f.isCommander) parts.push('(t:legendary (t:creature OR t:planeswalker))')
    if (f.imgLang && f.imgLang !== 'en') parts.push(`lang:${f.imgLang}`)
    return parts.join(' ')
  }

  const handleFilterChange = (f) => {
    currentFilterRef.current = f
  }

  const handleSearch = async () => {
    const f = currentFilterRef.current
    let queryStr = f ? buildQuery(f) : ''
    
    if (f && f.tags && f.tags.length > 0) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        showToast("Debes iniciar sesión para filtrar por etiquetas", "error")
        return
      }
      
      const { data, error } = await supabase.from('liked_cards').select('scryfall_id, tags').eq('user_id', user.id)
      
      if (error || !data) {
        showToast("Error al buscar por etiquetas", "error")
        return
      }
      
      const matchingIds = data.filter(row => {
        if (!row.tags || row.tags.length === 0) return false
        return f.tags.some(t => row.tags.includes(t))
      }).map(r => r.scryfall_id)
      
      if (matchingIds.length === 0) {
        setResults([])
        setLoading(false)
        setHasSearched(true)
        return
      }
      
      const idQuery = `(${matchingIds.map(id => `id:${id}`).join(' OR ')})`
      queryStr = queryStr ? `${queryStr} ${idQuery}` : idQuery
    }

    if (!queryStr) {
      showToast(t('errorEmptyFilters') || "Por favor, introduce algún filtro para buscar.", 'warning')
      return
    }
    
    setLoading(true)
    setHasSearched(true)
    
    try {
      const url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(queryStr)}`
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        let fetchedCards = data.data || []
        
        setResults(fetchedCards)
      } else {
        setResults([])
      }
    } catch (e) {
      console.error(e)
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const handleSaveCard = async (card) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("No user")
      
      const { error } = await supabase.from('liked_cards').insert({
        user_id: user.id,
        scryfall_id: card.id,
        name: card.name,
        image_url: card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal,
        set_code: card.set,
        rarity: card.rarity
      })
      if (error) throw error
      showToast(t('savedAlert') || "¡Carta guardada!", 'success')
    } catch (e) {
      console.error(e)
      showToast("Error al guardar", 'error')
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] bg-[#0f1115]">
      <Header />

      <div className="w-full px-4 lg:px-8 xl:px-12 2xl:px-16 mx-auto flex flex-col lg:flex-row gap-8 flex-grow items-start mt-4 max-w-[2000px]">
        
        <SidebarFilters 
          onActionClick={handleSearch}
          actionIcon="fa-magnifying-glass"
          actionText={t('searchCards')}
          actionLoading={loading}
          onFilterChange={handleFilterChange}
          showAction={true}
        />

        <main className="w-full flex-grow">
          {loading ? (
            <Loader message={t('scrying')} />
          ) : !hasSearched ? (
            <div className="glass-panel rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[500px]">
               <i className="fa-solid fa-book-journal-whills text-7xl text-amber-500/80 mb-8 drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]"></i>
               <h2 className="text-4xl mtg-font text-white mb-4 font-bold">{t('searchTitle')}</h2>
               <p className="text-gray-400 text-lg max-w-md">{t('searchDesc')}</p>
            </div>
          ) : results.length === 0 ? (
            <div className="glass-panel rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
               <i className="fa-solid fa-triangle-exclamation text-6xl text-red-500/80 mb-6 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]"></i>
               <h2 className="text-2xl text-white font-bold mb-2">{t('errorEmpty')}</h2>
            </div>
          ) : (
            <div>
              <div className="mb-6 flex justify-between items-center bg-gray-900/60 p-4 rounded-xl border border-gray-800">
                <span className="text-gray-300">
                  {t('foundCards')} <strong className="text-amber-500">{results.length}</strong> {t('cardsMax')}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6 lg:gap-8">
                {results.map(card => {
                  const imgUrl = card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal
                  
                  return (
                    <div 
                      key={card.id} 
                      onClick={() => {
                        const slug = card.name ? card.name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-') : card.id;
                        navigate(`/card/${slug}`)
                      }}
                      className="cursor-pointer rounded-xl overflow-hidden relative group transition-all duration-300 hover:-translate-y-2 shadow-xl hover:shadow-[0_20px_40px_rgba(245,158,11,0.25)] border border-white/5"
                    >
                      {imgUrl ? (
                         <img src={imgUrl} alt={card.name} loading="lazy" className="w-full h-auto rounded-xl" />
                      ) : (
                         <div className="w-full aspect-[5/7] bg-gray-900 flex items-center justify-center text-center p-4 rounded-xl">
                           <p className="text-gray-500 italic">{t('noImage')}</p>
                         </div>
                      )}
                      
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end items-center p-6 pb-8 rounded-xl translate-y-4 group-hover:translate-y-0 pointer-events-none group-hover:pointer-events-auto">
                        <h3 className="text-white font-bold text-center mb-3 mtg-font text-lg tracking-wide drop-shadow-lg">{card.name}</h3>
                        <div className="flex gap-3 mb-5">
                          <span className="bg-gray-800 text-xs px-3 py-1.5 rounded-md text-gray-300 uppercase font-mono border border-gray-600">{card.set}</span>
                          <span className="bg-amber-900/40 text-xs px-3 py-1.5 rounded-md text-amber-400 uppercase font-bold border border-amber-700/50">{card.rarity}</span>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              const slug = card.name ? card.name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-') : card.id;
                              navigate(`/card/${slug}`)
                            }}
                            className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg text-sm transition-colors border border-amber-400/50 flex items-center shadow-lg"
                          >
                            <i className="fa-solid fa-eye mr-2"></i> {t('view')}
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleSaveCard(card); }}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-lg text-sm transition-colors border border-indigo-400/50 flex items-center shadow-lg"
                            title={t('saveBtn')}
                          >
                            <i className="fa-solid fa-heart"></i>
                          </button>
                          <a 
                            href={card.scryfall_uri} target="_blank" rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white px-3 py-2 rounded-lg text-sm transition-colors border border-gray-600 flex items-center shadow-lg"
                            title="Ver en Scryfall"
                          >
                            <i className="fa-solid fa-arrow-up-right-from-square"></i>
                          </a>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
