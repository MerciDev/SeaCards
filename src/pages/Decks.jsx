import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import Loader from '../components/Loader'
import { useLanguage } from '../contexts/LanguageContext'

export default function Decks() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  
  const [decks, setDecks] = useState([])
  const [loading, setLoading] = useState(true)
  const [newDeckName, setNewDeckName] = useState('')
  const [creating, setCreating] = useState(false)

  const fetchDecks = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const { data: decksData, error: decksError } = await supabase
      .from('decks')
      .select('*')
      .eq('api_id', 'scryfall-api')
      .order('created_at', { ascending: false })
      
    if (decksError) console.error("Error fetching decks:", decksError)

    if (decksData) {
      // Calculate actual card count based on JSON if needed, or just use what's in card_list
      const processedDecks = decksData.map(d => {
        let count = 0
        try {
          if (d.card_list) {
            const parsed = JSON.parse(d.card_list)
            if (Array.isArray(parsed)) count = parsed.length
          }
        } catch (e) {}
        return { ...d, actualCount: count }
      })
      setDecks(processedDecks)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchDecks()
  }, [])

  const handleCreateDeck = async (e) => {
    e.preventDefault()
    if (!newDeckName.trim()) return
    
    setCreating(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data, error } = await supabase
        .from('decks')
        .insert({ user_id: user.id, name: newDeckName.trim(), card_list: '[]', api_id: 'scryfall-api' })
        .select()
        .single()
        
      if (data && !error) {
        setDecks([{...data, actualCount: 0}, ...decks])
        setNewDeckName('')
      }
    }
    setCreating(false)
  }

  const handleDeleteDeck = async (deckId, e) => {
    e.stopPropagation()
    if (confirm("¿Estás seguro de que quieres eliminar este mazo? Se eliminarán todas sus cartas.")) {
      const { error } = await supabase.from('decks').delete().eq('id', deckId)
      if (!error) {
        setDecks(decks.filter(d => d.id !== deckId))
      }
    }
  }

  const getDeckColorStyle = (colors) => {
    if (!colors || colors.length === 0) return { backgroundColor: '#9ca3af' }
    
    const hexes = colors.map(c => {
      // Purer, high-contrast MTG colors to avoid muddy blending
      if (c === 'W') return '#fbf9f6' // Pure off-white, no green/yellow tint
      if (c === 'U') return '#0e68ab' // MTG Blue
      if (c === 'B') return '#150b00' // MTG Black
      if (c === 'R') return '#d3202a' // MTG Red
      if (c === 'G') return '#00733e' // MTG Green
      return '#9ca3af'
    })
    
    if (hexes.length === 1) {
      return { backgroundColor: hexes[0] }
    }
    
    // For smooth gradients without making the corners look blended/muddy,
    // we pin the colors to their respective centers and only blend between them.
    const step = 100 / hexes.length;
    let stops = [];
    
    hexes.forEach((hex, i) => {
      const center = (i * step) + (step / 2);
      stops.push(`${hex} ${center}%`);
    });
    
    return { background: `linear-gradient(90deg, ${hexes[0]} 0%, ${stops.join(', ')}, ${hexes[hexes.length - 1]} 100%)` }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0c10] text-gray-200">
        <Header />
        <div className="flex justify-center items-center h-[calc(100vh-80px)]">
          <Loader message={t('scrying') || "Cargando mazos..."} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0c10] text-gray-200 flex flex-col">
      <Header />
      
      <main className="flex-grow p-4 lg:p-8 flex flex-col items-center">
        <div className="w-full max-w-7xl mt-8">
          <div className="flex flex-col sm:flex-row justify-between items-center mb-10 gap-4">
            <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-500 mtg-font flex items-center">
              <i className="fa-solid fa-layer-group text-amber-500 mr-4 text-3xl"></i> {t('myDecks') || 'Mis Mazos'}
            </h2>
            
            <form onSubmit={handleCreateDeck} className="flex gap-2 w-full sm:w-auto">
              <input 
                type="text" 
                value={newDeckName}
                onChange={(e) => setNewDeckName(e.target.value)}
                placeholder={t('newDeckName') || 'Nombre del mazo...'}
                className="bg-[#1a1f26] border border-gray-700 rounded-xl px-4 py-2 focus:outline-none focus:border-amber-500 text-white flex-grow shadow-inner"
              />
              <button 
                type="submit"
                disabled={creating || !newDeckName.trim()}
                className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-black px-6 py-2 rounded-xl font-bold transition-all shadow-[0_0_15px_rgba(245,158,11,0.2)] hover:shadow-[0_0_20px_rgba(245,158,11,0.4)] whitespace-nowrap"
              >
                {creating ? <i className="fa-solid fa-spinner fa-spin"></i> : <><i className="fa-solid fa-plus mr-2"></i> {t('createDeck') || 'Crear Mazo'}</>}
              </button>
            </form>
          </div>

          {decks.length === 0 ? (
            <div className="glass-panel p-16 rounded-3xl text-center border-t border-l border-white/5 shadow-2xl flex flex-col items-center justify-center min-h-[400px]">
              <div className="w-24 h-24 rounded-full bg-gray-900 flex items-center justify-center mb-6 shadow-inner border border-gray-800">
                <i className="fa-solid fa-box-open text-4xl text-gray-600"></i>
              </div>
              <h3 className="text-3xl font-bold text-gray-300 mb-4 font-serif">{t('noDecks') || 'Aún no tienes ningún mazo'}</h3>
              <p className="text-gray-500 text-lg max-w-md">Ve a los detalles de cualquier carta y utiliza el botón "Añadir al Mazo" para empezar a construir tus listas.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
              {decks.map(deck => (
                <div 
                  key={deck.id} 
                  onClick={() => navigate(`/decks/${deck.id}`)}
                  className="glass-panel rounded-2xl overflow-hidden border border-white/5 shadow-xl hover:shadow-[0_20px_40px_rgba(245,158,11,0.15)] transition-all duration-300 hover:-translate-y-2 cursor-pointer group flex flex-col h-full"
                >
                  <div className="relative w-full aspect-[4/3] bg-gray-900 border-b border-gray-800 overflow-hidden">
                    {deck.image_url ? (
                      <img src={deck.image_url} alt={deck.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-gray-700">
                        <i className={`fa-solid fa-${deck.icon ? deck.icon.toLowerCase() : 'layer-group'} text-5xl mb-3`}></i>
                        <span className="text-sm font-bold uppercase tracking-widest">Sin Portada</span>
                      </div>
                    )}
                    
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none"></div>
                    
                    <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-lg border border-white/10 flex items-center shadow-lg">
                       <i className="fa-solid fa-clone text-amber-500 mr-2 text-xs"></i>
                       <span className="text-white font-bold text-sm">{deck.actualCount || deck.card_count || 0} Cartas</span>
                    </div>

                    {deck.main_colors && deck.main_colors.length > 0 && (
                      <div 
                        className="absolute bottom-4 left-1/2 -translate-x-1/2 w-4/5 h-2.5 rounded-full shadow-[0_4px_10px_rgba(0,0,0,0.8)] border border-white/20 z-10"
                        style={getDeckColorStyle(deck.main_colors)}
                      ></div>
                    )}

                    <button 
                      onClick={(e) => handleDeleteDeck(deck.id, e)}
                      className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-red-600/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-red-500 border border-red-400/50"
                      title="Eliminar Mazo"
                    >
                      <i className="fa-solid fa-trash text-sm"></i>
                    </button>
                  </div>
                  
                  <div className="p-5 flex-grow flex flex-col justify-between bg-[#111318]">
                    <h3 className="text-2xl font-bold text-gray-200 mb-1 truncate group-hover:text-amber-400 transition-colors">{deck.name}</h3>
                    {deck.description && (
                      <p className="text-xs text-gray-400 mb-3 line-clamp-2">{deck.description}</p>
                    )}
                    <div className="flex justify-between items-center text-sm text-gray-500 mt-auto">
                      <span className="uppercase font-bold tracking-wider">{deck.format || 'Standard'}</span>
                      <span>
                        <i className="fa-solid fa-calendar-alt mr-1.5"></i>
                        {new Date(deck.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
