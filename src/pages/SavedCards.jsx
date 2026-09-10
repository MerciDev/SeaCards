import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import SidebarFilters from '../components/SidebarFilters'
import Loader from '../components/Loader'
import Header from '../components/Header'
import { useLanguage } from '../contexts/LanguageContext'
import { fetchCardsByIds } from '../lib/scryfall'

export default function SavedCards() {
  const { t } = useLanguage()
  const [allCards, setAllCards] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  
  const [filters, setFilters] = useState({})

  const fetchSavedCards = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      // 1. Obtenemos los IDs de supabase
      const { data, error } = await supabase
        .from('liked_cards')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        
      if (data && data.length > 0) {
        const ids = data.map(row => row.scryfall_id)
        const scryfallCards = await fetchCardsByIds(ids)

        // Fusionamos el ID de supabase con los datos completos de scryfall
        const merged = data.map(dbRow => {
          const scryfallCard = scryfallCards.find(c => c.id === dbRow.scryfall_id)
          return scryfallCard ? { ...scryfallCard, supabase_id: dbRow.id, user_tags: dbRow.tags || [] } : null
        }).filter(Boolean)

        setAllCards(merged)
      } else {
        setAllCards([])
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchSavedCards()
  }, [])

  const handleDelete = async (supabaseId) => {
    if (confirm(t('confirmDelete'))) {
      const { error } = await supabase.from('liked_cards').delete().eq('id', supabaseId)
      if (!error) {
        setAllCards(allCards.filter(c => c.supabase_id !== supabaseId))
      }
    }
  }

  // Filtrado local en memoria simulando el comportamiento de Scryfall
  const filteredCards = allCards.filter(c => {
    if (!filters) return true

    // 1. Búsqueda Libre
    if (filters.query) {
      const q = filters.query.toLowerCase()
      let matches = false
      
      if (filters.scopes?.name && c.name?.toLowerCase().includes(q)) matches = true
      if (filters.scopes?.type && c.type_line?.toLowerCase().includes(q)) matches = true
      if (filters.scopes?.text) {
        if (c.oracle_text?.toLowerCase().includes(q)) matches = true
        if (c.card_faces?.[0]?.oracle_text?.toLowerCase().includes(q)) matches = true
        if (c.card_faces?.[1]?.oracle_text?.toLowerCase().includes(q)) matches = true
      }
      
      if (!matches) return false
    }

    // 2. Rareza
    if (filters.rarities && filters.rarities.length > 0) {
      if (!filters.rarities.includes(c.rarity)) return false
    }

    // 3. Tipos
    if (filters.types && filters.types.length > 0) {
      const cardTypes = c.type_line?.toLowerCase() || ''
      const matchesType = filters.types.some(t => cardTypes.includes(t))
      if (!matchesType) return false
    }

    // 4. Identidad de Color (4 estados)
    if (filters.colors && typeof filters.colors === 'object' && !Array.isArray(filters.colors)) {
      const cardColors = (c.color_identity || []).map(col => col.toLowerCase())
      const isColorless = cardColors.length === 0
      
      const greenColors = Object.entries(filters.colors).filter(([_, state]) => state === 'green').map(([col]) => col)
      const redColors = Object.entries(filters.colors).filter(([_, state]) => state === 'red').map(([col]) => col)
      const yellowColors = Object.entries(filters.colors).filter(([_, state]) => state === 'yellow').map(([col]) => col)

      // Verdes (Debe incluir)
      for (const gc of greenColors) {
        if (gc === 'c') {
          if (!isColorless) return false
        } else {
          if (!cardColors.includes(gc)) return false
        }
      }

      // Rojos (No debe incluir)
      for (const rc of redColors) {
        if (rc === 'c') {
          if (isColorless) return false
        } else {
          if (cardColors.includes(rc)) return false
        }
      }

      // Amarillos (Debe incluir al menos uno)
      if (yellowColors.length > 0) {
        const hasAnyYellow = yellowColors.some(yc => {
          if (yc === 'c') return isColorless
          return cardColors.includes(yc)
        })
        if (!hasAnyYellow) return false
      }
    }

    // 5. Formatos
    if (filters.formatFilters && Object.keys(filters.formatFilters).length > 0) {
      const meetsAny = Object.entries(filters.formatFilters).some(([fmt, state]) => {
        if (state === 'legal') return c.legalities?.[fmt] === 'legal'
        if (state === 'not_legal') return c.legalities?.[fmt] === 'banned'
        return false
      })
      if (!meetsAny) return false
    }

    // 6. CMC
    if (filters.cmcMin !== '' && c.cmc < parseFloat(filters.cmcMin)) return false
    if (filters.cmcMax !== '' && c.cmc > parseFloat(filters.cmcMax)) return false

    // 7. Comandante (Legendary Creature o Planeswalker que pueda serlo)
    if (filters.isCommander) {
      const isLegendaryCreature = c.type_line?.includes('Legendary') && c.type_line?.includes('Creature')
      const isPlaneswalkerCommander = c.oracle_text?.toLowerCase().includes('can be your commander') || c.card_faces?.[0]?.oracle_text?.toLowerCase().includes('can be your commander')
      if (!isLegendaryCreature && !isPlaneswalkerCommander) return false
    }

    // 8. Tags
    if (filters.tags && filters.tags.length > 0) {
      if (!c.user_tags || c.user_tags.length === 0) return false
      const hasMatchingTag = filters.tags.some(t => c.user_tags.includes(t))
      if (!hasMatchingTag) return false
    }

    return true
  })

  return (
    <div className="min-h-screen flex flex-col bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] bg-[#0f1115]">
      <Header />

      <div className="w-full px-4 lg:px-8 xl:px-12 2xl:px-16 mx-auto flex flex-col lg:flex-row gap-8 flex-grow items-start mt-4 max-w-[2000px]">
        
        <SidebarFilters 
          showAction={false}
          onFilterChange={setFilters}
        />

        <main className="w-full flex-grow">
          {loading ? (
            <Loader message={t('fetchingSaved')} />
          ) : filteredCards.length === 0 ? (
            <div className="glass-panel rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
               <i className="fa-regular fa-folder-open text-6xl text-gray-700 mb-6"></i>
               <h2 className="text-2xl text-white font-bold mb-2">
                 {allCards.length > 0 ? t('noMatchSaved') : t('noSavedCards')}
               </h2>
               <p className="text-gray-400">
                 {allCards.length > 0 
                   ? t('noMatchDesc') 
                   : t('noSavedDesc')}
               </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6 lg:gap-8">
              {filteredCards.map(card => {
                const imgUrl = card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal
                
                return (
                  <div 
                    key={card.supabase_id} 
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
                        <h3 className="text-white font-bold text-center mb-1 mtg-font text-lg tracking-wide drop-shadow-lg">{card.name}</h3>
                        
                        {card.user_tags && card.user_tags.length > 0 && (
                          <div className="flex flex-wrap justify-center gap-1 mb-3 max-h-12 overflow-y-auto w-full px-2 custom-scrollbar">
                            {card.user_tags.map(t => (
                              <span key={t} className="bg-amber-900/40 text-[10px] px-2 py-0.5 rounded text-amber-400 border border-amber-700/50 truncate max-w-[100px]">{t}</span>
                            ))}
                          </div>
                        )}

                        <div className="flex gap-3 mb-5">
                        <span className="bg-gray-800 text-xs px-3 py-1.5 rounded-md text-gray-300 uppercase font-mono border border-gray-600">{card.set}</span>
                        <span className="bg-amber-900/40 text-xs px-3 py-1.5 rounded-md text-amber-400 uppercase font-bold border border-amber-700/50">{card.rarity}</span>
                      </div>
                      <div className="flex gap-2 mt-2">
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
                          onClick={(e) => { e.stopPropagation(); handleDelete(card.supabase_id); }}
                          className="bg-red-900/80 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm transition-colors border border-red-500/50 flex items-center shadow-lg"
                          title={t('deleteBtn')}
                        >
                          <i className="fa-solid fa-trash"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
