import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Header from '../components/Header'
import Loader from '../components/Loader'
import { useLanguage } from '../contexts/LanguageContext'
import { useToast } from '../contexts/ToastContext'
import { scryfallFetch, sleep } from '../lib/scryfall'

export default function DeckView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useLanguage()
  const { showToast } = useToast()
  
  const [deck, setDeck] = useState(null)
  const [cards, setCards] = useState([])
  const [rawCardList, setRawCardList] = useState(null)
  const [viewMode, setViewMode] = useState('grid') // 'grid', 'stack', 'list'
  const [groupBy, setGroupBy] = useState('type')
  const [sortBy, setSortBy] = useState('name')
  const [loading, setLoading] = useState(true)
  const [isEnriching, setIsEnriching] = useState(false)
  const [isOwner, setIsOwner] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  
  // Edit state
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editImage, setEditImage] = useState('')
  const [editFormat, setEditFormat] = useState('Standard')

  // Mobile long press state
  const [activeMobileCard, setActiveMobileCard] = useState(null)
  const longPressTimer = useRef(null)
  const isLongPress = useRef(false)

  const handleTouchStart = (scryfall_id) => {
    isLongPress.current = false
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true
      setActiveMobileCard(activeMobileCard === scryfall_id ? null : scryfall_id)
      if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(50)
      }
    }, 500)
  }

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
    }
  }

  const handleTouchMove = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
    }
  }

  useEffect(() => {
    const closeMenu = (e) => {
      if (e.target.closest('button')) return
      setActiveMobileCard(null)
    }
    document.addEventListener('touchstart', closeMenu)
    return () => document.removeEventListener('touchstart', closeMenu)
  }, [])

  useEffect(() => {
    const fetchDeck = async () => {
      setLoading(true)
      
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)

      const { data, error } = await supabase
        .from('decks')
        .select('*')
        .eq('id', id)
        .single()
        
      if (data && !error) {
        setDeck(data)
        if (user && data.user_id === user.id) {
          setIsOwner(true)
        }
        try {
          if (data.card_list) {
            let parsed = []
            if (typeof data.card_list === 'string') {
              if (data.card_list.trim() === '') {
                parsed = []
              } else {
                try {
                  parsed = JSON.parse(data.card_list)
                } catch(e) {
                  const lines = data.card_list.split('\n')
                  const regex = /^(\d+)[xX]?\s+(.+?)(?:\s+\([^)]+\)\s+\S+)?(?:\s+\[([a-f0-9-]+)\])?$/
                  
                  for (const line of lines) {
                    if (!line.trim()) continue
                    const match = line.trim().match(regex)
                    if (match) {
                      const qty = parseInt(match[1], 10) || 1
                      const name = match[2].trim()
                      const scryfall_id = match[3]
                      
                      let imageUrl = 'https://via.placeholder.com/244x340.png?text=No+Image'
                      if (scryfall_id) {
                         imageUrl = `https://cards.scryfall.io/normal/front/${scryfall_id[0]}/${scryfall_id[1]}/${scryfall_id}.jpg`
                      }
                      
                      for (let i = 0; i < qty; i++) {
                        parsed.push({
                          uid: `${scryfall_id || name.replace(/\s+/g,'-')}-${i}-${Date.now()}`,
                          scryfall_id: scryfall_id || '',
                          name: name,
                          image_url: imageUrl
                        })
                      }
                    }
                  }
                  
                  if (parsed.length === 0) throw new Error("Could not parse as JSON or MTG list")
                }
              }
            } else {
              parsed = data.card_list
            }
            
            enrichCards(Array.isArray(parsed) ? parsed : [], data.id, user && data.user_id === user.id)
          } else {
            setCards([])
            setLoading(false)
          }
        } catch (e) {
          console.error("Error parsing card_list", e)
          setRawCardList(data.card_list)
          setCards([])
          setLoading(false)
        }
      } else {
        showToast("Mazo no encontrado o acceso denegado", 'error')
        setLoading(false)
      }
    }
    
    fetchDeck()
  }, [id])

  const enrichCards = async (parsedCards, deckId, isDeckOwner) => {
    const cardsToEnrich = parsedCards.filter(c => c.scryfall_id && (c.type_line === undefined || c.cmc === undefined || c.mana_cost === undefined))
    
    if (cardsToEnrich.length === 0) {
      setCards(parsedCards)
      setLoading(false)
      return
    }

    setIsEnriching(true)
    setCards(parsedCards) // Show immediately what we have
    setLoading(false) // Remove initial loader so user sees UI

    const uniqueIds = [...new Set(cardsToEnrich.map(c => c.scryfall_id))]
    const chunks = []
    for (let i = 0; i < uniqueIds.length; i += 75) {
      chunks.push(uniqueIds.slice(i, i + 75))
    }
    
    let enrichedData = {}
    try {
      for (const chunk of chunks) {
        const response = await scryfallFetch("https://api.scryfall.com/cards/collection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifiers: chunk.map(id => ({ id })) })
        })
        const data = await response.json()
        if (data.data) {
          data.data.forEach(card => {
            enrichedData[card.id] = {
              cmc: card.cmc,
              type_line: card.type_line,
              colors: card.colors || (card.card_faces ? card.card_faces[0].colors : []),
              mana_cost: card.mana_cost !== undefined ? card.mana_cost : (card.card_faces ? card.card_faces[0].mana_cost : '')
            }
          })
        }
        if (chunks.indexOf(chunk) < chunks.length - 1) await sleep(150)
      }
      
      const fullyEnrichedCards = parsedCards.map(c => {
        if (enrichedData[c.scryfall_id]) {
          return { ...c, ...enrichedData[c.scryfall_id] }
        }
        return c
      })
      
      setCards(fullyEnrichedCards)
      
      if (isDeckOwner && fullyEnrichedCards.length > 0) {
        supabase.from('decks').update({ card_list: JSON.stringify(fullyEnrichedCards) }).eq('id', deckId).then()
      }
    } catch (e) {
      console.error("Error enriching cards", e)
    } finally {
      setIsEnriching(false)
    }
  }

  const handleDeleteGroupCard = async (scryfall_id, e) => {
    e.stopPropagation()
    if (!isOwner) return
    
    const cardIndex = cards.findIndex(c => c.scryfall_id === scryfall_id)
    if (cardIndex === -1) return
    
    const newCards = [...cards]
    newCards.splice(cardIndex, 1)
    
    setCards(newCards)
    const { error } = await supabase.from('decks').update({ card_list: JSON.stringify(newCards) }).eq('id', deck.id)
    if (error) {
      showToast("Error al eliminar", "error")
    } else {
      showToast("Carta eliminada", "success")
    }
  }

  const handleToggleCommander = async (scryfall_id, e) => {
    e.stopPropagation()
    if (!isOwner) return
    
    const newCards = cards.map(c => {
      if (c.scryfall_id === scryfall_id) {
        return { ...c, is_commander: !c.is_commander }
      }
      return c
    })
    
    setCards(newCards)
    
    const { error } = await supabase.from('decks').update({ card_list: JSON.stringify(newCards) }).eq('id', deck.id)
    if (error) {
      showToast("Error al actualizar comandante", "error")
      console.error(error)
    } else {
      showToast("Comandante actualizado", "success")
    }
  }

  const isLegendaryCreature = (card) => {
    if (!card.type_line) return false
    return card.type_line.includes('Legendary') && card.type_line.includes('Creature')
  }

  const handleSaveDetails = async (e) => {
    e.preventDefault()
    if (!editName.trim()) return
    
    const { error } = await supabase.from('decks')
      .update({ name: editName.trim(), description: editDesc.trim(), image_url: editImage.trim(), format: editFormat })
      .eq('id', deck.id)
      
    if (error) {
      showToast("Error al guardar detalles", "error")
      console.error(error)
    } else {
      setDeck({ ...deck, name: editName.trim(), description: editDesc.trim(), image_url: editImage.trim(), format: editFormat })
      setIsEditing(false)
      showToast("Detalles actualizados", "success")
    }
  }
  
  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    showToast("Enlace copiado al portapapeles", "success")
  }

  const getCardMainType = (typeLine) => {
    if (!typeLine) return 'Otro'
    const lower = typeLine.toLowerCase()
    if (lower.includes('creature')) return 'Criaturas'
    if (lower.includes('land')) return 'Tierras'
    if (lower.includes('instant')) return 'Instantáneos'
    if (lower.includes('sorcery')) return 'Conjuros'
    if (lower.includes('artifact')) return 'Artefactos'
    if (lower.includes('enchantment')) return 'Encantamientos'
    if (lower.includes('planeswalker')) return 'Planeswalkers'
    return 'Otro'
  }

  const renderManaCost = (manaCost, cmc) => {
    if (!manaCost) {
      if (cmc !== undefined) return <span className="text-amber-400 text-[10px] font-bold bg-black/50 px-1 rounded ml-1">{cmc}</span>;
      return null;
    }
    const symbols = manaCost.match(/{[^}]+}/g);
    if (!symbols) return <span className="text-amber-400 text-[10px] font-bold bg-black/50 px-1 rounded ml-1">{cmc}</span>;
    
    return (
      <div className="flex items-center gap-0.5 ml-1">
        {symbols.map((sym, i) => {
          const cleanSym = sym.replace(/[{}]/g, '').replace('/', '');
          return (
            <img 
              key={i} 
              src={`https://svgs.scryfall.io/card-symbols/${cleanSym}.svg`} 
              alt={sym} 
              className="w-3.5 h-3.5 drop-shadow-md"
            />
          )
        })}
      </div>
    )
  }

  const getCardColorGroup = (colors) => {
    if (!colors) return 'Desconocido'
    if (colors.length === 0) return 'Incoloro'
    
    const colorMap = { 'W': 'Blanco', 'U': 'Azul', 'B': 'Negro', 'R': 'Rojo', 'G': 'Verde' }
    return colors.map(c => colorMap[c] || c).join(' - ')
  }

  const sections = useMemo(() => {
    if (!cards || cards.length === 0) return []
    
    let commanderCards = cards.filter(c => c.is_commander)
    let normalCards = cards.filter(c => !c.is_commander)
    
    const groups = {}
    
    normalCards.forEach(card => {
      let key = 'Cartas'
      if (groupBy === 'type') key = getCardMainType(card.type_line)
      else if (groupBy === 'cmc') {
        const cmc = card.cmc !== undefined ? card.cmc : -1
        key = cmc === -1 ? 'Desconocido' : (cmc >= 6 ? 'Coste 6+' : `Coste ${cmc}`)
      }
      else if (groupBy === 'color') key = getCardColorGroup(card.colors)
      
      if (!groups[key]) groups[key] = []
      groups[key].push(card)
    })
    
    const sortCards = (a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      if (sortBy === 'cmc') {
        const cmcA = a.cmc || 0
        const cmcB = b.cmc || 0
        if (cmcA !== cmcB) return cmcA - cmcB
        return a.name.localeCompare(b.name)
      }
      return 0
    }

    const groupIdentical = (cardList) => {
      return Object.values(cardList.reduce((acc, card) => {
        if (!acc[card.scryfall_id]) {
          acc[card.scryfall_id] = { ...card, count: 1 }
        } else {
          acc[card.scryfall_id].count += 1
        }
        return acc
      }, {})).sort(sortCards)
    }

    const result = Object.entries(groups).map(([title, sectionCards]) => {
      return {
        title,
        cards: sectionCards,
        groupedCards: groupIdentical(sectionCards)
      }
    }).sort((a, b) => {
      if (groupBy === 'cmc') {
        const numA = parseInt(a.title.replace('Coste ', '')) || 0
        const numB = parseInt(b.title.replace('Coste ', '')) || 0
        return numA - numB
      }
      return a.title.localeCompare(b.title)
    })

    if (commanderCards.length > 0) {
      result.unshift({
        title: 'Comandante(s)',
        cards: commanderCards,
        groupedCards: groupIdentical(commanderCards)
      })
    }

    return result
  }, [cards, groupBy, sortBy, deck?.format])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0c10] text-gray-200">
        <Header />
        <div className="flex justify-center items-center h-[calc(100vh-80px)]">
          <div className="animate-pulse flex flex-col items-center">
            <i className="fa-solid fa-circle-notch fa-spin text-4xl text-amber-500 mb-4"></i>
            <p className="text-gray-400 font-bold mtg-font">Cargando mazo...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0c10] text-gray-200">
      <Header />
      
      {isEditing && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-2xl font-bold text-white mb-6 mtg-font">Editar Detalles</h3>
            <form onSubmit={handleSaveDetails}>
              <div className="mb-4">
                <label className="block text-gray-400 text-sm font-bold mb-2">Nombre del Mazo</label>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2 outline-none focus:border-amber-500" required />
              </div>
              <div className="mb-4">
                <label className="block text-gray-400 text-sm font-bold mb-2">URL de la Imagen (Portada)</label>
                <input type="text" value={editImage} onChange={(e) => setEditImage(e.target.value)} placeholder="https://ejemplo.com/imagen.jpg" className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2 outline-none focus:border-amber-500" />
              </div>
              <div className="mb-4">
                <label className="block text-gray-400 text-sm font-bold mb-2">Formato</label>
                <select value={editFormat} onChange={(e) => setEditFormat(e.target.value)} className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2 outline-none focus:border-amber-500">
                  <option value="Standard">Standard</option>
                  <option value="Commander">Commander</option>
                  <option value="Modern">Modern</option>
                  <option value="Pioneer">Pioneer</option>
                  <option value="Legacy">Legacy</option>
                  <option value="Vintage">Vintage</option>
                  <option value="Pauper">Pauper</option>
                  <option value="Casual">Casual</option>
                </select>
              </div>
              <div className="mb-6">
                <label className="block text-gray-400 text-sm font-bold mb-2">Descripción</label>
                <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2 outline-none focus:border-amber-500 min-h-[100px]"></textarea>
              </div>
              <div className="flex justify-end gap-4">
                <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2 text-gray-400 hover:text-white transition-colors font-bold">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-black font-bold rounded-xl transition-colors shadow-lg">Guardar Cambios</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deck ? (
        <main className="flex-grow p-4 lg:p-8 flex flex-col items-center">
          <div className="w-full max-w-7xl mt-4">
            
            <button onClick={() => navigate('/decks')} className="mb-6 text-gray-400 hover:text-amber-500 transition-colors flex items-center">
              <i className="fa-solid fa-arrow-left mr-2"></i> Volver a mis mazos
            </button>
            
            <div className="glass-panel rounded-3xl p-6 lg:p-10 mb-8 border-t border-l border-white/5 shadow-2xl relative overflow-hidden">
              <div className="absolute inset-0 opacity-10 pointer-events-none" 
                   style={{ 
                     backgroundImage: deck.image_url ? `url(${deck.image_url})` : 'none', 
                     backgroundSize: 'cover', 
                     backgroundPosition: 'center', 
                     filter: 'blur(20px)' 
                   }}>
              </div>
              
              <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start">
                <div className="w-full md:w-[250px] shrink-0">
                   {deck.image_url ? (
                     <img src={deck.image_url} alt={deck.name} loading="lazy" className="w-full aspect-[63/88] object-cover rounded-2xl shadow-xl border border-white/10" />
                   ) : (
                     <div className="w-full aspect-[63/88] rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center shadow-xl">
                       <i className="fa-solid fa-layer-group text-6xl text-gray-700"></i>
                     </div>
                   )}
                </div>
                
                <div className="flex-grow">
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="bg-amber-500/20 text-amber-500 text-xs font-bold px-3 py-1 rounded-full border border-amber-500/30 uppercase tracking-wide">
                      {deck.format || 'Standard'}
                    </span>
                    <span className="bg-blue-500/20 text-blue-400 text-xs font-bold px-3 py-1 rounded-full border border-blue-500/30 uppercase tracking-wide">
                      {cards.length} Cartas
                    </span>
                  </div>
                  
                  <h1 className="text-4xl lg:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-100 to-amber-500 mtg-font mb-4">
                    {deck.name}
                  </h1>
                  
                  {deck.description && (
                    <p className="text-gray-400 mb-8 max-w-2xl text-lg leading-relaxed">{deck.description}</p>
                  )}
                  
                  <div className="flex gap-4">
                    <button onClick={copyLink} className="bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-600 px-5 py-2.5 rounded-xl font-bold transition-colors flex items-center shadow-lg">
                      <i className="fa-solid fa-link mr-2 text-amber-500"></i> Copiar Enlace
                    </button>
                    {isOwner && (
                      <button 
                        onClick={() => {
                          setEditName(deck.name || '')
                          setEditDesc(deck.description || '')
                          setEditImage(deck.image_url || '')
                          setEditFormat(deck.format || 'Standard')
                          setIsEditing(true)
                        }}
                        className="bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-600 px-5 py-2.5 rounded-xl font-bold transition-colors flex items-center shadow-lg"
                      >
                        <i className="fa-solid fa-pen mr-2 text-blue-400"></i> Editar Detalles
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
              <h2 className="text-2xl font-bold text-white mtg-font flex items-center">
                <i className="fa-solid fa-layer-group text-amber-500 mr-3"></i> Lista de Cartas ({cards.length})
              </h2>            <div className="flex flex-col sm:flex-row bg-gray-900 rounded-lg p-1 border border-white/10 w-full sm:w-auto gap-1">
                <button onClick={() => setViewMode('grid')} className={`flex-1 sm:flex-none px-3 py-2 rounded-md font-bold transition-all text-sm ${viewMode === 'grid' ? 'bg-amber-600 text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}>
                  <i className="fa-solid fa-th mr-2"></i> Grid
                </button>
                <button onClick={() => setViewMode('stack')} className={`flex-1 sm:flex-none px-3 py-2 rounded-md font-bold transition-all text-sm ${viewMode === 'stack' ? 'bg-amber-600 text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}>
                  <i className="fa-solid fa-clone mr-2"></i> Pila
                </button>
                <button onClick={() => setViewMode('list')} className={`flex-1 sm:flex-none px-3 py-2 rounded-md font-bold transition-all text-sm ${viewMode === 'list' ? 'bg-amber-600 text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}>
                  <i className="fa-solid fa-list mr-2"></i> Lista
                </button>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-4 mb-8 bg-black/40 p-4 rounded-2xl border border-white/5 items-center">
              <span className="text-gray-400 font-bold text-sm uppercase tracking-wide mr-2"><i className="fa-solid fa-filter mr-2"></i> Filtros</span>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 font-bold">Agrupar:</label>
                <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg focus:ring-amber-500 focus:border-amber-500 block px-3 py-1.5 outline-none transition-colors">
                  <option value="none">Ninguno</option>
                  <option value="type">Tipo de Carta</option>
                  <option value="cmc">Coste de Maná</option>
                  <option value="color">Color Principal</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 font-bold">Ordenar:</label>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg focus:ring-amber-500 focus:border-amber-500 block px-3 py-1.5 outline-none transition-colors">
                  <option value="name">Nombre</option>
                  <option value="cmc">Coste de Maná</option>
                </select>
              </div>
              {isEnriching && (
                <div className="ml-auto flex items-center text-amber-500 text-sm font-bold animate-pulse">
                  <i className="fa-solid fa-circle-notch fa-spin mr-2"></i> Analizando mazo...
                </div>
              )}
            </div>
            
            {cards.length === 0 ? (
               <div className="glass-panel p-12 text-center rounded-2xl border-t border-white/5">
                  <i className="fa-solid fa-box-open text-5xl text-gray-600 mb-4"></i>
                  <h3 className="text-xl text-gray-400 font-bold">Este mazo está vacío</h3>
                  {isOwner && <p className="text-gray-500 mt-2">Busca cartas y usa el botón "Añadir al Mazo" para llenarlo.</p>}
                  
                  {rawCardList && (
                    <div className="mt-8 text-left bg-black/50 p-4 rounded-xl border border-red-500/30">
                      <p className="text-red-400 font-bold mb-2"><i className="fa-solid fa-bug mr-2"></i>Error leyendo formato de cartas:</p>
                      <pre className="text-gray-300 text-xs whitespace-pre-wrap font-mono overflow-auto max-h-60">{rawCardList}</pre>
                    </div>
                  )}
               </div>
            ) : (
              <div className={`flex ${viewMode === 'stack' ? 'flex-row overflow-x-auto pb-12 items-start gap-4' : 'flex-col gap-8'}`}>
                {sections.map(section => (
                  <div key={section.title} className={viewMode === 'stack' ? 'w-48 shrink-0' : 'w-full'}>
                    {groupBy !== 'none' && (
                      <h3 className={`text-xl font-bold text-gray-300 border-b border-white/10 pb-2 mb-6 flex items-center ${viewMode === 'stack' ? 'text-sm justify-center mb-4 sticky top-0 bg-[#0a0c10]/90 z-50 backdrop-blur-sm' : ''}`}>
                        <span className="text-amber-500 mr-2 opacity-80"><i className="fa-solid fa-caret-right"></i></span>
                        {section.title} 
                        <span className="bg-gray-800 text-gray-400 text-xs py-0.5 px-2 rounded-full ml-3 border border-gray-700">
                          {section.cards.length}
                        </span>
                      </h3>
                    )}

                    {viewMode === 'grid' && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 lg:gap-6">
                        {section.groupedCards.map((card, idx) => (
                          <div 
                            key={card.uid || card.scryfall_id || idx} 
                            className={`relative group rounded-xl overflow-hidden shadow-lg transition-all duration-300 border border-white/5 select-none [-webkit-touch-callout:none] ${activeMobileCard === card.scryfall_id ? 'scale-95 shadow-none' : 'hover:-translate-y-2 hover:shadow-[0_15px_30px_rgba(245,158,11,0.25)]'}`}
                            onTouchStart={() => handleTouchStart(card.scryfall_id)}
                            onTouchEnd={handleTouchEnd}
                            onTouchMove={handleTouchMove}
                          >
                            {activeMobileCard === card.scryfall_id && (
                              <div className="absolute inset-0 bg-black/60 z-10 pointer-events-none transition-opacity duration-300"></div>
                            )}
                            <img 
                              src={card.image_url || 'https://via.placeholder.com/244x340.png?text=No+Image'} 
                              alt={card.name} 
                              loading="lazy"
                              className="w-full aspect-[63/88] object-cover cursor-pointer"
                              onClick={(e) => {
                                if (isLongPress.current) {
                                  e.preventDefault()
                                  return
                                }
                                navigate(`/card/${card.scryfall_id}`)
                              }}
                            />
                            {card.count > 1 && (
                              <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm text-gray-300 font-medium text-[11px] px-1.5 py-0.5 rounded border border-white/10 z-10 pointer-events-none">
                                {card.count}
                              </div>
                            )}
                            {isOwner && isLegendaryCreature(card) && (
                              <button 
                                onClick={(e) => handleToggleCommander(card.scryfall_id, e)}
                                className={`absolute top-2 right-12 w-9 h-9 rounded-xl text-white flex items-center justify-center transition-opacity shadow-lg border z-20 ${card.is_commander ? 'bg-amber-500 hover:bg-amber-400 border-amber-300/50' : 'bg-gray-800/90 hover:bg-gray-700 border-gray-600/50'} ${activeMobileCard === card.scryfall_id ? 'opacity-100' : 'opacity-0 lg:group-hover:opacity-100'}`}
                                title={card.is_commander ? "Quitar comandante" : "Hacer comandante"}
                              >
                                <i className="fa-solid fa-star"></i>
                              </button>
                            )}
                            {isOwner && (
                              <button 
                                onClick={(e) => handleDeleteGroupCard(card.scryfall_id, e)}
                                className={`absolute top-2 right-2 w-9 h-9 rounded-xl bg-red-600/90 text-white flex items-center justify-center transition-opacity shadow-lg hover:bg-red-500 border border-red-400/50 z-20 ${activeMobileCard === card.scryfall_id ? 'opacity-100' : 'opacity-0 lg:group-hover:opacity-100'}`}
                                title="Quitar una copia"
                              >
                                <i className="fa-solid fa-minus"></i>
                              </button>
                            )}
                            <div className="absolute bottom-0 w-full bg-gradient-to-t from-black/90 to-transparent p-3 pt-8 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none flex justify-between items-end">
                              <p className="text-white text-xs font-bold truncate drop-shadow-md">{card.name}</p>
                              {renderManaCost(card.mana_cost, card.cmc)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                  {viewMode === 'stack' && (
                    <div className="flex flex-col items-center pt-2">
                      {section.groupedCards.map((card, idx) => (
                        <div 
                          key={card.scryfall_id} 
                          className={`peer relative group rounded-xl overflow-hidden border border-white/10 transition-all duration-300 select-none [-webkit-touch-callout:none] w-full aspect-[63/88] ${idx > 0 ? '-mt-44' : ''} ${activeMobileCard === card.scryfall_id ? 'scale-95 shadow-none z-50' : 'shadow-[0_-5px_15px_rgba(0,0,0,0.4)] hover:z-50 hover:shadow-[0_15px_30px_rgba(245,158,11,0.4)] peer-hover:translate-y-44'}`}
                          style={{ zIndex: activeMobileCard === card.scryfall_id ? 50 : idx }}
                          onTouchStart={() => handleTouchStart(card.scryfall_id)}
                          onTouchEnd={handleTouchEnd}
                          onTouchMove={handleTouchMove}
                        >
                          {activeMobileCard === card.scryfall_id && (
                            <div className="absolute inset-0 bg-black/60 z-10 pointer-events-none transition-opacity duration-300"></div>
                          )}
                          <img 
                            src={card.image_url || 'https://via.placeholder.com/244x340.png?text=No+Image'} 
                            alt={card.name} 
                            loading="lazy"
                            className="w-full h-full object-cover cursor-pointer"
                            onClick={(e) => {
                              if (isLongPress.current) {
                                e.preventDefault()
                                return
                              }
                              navigate(`/card/${card.scryfall_id}`)
                            }}
                          />
                          {card.count > 1 && (
                            <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm text-gray-300 font-medium text-[11px] px-1.5 py-0.5 rounded border border-white/10 z-10 pointer-events-none">
                              {card.count}
                            </div>
                          )}
                          {isOwner && isLegendaryCreature(card) && (
                            <button 
                              onClick={(e) => handleToggleCommander(card.scryfall_id, e)}
                              className={`absolute top-2 right-12 w-9 h-9 rounded-xl text-white flex items-center justify-center transition-opacity shadow-lg border z-20 ${card.is_commander ? 'bg-amber-500 hover:bg-amber-400 border-amber-300/50' : 'bg-gray-800/90 hover:bg-gray-700 border-gray-600/50'} ${activeMobileCard === card.scryfall_id ? 'opacity-100' : 'opacity-0 lg:group-hover:opacity-100'}`}
                              title={card.is_commander ? "Quitar comandante" : "Hacer comandante"}
                            >
                              <i className="fa-solid fa-star"></i>
                            </button>
                          )}
                          {isOwner && (
                            <button 
                              onClick={(e) => handleDeleteGroupCard(card.scryfall_id, e)}
                              className={`absolute top-2 right-2 w-9 h-9 rounded-xl bg-red-600/90 text-white flex items-center justify-center transition-opacity shadow-lg hover:bg-red-500 border border-red-400/50 z-20 ${activeMobileCard === card.scryfall_id ? 'opacity-100' : 'opacity-0 lg:group-hover:opacity-100'}`}
                              title="Quitar una copia"
                            >
                              <i className="fa-solid fa-minus"></i>
                            </button>
                          )}
                          <div className="absolute bottom-0 w-full bg-gradient-to-t from-black/90 to-transparent p-3 pt-8 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none flex justify-between items-end z-10">
                            <p className="text-white text-xs font-bold truncate drop-shadow-md">{card.name}</p>
                            {renderManaCost(card.mana_cost, card.cmc)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {viewMode === 'list' && (
                    <div className="w-full bg-gray-900 rounded-2xl border border-white/5 overflow-hidden shadow-2xl">
                      <table className="w-full text-left">
                        <thead className="bg-black/50 text-gray-400 text-sm uppercase tracking-wider">
                          <tr>
                            <th className="p-4 w-20 text-center border-b border-white/5">Cant.</th>
                            <th className="p-4 border-b border-white/5">Carta</th>
                            <th className="p-4 border-b border-white/5 hidden sm:table-cell">Coste</th>
                            {isOwner && <th className="p-4 text-right border-b border-white/5">Acciones</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {section.groupedCards.map((card) => (
                            <tr key={card.scryfall_id} className="hover:bg-white/5 transition-colors group cursor-pointer" onClick={() => navigate(`/card/${card.scryfall_id}`)}>
                              <td className="p-4 text-center font-bold text-amber-500 text-xl">{card.count}</td>
                              <td className="p-4 flex items-center">
                                <img src={card.image_url || 'https://via.placeholder.com/244x340.png?text=No+Image'} alt={card.name} className="w-12 h-16 object-cover rounded-md mr-4 shadow-md" />
                                <span className="text-gray-200 font-bold group-hover:text-amber-400 transition-colors text-lg truncate max-w-[150px] sm:max-w-none">{card.name}</span>
                              </td>
                              <td className="p-4 hidden sm:table-cell">
                                {renderManaCost(card.mana_cost, card.cmc)}
                              </td>
                              {isOwner && (
                                <td className="p-4 text-right whitespace-nowrap">
                                   {isLegendaryCreature(card) && (
                                     <button 
                                       onClick={(e) => handleToggleCommander(card.scryfall_id, e)} 
                                       className={`mr-2 p-3 rounded-xl transition-colors ${card.is_commander ? 'text-amber-500 bg-amber-500/20' : 'text-gray-500 hover:text-amber-500 bg-black/30 hover:bg-amber-500/20'}`}
                                       title={card.is_commander ? "Quitar comandante" : "Hacer comandante"}
                                     >
                                       <i className="fa-solid fa-star"></i>
                                     </button>
                                   )}
                                   <button 
                                     onClick={(e) => handleDeleteGroupCard(card.scryfall_id, e)} 
                                     className="text-gray-500 hover:text-red-500 transition-colors p-3 bg-black/30 hover:bg-red-500/20 rounded-xl"
                                     title="Quitar una copia"
                                   >
                                     <i className="fa-solid fa-trash"></i>
                                   </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                ))}
              </div>
            )}
          </div>
        </main>
      ) : (
        <div className="flex-grow flex items-center justify-center">
          <div className="glass-panel p-12 text-center rounded-3xl">
            <i className="fa-solid fa-triangle-exclamation text-6xl text-red-500 mb-6"></i>
            <h2 className="text-3xl font-bold mb-2">Mazo no encontrado</h2>
            <p className="text-gray-400 mb-6">Es posible que haya sido eliminado o que la URL sea incorrecta.</p>
            <button onClick={() => navigate('/')} className="bg-amber-600 hover:bg-amber-500 text-black font-bold px-6 py-2 rounded-xl">
              Volver al inicio
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
