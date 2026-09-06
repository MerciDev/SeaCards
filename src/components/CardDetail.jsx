import React, { useState, useEffect, Fragment } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../contexts/LanguageContext'
import { useSymbology } from '../contexts/SymbologyContext'
import { useToast } from '../contexts/ToastContext'
import Loader from './Loader'

const formatManaCost = (cost, symbology) => {
  if (!cost) return null
  return cost.match(/\{[^}]+\}/g)?.map((sym, i) => {
    const svg = symbology[sym]
    if (svg) {
      return <img key={i} src={svg} alt={sym} className="inline-block w-5 h-5 mx-0.5 drop-shadow-md align-middle bg-gray-900 rounded-full" />
    }
    const c = sym.replace(/[{}]/g, '').replace('/', '').toLowerCase()
    return <i key={i} className={`ms ms-${c} ms-cost mtg-symbol mx-0.5 text-xl drop-shadow-md`}></i>
  })
}

const formatOracleText = (text, symbology) => {
  if (!text) return null
  return text.split('\n').map((line, i) => {
    const parts = line.split(/(\{[^}]+\})/g)
    return (
      <p key={i} className="mb-2">
        {parts.map((part, j) => {
          if (part.startsWith('{') && part.endsWith('}')) {
            const svg = symbology[part]
            if (svg) {
              return <img key={j} src={svg} alt={part} className="inline-block w-[0.85em] h-[0.85em] mx-[0.15em] align-middle drop-shadow-sm rounded-full" />
            }
            const c = part.replace(/[{}]/g, '').replace('/', '').toLowerCase()
            return <i key={j} className={`ms ms-${c} ms-cost mtg-symbol mx-0.5`}></i>
          }
          return part
        })}
      </p>
    )
  })
}

const formatCardSlug = (c) => {
  if (!c) return ''
  if (c.name) return c.name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-')
  return c.id
}

export default function CardDetail({ baseCard, mobileActionNode }) {
  const { t, lang } = useLanguage()
  const symbology = useSymbology()
  const { showToast } = useToast()
  
  const [card, setCard] = useState(baseCard)
  const [localizedData, setLocalizedData] = useState(null)
  const [fetchingLocal, setFetchingLocal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [likedCardId, setLikedCardId] = useState(null)
  const [cardTags, setCardTags] = useState([])
  const [newTag, setNewTag] = useState('')
  const [prints, setPrints] = useState([])
  const [fetchingPrints, setFetchingPrints] = useState(false)
  const [edhrecModes, setEdhrecModes] = useState([])
  const [selectedModeIndex, setSelectedModeIndex] = useState(0)
  const [fetchingSimilar, setFetchingSimilar] = useState(false)
  const [collapsedSections, setCollapsedSections] = useState({})
  const [printsCollapsed, setPrintsCollapsed] = useState(true)
  const [allSavedCardIds, setAllSavedCardIds] = useState(new Set())
  
  const [showDeckModal, setShowDeckModal] = useState(false)
  const [userDecks, setUserDecks] = useState([])
  const [newDeckName, setNewDeckName] = useState('')
  const [deckActionLoading, setDeckActionLoading] = useState(false)

  const fetchUserDecks = async () => {
    const { data, error } = await supabase.from('decks').select('*').eq('api_id', 'scryfall-api').order('created_at', { ascending: false })
    if (data && !error) {
      setUserDecks(data)
    }
  }

  const handleOpenDeckModal = () => {
    fetchUserDecks()
    setShowDeckModal(true)
  }

  const handleCreateDeckAndAdd = async () => {
    if (!newDeckName.trim()) return
    setDeckActionLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not logged in")
      
      const newCard = {
        uid: Date.now().toString(),
        scryfall_id: card.id,
        name: card.name,
        image_url: card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal
      }

      const { data: deckData, error: deckError } = await supabase
        .from('decks')
        .insert({ 
          user_id: user.id, 
          name: newDeckName.trim(),
          card_list: JSON.stringify([newCard]),
          image_url: newCard.image_url,
          api_id: 'scryfall-api'
        })
        .select()
        .single()
        
      if (deckError) throw deckError
      
      showToast(t('cardAddedToDeck') || "Carta añadida al mazo.", 'success')
      setNewDeckName('')
      setShowDeckModal(false)
    } catch (err) {
      console.error(err)
      showToast("Error al crear mazo o añadir carta.", 'error')
    } finally {
      setDeckActionLoading(false)
    }
  }

  const handleAddToDeck = async (deckId) => {
    setDeckActionLoading(true)
    try {
      const { data: deck } = await supabase
        .from('decks')
        .select('id, card_list, image_url')
        .eq('id', deckId)
        .single()
        
      let cards = []
      try {
        if (deck.card_list) cards = JSON.parse(deck.card_list)
        if (!Array.isArray(cards)) cards = []
      } catch(e) {}
      
      const newCard = {
        uid: Date.now().toString() + Math.random().toString(36).substring(2, 7),
        scryfall_id: card.id,
        name: card.name,
        image_url: card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal
      }
      
      cards.push(newCard)
      
      const updateData = { card_list: JSON.stringify(cards) }
      if (!deck.image_url) {
        updateData.image_url = newCard.image_url
      }

      const { error } = await supabase
        .from('decks')
        .update(updateData)
        .eq('id', deckId)
        
      if (error) throw error
      showToast(t('cardAddedToDeck') || "Carta añadida al mazo.", 'success')
      setShowDeckModal(false)
    } catch (err) {
      console.error(err)
      showToast("Error al añadir al mazo.", 'error')
    } finally {
      setDeckActionLoading(false)
    }
  }

  const edhrecSections = edhrecModes[selectedModeIndex]?.sections || []

  const [hoverTimeout, setHoverTimeout] = useState(null)
  const [zoomedCard, setZoomedCard] = useState(null)

  const handleMouseEnter = (cardImg) => {
    if (!cardImg) return
    const timer = setTimeout(() => {
      setZoomedCard(cardImg)
    }, 1200)
    setHoverTimeout(timer)
  }

  const handleMouseLeave = () => {
    if (hoverTimeout) clearTimeout(hoverTimeout)
    setZoomedCard(null)
  }

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeout) clearTimeout(hoverTimeout)
    }
  }, [hoverTimeout])

  const allExpanded = !printsCollapsed && edhrecSections.every(s => !collapsedSections[s.title])

  const toggleAll = () => {
    const nextState = !allExpanded
    setPrintsCollapsed(nextState)
    const newSectionsState = {}
    edhrecSections.forEach(s => {
      newSectionsState[s.title] = nextState
    })
    setCollapsedSections(newSectionsState)
  }

  const toggleSection = (title) => {
    setCollapsedSections(prev => ({ ...prev, [title]: !prev[title] }))
  }

  // Reset local state if baseCard changes from outside
  useEffect(() => {
    setCard(baseCard)
  }, [baseCard])

  useEffect(() => {
    if (!card) return
    const fetchLocalized = async () => {
      if (card.lang === lang) {
        setLocalizedData(card)
        return
      }
      
      if (lang === 'en') {
        setLocalizedData({
          ...card,
          printed_name: card.name,
          printed_type_line: card.type_line,
          printed_text: card.oracle_text,
        })
        return
      }

      setFetchingLocal(true)
      
      const autoTranslate = async (text) => {
        if (!text) return ''
        try {
          const emojis = ["🍎","🍌","🍉","🍇","🍓","🍒","🍑","🥭","🍍","🥥","🥝","🍅","🍆","🥑","🥦","🥒","🥬","🌶","🌽","🥕","🧄","🧅","🥔","🍠","🥐","🍞","🥖","🥨","🧀","🥚","🍳","🧈","🥞","🧇","🥓","🥩","🍗","🍖","🌭","🍔","🍟","🍕","🥪","🥙","🧆","🌮","🌯","🥗","🥘","🥫"]
          const symbols = []
          let protectedText = text.replace(/\{.*?\}/g, (match) => {
            symbols.push(match)
            return emojis[symbols.length - 1] || `_${symbols.length - 1}_`
          })

          const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${lang}&dt=t&q=${encodeURIComponent(protectedText)}`
          const res = await fetch(url)
          const data = await res.json()
          let translated = data[0].map(x => x[0]).join('')
          
          symbols.forEach((sym, i) => {
            const emoji = emojis[i]
            if (emoji) {
              translated = translated.replace(new RegExp(emoji, 'g'), sym)
            } else {
              translated = translated.replace(new RegExp(`_${i}_`, 'g'), sym)
            }
          })

          return translated
        } catch (e) {
          console.error(e)
          return text
        }
      }

      try {
        const url = `https://api.scryfall.com/cards/search?q=oracle_id:${card.oracle_id}+lang:${lang}`
        const res = await fetch(url)
        let dataToUse = null
        
        if (res.ok) {
          const data = await res.json()
          if (data.data && data.data.length > 0) {
            dataToUse = data.data[0]
          }
        }
        
        if (dataToUse) {
          if (!dataToUse.printed_name && dataToUse.name) dataToUse.printed_name = await autoTranslate(dataToUse.name)
          if (!dataToUse.printed_type_line && dataToUse.type_line) dataToUse.printed_type_line = await autoTranslate(dataToUse.type_line)
          if (!dataToUse.printed_text && dataToUse.oracle_text) dataToUse.printed_text = await autoTranslate(dataToUse.oracle_text)
          if (!dataToUse.printed_flavor_text && dataToUse.flavor_text) dataToUse.printed_flavor_text = await autoTranslate(dataToUse.flavor_text)
          
          setLocalizedData(dataToUse)
        } else {
          const translatedCard = {
            ...card,
            printed_name: await autoTranslate(card.name),
            printed_type_line: await autoTranslate(card.type_line),
            printed_text: await autoTranslate(card.oracle_text),
            printed_flavor_text: await autoTranslate(card.flavor_text)
          }
          setLocalizedData(translatedCard)
        }
      } catch(e) {
        setLocalizedData(card)
      } finally {
        setFetchingLocal(false)
      }
    }
    
    let cancelled = false
    // Debounce: only fetch localized data if user stays on card for 1s
    const timer = setTimeout(() => { if (!cancelled) fetchLocalized() }, 1000)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [card, lang])

  useEffect(() => {
    if (!card) return
    let mounted = true
    // Debounce: only fetch prints if the user stays on this card for 1.5s
    const timer = setTimeout(async () => {
      if (!mounted) return
      setFetchingPrints(true)
      try {
        const res = await fetch(`https://api.scryfall.com/cards/search?q=oracle_id:${card.oracle_id}&unique=prints`)
        if (res.status === 429) { if (mounted) setFetchingPrints(false); return }
        if (res.ok) {
          const data = await res.json()
          if (mounted) setPrints(data.data || [])
        }
      } catch (e) {
        console.error("Error fetching prints", e)
      } finally {
        if (mounted) setFetchingPrints(false)
      }
    }, 1500)
    return () => { mounted = false; clearTimeout(timer) }
  }, [card?.oracle_id])

  useEffect(() => {
    if (!card || card.legalities?.commander !== 'legal') {
      setEdhrecModes([])
      return
    }
    
    let isActive = true
    const fetchSimilar = async () => {
      setFetchingSimilar(true)
      try {
        const slug = card.name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-')
        const modeConfigs = [
          { mode: 'commanders', label: 'Como Comandante', icon: 'fa-crown' },
          { mode: 'cards', label: 'En el Mazo (99)', icon: 'fa-layer-group' },
          { mode: 'partners', label: 'Como Partner', icon: 'fa-handshake' },
          { mode: 'backgrounds', label: 'Con Background', icon: 'fa-scroll' }
        ]

        const [combosRes, ...modeResArray] = await Promise.all([
          fetch(`https://json.edhrec.com/pages/combos/${slug}.json`).catch(() => ({ ok: false })),
          ...modeConfigs.map(cfg => fetch(`https://json.edhrec.com/pages/${cfg.mode}/${slug}.json`).catch(() => ({ ok: false })))
        ])
        
        let combosNames = []
        let combosStructuredList = []
        if (combosRes.ok) {
          try {
            const combosData = await combosRes.json()
            const comboLists = combosData.container?.json_dict?.cardlists || combosData.container?.json_dict?.combos || []
            if (comboLists.length > 0) {
              combosStructuredList = comboLists
              const comboSet = new Set()
              comboLists.forEach(list => {
                if (list.cardviews) {
                  list.cardviews.forEach(c => {
                    if (c.name && c.name !== card.name) {
                      comboSet.add(c.name)
                    }
                  })
                }
              })
              combosNames = Array.from(comboSet)
            }
          } catch (e) {
            console.error("Error parsing Combos", e)
          }
        }

        const validModes = []
        const allNames = new Set(combosNames)

        for (let idx = 0; idx < modeConfigs.length; idx++) {
          const mRes = modeResArray[idx]
          const mCfg = modeConfigs[idx]
          if (mRes.ok) {
            try {
              const mData = await mRes.json()
              const lists = []
              
              if (mData.similar?.length > 0) {
                lists.push({ header: 'Cartas Similares', names: mData.similar })
                mData.similar.forEach(n => allNames.add(n))
              }
              const rawLists = mData.container?.json_dict?.cardlists || []
              for (const list of rawLists) {
                if (list.cardviews?.length > 0) {
                   const names = list.cardviews.map(c => c.name).filter(Boolean)
                   lists.push({
                     header: list.header,
                     names: names
                   })
                   names.forEach(n => allNames.add(n))
                }
              }
              if (lists.length > 0 || combosNames.length > 0) {
                validModes.push({
                  ...mCfg,
                  lists: lists
                })
              }
            } catch(e) {
              console.error(`Error parsing mode ${mCfg.mode}`, e)
            }
          }
        }

        if (validModes.length === 0) {
          if (isActive) setEdhrecModes([])
          return
        }

        const isLegend = card.type_line && card.type_line.toLowerCase().includes('legendary')
        const defaultIdx = isLegend ? validModes.findIndex(m => m.mode === 'commanders') : 0
        const activeIdx = defaultIdx !== -1 ? defaultIdx : 0
        setSelectedModeIndex(activeIdx)

        const prioritizedNames = new Set()
        if (validModes[activeIdx]) {
          validModes[activeIdx].lists.forEach(l => l.names.forEach(n => prioritizedNames.add(n)))
        }
        combosNames.forEach(n => prioritizedNames.add(n))
        validModes.forEach((vm, idx) => {
          if (idx !== activeIdx) {
            vm.lists.forEach(l => l.names.forEach(n => prioritizedNames.add(n)))
          }
        })

        const uniqueNames = Array.from(prioritizedNames)
        const scryfallCards = {}

        const getSectionColor = (title) => {
          const map = {
            'Principales Combos Detallados': 'text-fuchsia-400',
            'Principales Combos (Piezas)': 'text-fuchsia-400',
            'Cartas Similares': 'text-gray-300',
            'New Commanders': 'text-amber-500',
            'Top Commanders': 'text-emerald-500',
            'Creatures': 'text-green-400',
            'Instants': 'text-blue-400',
            'Sorceries': 'text-red-400',
            'Enchantments': 'text-purple-400',
            'Artifacts': 'text-gray-400',
            'Utility Artifacts': 'text-gray-400',
            'Mana Artifacts': 'text-yellow-600',
            'Planeswalkers': 'text-pink-500',
            'Lands': 'text-yellow-800',
            'Utility Lands': 'text-yellow-700',
            'New Cards': 'text-teal-400',
            'Top Cards': 'text-emerald-400',
            'Game Changers': 'text-orange-500',
            'High Lift Cards': 'text-indigo-400',
            'High Synergy Cards': 'text-indigo-400'
          }
          return map[title] || 'text-gray-400'
        }
        
        const getSectionIcon = (title) => {
          const map = {
            'Principales Combos Detallados': 'fa-bolt-lightning',
            'Principales Combos (Piezas)': 'fa-link',
            'Cartas Similares': 'fa-clone',
            'New Commanders': 'fa-user-plus',
            'Top Commanders': 'fa-crown',
            'Creatures': 'fa-paw',
            'Instants': 'fa-bolt',
            'Sorceries': 'fa-fire',
            'Enchantments': 'fa-star',
            'Artifacts': 'fa-gem',
            'Utility Artifacts': 'fa-wrench',
            'Mana Artifacts': 'fa-ring',
            'Planeswalkers': 'fa-user-ninja',
            'Lands': 'fa-mountain',
            'Utility Lands': 'fa-map',
            'New Cards': 'fa-wand-magic-sparkles',
            'Top Cards': 'fa-trophy',
            'Game Changers': 'fa-meteor',
            'High Lift Cards': 'fa-arrow-trend-up',
            'High Synergy Cards': 'fa-handshake'
          }
          return map[title] || 'fa-layer-group'
        }

        const updateModesProgressively = () => {
          const builtModes = validModes.map(vm => {
            const finalLists = []
            if (combosStructuredList.length > 0) {
              const enrichedCombos = combosStructuredList.map(comboObj => ({
                ...comboObj,
                resolvedCards: (comboObj.cardviews || []).map(cv => scryfallCards[cv.name] || { name: cv.name, id: cv.id || cv.name })
              }))
              finalLists.push({
                title: 'Principales Combos Detallados',
                isComboSection: true,
                combos: enrichedCombos,
                color: getSectionColor('Principales Combos Detallados'),
                icon: getSectionIcon('Principales Combos Detallados')
              })
            }
            vm.lists.forEach(l => {
              const lData = l.names.map(n => scryfallCards[n]).filter(Boolean)
              if (lData.length > 0) {
                finalLists.push({
                  title: l.header,
                  data: lData,
                  color: getSectionColor(l.header),
                  icon: getSectionIcon(l.header)
                })
              }
            })
            return {
              ...vm,
              sections: finalLists
            }
          }).filter(vm => vm.sections.length > 0)

          setEdhrecModes(builtModes)
          
          setCollapsedSections(prev => {
            const next = { ...prev }
            builtModes.forEach(vm => {
              vm.sections.forEach(s => {
                if (next[s.title] === undefined) {
                  next[s.title] = true
                }
              })
            })
            return next
          })
        }

        if (uniqueNames.length > 0) {
          for (let i = 0; i < uniqueNames.length; i += 75) {
            if (!isActive) return
            const chunk = uniqueNames.slice(i, i + 75).map(name => ({ name }))
            try {
              const scryRes = await fetch('https://api.scryfall.com/cards/collection', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ identifiers: chunk })
              })
              if (scryRes.ok) {
                 const chunkData = await scryRes.json()
                 if (chunkData.data) {
                   chunkData.data.forEach(c => {
                     scryfallCards[c.name] = c
                   })
                 }
              }
            } catch (e) {
              console.error("Scryfall collection error", e)
            }
            if (!isActive) return
            updateModesProgressively()
            
            if (i + 75 < uniqueNames.length) {
              await new Promise(r => setTimeout(r, 80))
            }
          }
        }
      } catch (e) {
        console.error("Error fetching EDHREC dynamic sections", e)
      } finally {
        if (isActive) setFetchingSimilar(false)
      }
    }
    // Debounce: only fetch EDHREC if the user stays on this card for 2s
    const timer = setTimeout(() => { fetchSimilar() }, 2000)
    return () => { isActive = false; clearTimeout(timer) }
  }, [card?.name])

  useEffect(() => {
    const checkSaved = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data, error } = await supabase
        .from('liked_cards')
        .select('id, scryfall_id, tags')
        .eq('user_id', user.id)
      
      if (data && !error) {
        const savedMap = new Map(data.map(d => [d.scryfall_id, d]))
        setAllSavedCardIds(new Set(savedMap.keys()))
        if (card && savedMap.has(card.id)) {
          setIsSaved(true)
          const savedData = savedMap.get(card.id)
          setLikedCardId(savedData.id)
          setCardTags(savedData.tags || [])
        } else {
          setIsSaved(false)
          setLikedCardId(null)
          setCardTags([])
        }
      } else {
        setIsSaved(false)
        setLikedCardId(null)
        setCardTags([])
      }
    }
    checkSaved()
  }, [card?.id])

  const handleSaveCard = async () => {
    if (!card) return
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        showToast("Debes iniciar sesión para guardar cartas.", 'warning')
        return
      }
      
      if (isSaved) {
        const { error } = await supabase
          .from('liked_cards')
          .delete()
          .eq('user_id', user.id)
          .eq('scryfall_id', card.id)
        if (error) throw error
        setIsSaved(false)
        setLikedCardId(null)
        setCardTags([])
        setAllSavedCardIds(prev => { const n = new Set(prev); n.delete(card.id); return n })
        showToast("Carta eliminada de Favoritos.", 'success')
      } else {
        const { data, error } = await supabase.from('liked_cards').insert({
          user_id: user.id,
          scryfall_id: card.id,
          name: card.name,
          image_url: card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal,
          set_code: card.set,
          rarity: card.rarity,
          tags: []
        }).select().single()
        if (error) throw error
        setIsSaved(true)
        setLikedCardId(data.id)
        setCardTags(data.tags || [])
        setAllSavedCardIds(prev => { const n = new Set(prev); n.add(card.id); return n })
        showToast(t('savedAlert') || "¡Carta guardada en Favoritos!", 'success')
      }
    } catch (e) {
      console.error(e)
      showToast("Error al procesar. Inténtalo de nuevo.", 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleAddTag = async (e) => {
    if (e.key === 'Enter' && newTag.trim() !== '') {
      if (!likedCardId) return
      const tag = newTag.trim().toLowerCase()
      if (cardTags.includes(tag)) {
        setNewTag('')
        return
      }
      const newTags = [...cardTags, tag]
      setCardTags(newTags)
      setNewTag('')
      
      const { error } = await supabase.from('liked_cards').update({ tags: newTags }).eq('id', likedCardId)
      if (error) {
        showToast("Error al añadir etiqueta", "error")
        setCardTags(cardTags)
      }
    }
  }

  const handleRemoveTag = async (tagToRemove) => {
    if (!likedCardId) return
    const newTags = cardTags.filter(t => t !== tagToRemove)
    setCardTags(newTags)
    
    const { error } = await supabase.from('liked_cards').update({ tags: newTags }).eq('id', likedCardId)
    if (error) {
      showToast("Error al quitar etiqueta", "error")
      setCardTags(cardTags)
    }
  }

  const handleSaveAnyCard = async (targetCard, e) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    if (!targetCard) return
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        showToast("Debes iniciar sesión para guardar cartas.", 'warning')
        return
      }
      
      const targetId = targetCard.id || targetCard.scryfall_id
      
      if (allSavedCardIds.has(targetId)) {
        const { error } = await supabase
          .from('liked_cards')
          .delete()
          .eq('user_id', user.id)
          .eq('scryfall_id', targetId)
        if (error) throw error
        setAllSavedCardIds(prev => { const n = new Set(prev); n.delete(targetId); return n })
        if (card && targetId === card.id) {
            setIsSaved(false)
            setLikedCardId(null)
            setCardTags([])
        }
        showToast(`¡${targetCard.name} eliminada de Favoritos!`, 'success')
      } else {
        const { error } = await supabase.from('liked_cards').insert({
          user_id: user.id,
          scryfall_id: targetId,
          name: targetCard.name,
          image_url: targetCard.image_uris?.normal || targetCard.card_faces?.[0]?.image_uris?.normal,
          set_code: targetCard.set || 'EDH',
          rarity: targetCard.rarity || 'common'
        })
        if (error && error.code !== '23505') {
          throw error
        }
        setAllSavedCardIds(prev => { const n = new Set(prev); n.add(targetId); return n })
        if (card && targetId === card.id) setIsSaved(true)
        showToast(`¡${targetCard.name} guardada en Favoritos!`, 'success')
      }
    } catch (err) {
      console.error(err)
      showToast("Error al guardar la carta.", 'error')
    }
  }

  if (!card) return null

  const majorFormats = ['standard', 'pioneer', 'modern', 'legacy', 'vintage', 'commander', 'pauper']
  
  const getLegalityColor = (status) => {
    switch(status) {
      case 'legal': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
      case 'banned': return 'text-red-400 bg-red-500/10 border-red-500/30'
      case 'restricted': return 'text-amber-400 bg-amber-500/10 border-amber-500/30'
      case 'not_legal': default: return 'text-gray-500 bg-gray-800 border-gray-700'
    }
  }

  const formatLabels = {
    standard: 'Standard',
    pioneer: 'Pioneer',
    modern: 'Modern',
    legacy: 'Legacy',
    vintage: 'Vintage',
    commander: 'Commander',
    pauper: 'Pauper'
  }

  return (
    <div className="glass-panel rounded-3xl overflow-hidden flex flex-col relative shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-t border-l border-white/10 min-h-[600px] max-w-full w-full">
      
      {fetchingLocal && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-md z-20 flex items-center justify-center rounded-3xl transition-all duration-300">
          <Loader message={t('scrying')} />
        </div>
      )}

      {zoomedCard && createPortal(
        <div className="fixed inset-0 z-[9999] pointer-events-none flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in">
          <img 
            src={zoomedCard} 
            alt="Zoomed Card"
            className="max-h-[90vh] max-w-[95vw] object-contain rounded-[4.75%] shadow-[0_0_80px_rgba(245,158,11,0.8)] animate-zoom-in"
          />
        </div>,
        document.body
      )}

      {showDeckModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in" onClick={() => setShowDeckModal(false)}>
          <div className="bg-[#111318] border border-gray-700/80 p-8 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] max-w-md w-full relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowDeckModal(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors">
              <i className="fa-solid fa-xmark text-2xl"></i>
            </button>
            <h3 className="text-2xl font-bold text-amber-500 mb-6 font-serif">{t('addToDeck') || 'Añadir al Mazo'}</h3>
            
            <div className="mb-6">
              <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">{t('createDeck') || 'Crear Mazo'}</h4>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={newDeckName}
                  onChange={(e) => setNewDeckName(e.target.value)}
                  placeholder={t('newDeckName') || 'Nombre del mazo...'}
                  className="bg-black/50 border border-gray-700 rounded-lg px-4 py-2 text-white flex-grow focus:outline-none focus:border-amber-500"
                />
                <button 
                  onClick={handleCreateDeckAndAdd}
                  disabled={deckActionLoading || !newDeckName.trim()}
                  className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:hover:bg-amber-600 text-white px-4 py-2 rounded-lg font-bold transition-colors"
                >
                  {deckActionLoading ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-plus"></i>}
                </button>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">{t('myDecks') || 'Mis Mazos'}</h4>
              <div className="max-h-[300px] overflow-y-auto custom-scrollbar flex flex-col gap-2 pr-2">
                {userDecks.length === 0 ? (
                  <p className="text-gray-500 italic text-sm">{t('noDecks') || 'Aún no tienes ningún mazo.'}</p>
                ) : (
                  userDecks.map(deck => (
                    <button 
                      key={deck.id}
                      onClick={() => handleAddToDeck(deck.id)}
                      disabled={deckActionLoading}
                      className="flex items-center justify-between w-full bg-gray-900/50 hover:bg-amber-900/30 border border-gray-800 hover:border-amber-500/50 p-3 rounded-xl transition-all text-left disabled:opacity-50"
                    >
                      <span className="text-gray-200 font-bold">{deck.name}</span>
                      <i className="fa-solid fa-plus text-amber-500/70"></i>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      <div className="flex flex-col xl:flex-row flex-grow relative">
        <div className="p-8 xl:w-[45%] flex flex-col items-center bg-gradient-to-b from-black/40 to-black/10 border-r border-b xl:border-b-0 border-gray-800/50 shrink-0">
        <div className="relative w-full max-w-[340px]">
          <img 
            src={card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal} 
            alt={card.name}
            className="w-full aspect-[63/88] object-cover rounded-[4.75%] shadow-[0_15px_35px_rgba(0,0,0,0.6)] border border-white/5 bg-gray-900/50"
          />
          {card.edhrec_rank && card.legalities?.commander === 'legal' && (
            <div 
              className="absolute -top-3 -right-3 bg-[#1c242a] text-emerald-400 text-sm font-bold px-4 py-1.5 rounded-full border border-emerald-500/50 shadow-[0_5px_15px_rgba(16,185,129,0.3)] flex items-center z-10 group cursor-help"
              title="Posición de popularidad en EDHREC (Commander)"
            >
              <i className="fa-solid fa-crown mr-2 group-hover:text-amber-400 transition-colors"></i> #{card.edhrec_rank}
            </div>
          )}
        </div>
        
        {mobileActionNode && (
          <div className="w-full mt-6 xl:hidden">
            {mobileActionNode}
          </div>
        )}
        
        <div className="flex gap-4 mt-8 w-full max-w-[340px] justify-center">
          <button
            onClick={handleSaveCard}
            disabled={saving}
            title={t('saveBtn')}
            className={`w-14 h-14 rounded-2xl transition-all border flex items-center justify-center text-2xl group disabled:opacity-50 shadow-lg ${
              isSaved 
                ? 'bg-red-600/20 hover:bg-red-500/40 text-red-500 hover:text-red-400 border-red-500/30 hover:border-red-400/60 shadow-[0_0_15px_rgba(239,68,68,0.2)]'
                : 'bg-gray-800/50 hover:bg-gray-700/80 text-gray-400 hover:text-gray-200 border-gray-600/50 hover:border-gray-500/70'
            }`}
          >
            <i className={`fa-solid ${saving ? 'fa-spinner fa-spin' : 'fa-heart'} group-hover:scale-110 transition-transform ${isSaved ? '' : 'text-gray-400 group-hover:text-red-400 transition-colors'}`}></i> 
          </button>
          <button
            onClick={handleOpenDeckModal}
            title={t('addToDeck') || "Añadir al Mazo"}
            className="w-14 h-14 bg-gray-800/50 hover:bg-gray-700/80 text-gray-400 hover:text-gray-200 rounded-2xl transition-all border border-gray-600/50 hover:border-gray-500/70 shadow-lg flex items-center justify-center text-2xl group"
          >
            <i className="fa-solid fa-layer-group group-hover:scale-110 transition-transform"></i>
          </button>
          <a 
            href={card.scryfall_uri} 
            target="_blank" 
            rel="noreferrer" 
            title="Ver en Scryfall"
            className="w-14 h-14 bg-gray-800/50 hover:bg-gray-700/80 text-gray-400 hover:text-gray-200 rounded-2xl transition-all border border-gray-600/50 hover:border-gray-500/70 shadow-lg flex items-center justify-center text-2xl group"
          >
            <i className="fa-solid fa-arrow-up-right-from-square group-hover:scale-110 transition-transform"></i>
          </a>
          <button
            onClick={() => {
              const url = `${window.location.origin}/card/${formatCardSlug(card)}`;
              navigator.clipboard.writeText(url);
              showToast("¡Enlace copiado al portapapeles!", "success");
            }}
            title="Copiar Enlace"
            className="w-14 h-14 bg-gray-800/50 hover:bg-gray-700/80 text-gray-400 hover:text-gray-200 rounded-2xl transition-all border border-gray-600/50 hover:border-gray-500/70 shadow-lg flex items-center justify-center text-2xl group"
          >
            <i className="fa-solid fa-share-nodes group-hover:scale-110 transition-transform"></i>
          </button>
          {card.related_uris?.edhrec && (
            <a 
              href={card.related_uris.edhrec} 
              target="_blank" 
              rel="noreferrer" 
              title="Ver en EDHREC"
              className="w-14 h-14 bg-emerald-900/30 hover:bg-emerald-800/50 text-emerald-500 hover:text-emerald-400 rounded-2xl transition-all border border-emerald-500/30 hover:border-emerald-400/60 shadow-[0_0_15px_rgba(16,185,129,0.15)] flex items-center justify-center text-2xl group"
            >
              <i className="fa-solid fa-crown group-hover:scale-110 transition-transform"></i>
            </a>
          )}
        </div>

        {/* Tags Section */}
        {isSaved && (
          <div className="mt-8 w-full max-w-[340px] bg-gray-900/40 rounded-xl p-4 border border-white/5 shadow-inner">
            <h3 className="text-gray-400 text-sm font-bold uppercase tracking-wider mb-3">Etiquetas</h3>
            
            <div className="flex flex-wrap gap-2 mb-3">
              {cardTags.map(tag => (
                <span key={tag} className="bg-amber-900/30 border border-amber-700/50 text-amber-500 px-3 py-1 rounded-full text-sm flex items-center shadow-sm">
                  {tag}
                  <button onClick={() => handleRemoveTag(tag)} className="ml-2 hover:text-amber-300 transition-colors">
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </span>
              ))}
              {cardTags.length === 0 && (
                <span className="text-gray-600 text-sm italic">Sin etiquetas</span>
              )}
            </div>
            
            <div className="relative group">
              <input 
                type="text" 
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                onKeyDown={handleAddTag}
                placeholder="Añadir etiqueta y pulsar Enter..."
                className="w-full bg-black/40 text-gray-200 text-sm rounded-lg py-2.5 px-4 border border-gray-700/60 focus:border-amber-500 outline-none transition-colors"
              />
              <i className="fa-solid fa-tag absolute right-3.5 top-3 text-gray-600 group-focus-within:text-amber-500 transition-colors text-xs"></i>
            </div>
          </div>
        )}

      </div>

      <div className="p-8 xl:w-[55%] flex flex-col relative bg-[#111318]/90">
        {(() => {
          const displayCard = localizedData || card
          const cName = displayCard.printed_name || displayCard.name
          const cType = displayCard.printed_type_line || displayCard.type_line
          const cText = displayCard.printed_text || displayCard.oracle_text
          const cFlavor = displayCard.printed_flavor_text || displayCard.flavor_text || card.flavor_text

          return (
            <>
              <div className="flex justify-between items-start mb-6 border-b border-gray-700/80 pb-6 relative">
                {fetchingLocal && (
                  <div className="absolute -top-4 -right-4 bg-amber-500/20 text-amber-500 text-xs px-3 py-1.5 rounded-bl-xl rounded-tr-3xl border-b border-l border-amber-500/30 flex items-center shadow-lg">
                    <i className="fa-solid fa-language fa-fade mr-2"></i> Traduciendo...
                  </div>
                )}
                <div>
                  <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-100 to-amber-500 mtg-font mb-2 leading-tight">
                    {cName}
                  </h2>
                  <p className="text-base text-gray-400 font-serif italic tracking-wide">{cType}</p>
                </div>
                {displayCard.mana_cost && (
                  <div className="flex items-center gap-1 bg-black/40 px-3 py-1.5 rounded-full border border-gray-700/50">
                    {formatManaCost(displayCard.mana_cost, symbology)}
                  </div>
                )}
              </div>
              
              <div className="flex-grow mb-8 overflow-y-auto pr-4 custom-scrollbar">
                {cText && (
                  <div className="bg-black/40 p-6 rounded-2xl border border-gray-700/50 shadow-inner mb-6 relative group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-amber-500/50 rounded-l-2xl group-hover:bg-amber-500 transition-colors"></div>
                    <div className="pl-2">
                      <div className="text-gray-300 whitespace-pre-line text-base leading-relaxed">{formatOracleText(cText, symbology)}</div>
                    </div>
                  </div>
                )}
                {cFlavor && (
                  <div className="text-gray-500 italic font-serif text-base leading-relaxed border-l-4 border-gray-700 pl-4 py-1">
                    {cFlavor}
                  </div>
                )}
              </div>
            </>
          )
        })()}
      </div>
    </div>

    <div className="bg-black/30 border-t border-gray-700/80 p-6 shadow-inner">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl mx-auto">
        <div className="text-center md:border-r border-gray-700/50">
          <p className="text-gray-500 text-[10px] uppercase font-bold tracking-wider mb-1">Set</p>
          <p className="uppercase text-white font-mono text-sm font-bold">{card.set}</p>
        </div>
        <div className="text-center md:border-r border-gray-700/50">
          <p className="text-gray-500 text-[10px] uppercase font-bold tracking-wider mb-1">Rareza</p>
          <p className="capitalize font-bold text-sm text-amber-500">{card.rarity}</p>
        </div>
        <div className="text-center md:border-r border-gray-700/50">
          <p className="text-gray-500 text-[10px] uppercase font-bold tracking-wider mb-1">{t('marketUsd')}</p>
          <p className="text-emerald-400 font-mono font-bold text-sm">${card.prices?.usd || '--'}</p>
        </div>
        <div className="text-center">
          <p className="text-gray-500 text-[10px] uppercase font-bold tracking-wider mb-1">{t('marketEur')}</p>
          <p className="text-blue-400 font-mono font-bold text-sm">€{card.prices?.eur || '--'}</p>
        </div>
      </div>
    </div>

    <div className="bg-black/20 border-t border-gray-700/80 p-6 shadow-inner">
      <h3 className="text-sm font-bold text-gray-400 flex items-center mb-4 uppercase tracking-wider justify-center">
        <i className="fa-solid fa-scale-balanced mr-2"></i> {t('legalities') || 'Formatos Legales'}
      </h3>
      <div className="flex flex-wrap justify-center gap-3 max-w-5xl mx-auto">
        {majorFormats.map(f => {
          const status = card.legalities?.[f] || 'not_legal'
          return (
            <div key={f} className={`flex flex-col items-center justify-center py-2 px-4 rounded-lg border ${getLegalityColor(status)} min-w-[100px]`}>
              <span className="text-[10px] uppercase font-bold tracking-wider mb-1 opacity-70">{formatLabels[f]}</span>
              <span className="text-xs font-bold uppercase">{status.replace('_', ' ')}</span>
            </div>
          )
        })}
      </div>
    </div>

    {(prints.length > 0 || edhrecSections.length > 0 || fetchingSimilar) && (
      <div className="border-t border-gray-700/80 p-3 bg-black/40 flex flex-wrap items-center justify-between gap-4 px-8">
        {edhrecModes.length > 1 ? (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs uppercase font-mono text-gray-400 mr-2 flex items-center font-bold">
              <i className="fa-solid fa-compass mr-1.5 text-amber-500"></i> Perspectiva EDHREC:
            </span>
            {edhrecModes.map((modeObj, idx) => (
              <button
                key={modeObj.mode}
                onClick={() => setSelectedModeIndex(idx)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center border shadow-sm ${
                  selectedModeIndex === idx 
                    ? 'bg-amber-500 text-black border-amber-400 font-extrabold scale-105 shadow-[0_0_15px_rgba(245,158,11,0.5)]' 
                    : 'bg-black/60 text-gray-400 border-gray-700 hover:text-white hover:border-gray-500'
                }`}
              >
                <i className={`fa-solid ${modeObj.icon} mr-1.5`}></i>
                {modeObj.label}
              </button>
            ))}
          </div>
        ) : <div />}
        <button 
          onClick={toggleAll}
          className="text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-white flex items-center transition-colors ml-auto"
        >
          <i className={`fa-solid ${allExpanded ? 'fa-compress' : 'fa-expand'} mr-2`}></i>
          {allExpanded ? 'Contraer todo' : 'Expandir todo'}
        </button>
      </div>
    )}

    <div className="p-8 border-t border-gray-700/80 bg-black/40 w-full min-w-0 overflow-hidden">
      <div 
        className="flex items-center justify-between cursor-pointer group"
        onClick={() => setPrintsCollapsed(!printsCollapsed)}
      >
        <h3 className={`text-xl font-bold flex items-center transition-colors ${printsCollapsed ? 'text-gray-500 group-hover:text-amber-500' : 'text-amber-500'}`}>
          <i className="fa-solid fa-layer-group mr-3"></i> {t('otherVersions')}
        </h3>
        <i className={`fa-solid fa-chevron-${printsCollapsed ? 'down' : 'up'} text-gray-500 group-hover:text-amber-500 transition-colors`}></i>
      </div>
      
      <div 
        className={`grid transition-all duration-500 ease-in-out ${printsCollapsed ? 'grid-rows-[0fr] opacity-0 pointer-events-none' : 'grid-rows-[1fr] opacity-100'}`}
      >
        <div className="overflow-hidden">
          <div className="mt-6">
            {fetchingPrints ? (
              <div className="flex justify-center p-6"><i className="fa-solid fa-spinner fa-spin text-2xl text-amber-500/50"></i></div>
            ) : prints.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-x-8 gap-y-16 justify-items-center w-full px-4 pt-4 pb-12">
                {prints.map(print => {
                  const smallImg = print.image_uris?.small || print.card_faces?.[0]?.image_uris?.small
                  const normalImg = print.image_uris?.normal || print.card_faces?.[0]?.image_uris?.normal || smallImg
                  const largeImg = print.image_uris?.large || print.card_faces?.[0]?.image_uris?.large || normalImg
                  return (
                    <div 
                      key={print.id}
                      onClick={() => setCard(print)}
                      onMouseEnter={() => handleMouseEnter(largeImg)}
                      onMouseLeave={handleMouseLeave}
                      role="button"
                      tabIndex={0}
                      className={`relative transition-all duration-300 rounded-[4.75%] overflow-visible border-[3px] group/card cursor-pointer ${print.id === card.id ? 'border-amber-500 shadow-[0_0_25px_rgba(245,158,11,0.6)] scale-105 z-10' : 'border-transparent opacity-80 hover:opacity-100 hover:scale-105 hover:shadow-xl'}`}
                    >
                      <img 
                        src={normalImg} 
                        alt={print.set_name}
                        className="w-[300px] aspect-[63/88] object-cover rounded-[4.75%]"
                      />
                      <button
                        onClick={(e) => handleSaveAnyCard(print, e)}
                        onMouseEnter={(e) => { e.stopPropagation(); handleMouseLeave(); }}
                        title={allSavedCardIds.has(print.id) ? "Quitar de Favoritos" : "Guardar en Favoritos"}
                        className={`absolute bottom-4 left-1/2 -translate-x-1/2 w-12 h-12 rounded-full text-white flex items-center justify-center text-xl opacity-0 group-hover/card:opacity-100 hover:scale-110 transition-all duration-300 transform translate-y-3 group-hover/card:translate-y-0 z-30 ${allSavedCardIds.has(print.id) ? 'bg-red-600/90 hover:bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.8)] border border-red-400/60' : 'bg-gray-600/90 hover:bg-gray-500 shadow-[0_0_20px_rgba(156,163,175,0.8)] border border-gray-400/60'}`}
                      >
                        <i className="fa-solid fa-heart"></i>
                      </button>
                      <div className="absolute -bottom-9 inset-x-0 bg-black/90 backdrop-blur-sm py-1.5 px-3 text-xs text-center font-mono text-gray-300 border border-white/10 uppercase rounded-md shadow-lg truncate">
                        {print.set}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-gray-500 text-sm italic p-4 text-center">No hay otras versiones disponibles.</p>
            )}
          </div>
        </div>
      </div>
    </div>

    {edhrecSections.map((section, idx) => {
      const isCollapsed = collapsedSections[section.title]
      const hoverColorClass = section.color.replace('text-', 'group-hover:text-')
      
      return (
        <div key={idx} className="p-8 border-t border-gray-700/80 bg-black/30 w-full min-w-0 overflow-hidden">
          <div 
            className="flex items-center justify-between cursor-pointer group"
            onClick={() => toggleSection(section.title)}
          >
            <h3 className={`text-xl font-bold flex items-center transition-colors ${isCollapsed ? `text-gray-500 ${hoverColorClass}` : section.color}`}>
              <i className={`fa-solid ${section.icon} mr-3`}></i> {section.title}
            </h3>
            <i className={`fa-solid fa-chevron-${isCollapsed ? 'down' : 'up'} text-gray-500 ${hoverColorClass} transition-colors`}></i>
          </div>
          
          <div 
            className={`grid transition-all duration-500 ease-in-out ${isCollapsed ? 'grid-rows-[0fr] opacity-0 pointer-events-none' : 'grid-rows-[1fr] opacity-100'}`}
          >
            <div className="overflow-hidden">
              <div className="mt-6">
                {section.isComboSection ? (
                  <div className="flex flex-col gap-6 px-4 pt-2 pb-12 max-w-6xl mx-auto w-full">
                    {section.combos.map((comboObj, cIdx) => {
                      const comboCards = comboObj.resolvedCards || (comboObj.cardviews || []).map(cv => ({ name: cv.name, id: cv.id || cv.name }))
                      
                      return (
                        <div key={cIdx} className="bg-black/60 border border-fuchsia-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden group/combo hover:border-fuchsia-500/60 transition-all">
                          <div className="absolute top-0 left-0 w-1.5 h-full bg-fuchsia-500/60 group-hover/combo:bg-fuchsia-400 transition-colors"></div>
                          
                          <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-800/80 pl-3">
                            <h4 className="text-lg font-bold text-white flex items-center gap-2">
                              <i className="fa-solid fa-bolt-lightning text-fuchsia-400"></i>
                              <span>{comboObj.header || comboCards.map(c => c.name).join(' + ')}</span>
                            </h4>
                            <div className="flex items-center gap-2 flex-wrap">
                              {comboObj.tag && (
                                <a
                                  href={comboObj.tag.startsWith('http') ? comboObj.tag : `https://edhrec.com/combos/${comboObj.tag}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="bg-fuchsia-950/50 hover:bg-fuchsia-900/80 text-fuchsia-300 border border-fuchsia-700/50 px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-2 transition-all shadow-md hover:scale-105"
                                >
                                  <span>Ver en EDHREC / Spellbook</span>
                                  <i className="fa-solid fa-arrow-up-right-from-square text-[11px]"></i>
                                </a>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-center gap-4 py-4 pl-3 overflow-x-auto">
                            {comboCards.map((c, idxCard) => {
                              const smallImg = c.image_uris?.small || c.card_faces?.[0]?.image_uris?.small
                              const normalImg = c.image_uris?.normal || c.card_faces?.[0]?.image_uris?.normal || smallImg
                              const largeImgUrl = c.image_uris?.large || c.card_faces?.[0]?.image_uris?.large || normalImg
                              const hasImage = Boolean(normalImg)

                              return (
                                <Fragment key={c.id || idxCard}>
                                  {idxCard > 0 && (
                                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-fuchsia-500/20 border border-fuchsia-500/40 text-fuchsia-400 font-bold text-xl shrink-0 shadow-md">
                                      +
                                    </div>
                                  )}
                                  <div 
                                    onClick={() => hasImage && setCard(c)}
                                    onMouseEnter={() => hasImage && handleMouseEnter(largeImgUrl)}
                                    onMouseLeave={handleMouseLeave}
                                    role="button"
                                    tabIndex={0}
                                    className="relative transition-all duration-300 rounded-[4.75%] overflow-visible border-[3px] border-transparent opacity-90 hover:opacity-100 hover:scale-105 z-0 hover:z-10 bg-gray-900 block shrink-0 cursor-pointer group/card"
                                  >
                                    {hasImage ? (
                                      <img 
                                        src={normalImg} 
                                        alt={c.name}
                                        className="w-[220px] aspect-[63/88] object-cover rounded-[4.75%]"
                                      />
                                    ) : (
                                      <div className="w-[220px] aspect-[63/88] flex flex-col items-center justify-center p-4 text-center text-xs text-gray-400 gap-2 border border-gray-800 rounded-[4.75%]">
                                        <i className="fa-solid fa-spinner fa-spin text-fuchsia-500"></i>
                                        <span className="font-mono">{c.name}</span>
                                      </div>
                                    )}
                                    {hasImage && (
                                      <button
                                        onClick={(e) => handleSaveAnyCard(c, e)}
                                        onMouseEnter={(e) => { e.stopPropagation(); handleMouseLeave(); }}
                                        title={allSavedCardIds.has(c.id) ? "Quitar de Favoritos" : "Guardar en Favoritos"}
                                        className={`absolute bottom-3 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full text-white flex items-center justify-center text-lg opacity-0 group-hover/card:opacity-100 hover:scale-110 transition-all duration-300 transform translate-y-3 group-hover/card:translate-y-0 z-30 ${allSavedCardIds.has(c.id) ? 'bg-red-600/90 hover:bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)] border border-red-400/60' : 'bg-gray-600/90 hover:bg-gray-500 shadow-[0_0_15px_rgba(156,163,175,0.8)] border border-gray-400/60'}`}
                                      >
                                        <i className="fa-solid fa-heart"></i>
                                      </button>
                                    )}
                                    <div className="absolute -bottom-7 inset-x-0 bg-black/90 backdrop-blur-sm py-1 px-2 text-[11px] text-center font-mono text-gray-300 border border-white/10 truncate rounded shadow-md">
                                      {c.name}
                                    </div>
                                  </div>
                                </Fragment>
                              )
                            })}
                          </div>

                          {(comboObj.results || comboObj.prerequisites || comboObj.description || comboObj.text || comboObj.label) && (
                            <div className="mt-6 pt-4 border-t border-gray-800/80 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono pl-3">
                              {(comboObj.prerequisites || comboObj.description || comboObj.label) && (
                                <div className="bg-fuchsia-950/25 p-4 rounded-xl border border-fuchsia-800/40 text-gray-300 flex flex-col justify-center">
                                  <span className="text-fuchsia-400 font-bold uppercase flex items-center mb-2 text-xs tracking-wider">
                                    <i className="fa-solid fa-clipboard-check mr-2 text-sm"></i> Prerrequisitos / Pasos del Combo:
                                  </span>
                                  <p className="whitespace-pre-line text-gray-200 leading-relaxed font-sans text-sm">
                                    {Array.isArray(comboObj.prerequisites) ? comboObj.prerequisites.join(' • ') : (comboObj.prerequisites || comboObj.description || comboObj.label)}
                                  </p>
                                </div>
                              )}
                              {(comboObj.results || comboObj.text) && (
                                <div className="bg-emerald-950/25 p-4 rounded-xl border border-emerald-800/40 text-gray-300 flex flex-col justify-center">
                                  <span className="text-emerald-400 font-bold uppercase flex items-center mb-2 text-xs tracking-wider">
                                    <i className="fa-solid fa-wand-magic-sparkles mr-2 text-sm"></i> Lo que produce (Resultados infinitos/sinergia):
                                  </span>
                                  <p className="whitespace-pre-line text-emerald-200 leading-relaxed font-sans text-sm font-semibold">
                                    {Array.isArray(comboObj.results) ? comboObj.results.join(' • ') : (comboObj.results || comboObj.text)}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : fetchingSimilar && (!section.data || section.data.length === 0) ? (
                  <div className="flex justify-center p-6"><i className={`fa-solid fa-spinner fa-spin text-2xl opacity-50 ${section.color}`}></i></div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-x-8 gap-y-16 justify-items-center w-full px-4 pt-4 pb-12">
                    {section.data.map(c => {
                      const smallImg = c.image_uris?.small || c.card_faces?.[0]?.image_uris?.small
                      const normalImg = c.image_uris?.normal || c.card_faces?.[0]?.image_uris?.normal || smallImg
                      const largeImgUrl = c.image_uris?.large || c.card_faces?.[0]?.image_uris?.large || normalImg
                      return (
                        <div
                          key={c.id || c.name}
                          onMouseEnter={() => handleMouseEnter(largeImgUrl)}
                          onMouseLeave={handleMouseLeave}
                          className={`relative transition-all duration-300 rounded-[4.75%] overflow-visible border-[3px] border-transparent opacity-80 hover:opacity-100 hover:scale-105 z-0 hover:z-10 bg-gray-900 block group/card`}
                        >
                          <a 
                            href={`/card/${formatCardSlug(c)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={c.name}
                            className="block"
                          >
                            {normalImg ? (
                              <img 
                                src={normalImg} 
                                alt={c.name}
                                className="w-[300px] aspect-[63/88] object-cover rounded-[4.75%]"
                              />
                            ) : (
                              <div className="w-[300px] aspect-[63/88] flex items-center justify-center p-4 text-center text-sm text-gray-500">
                                Sin Imagen
                              </div>
                            )}
                            <div className="absolute -bottom-9 inset-x-0 bg-black/90 backdrop-blur-sm py-1.5 px-3 text-xs text-center font-mono text-gray-300 border border-white/10 truncate rounded-md shadow-lg">
                              {c.name}
                            </div>
                          </a>
                          <button
                            onClick={(e) => handleSaveAnyCard(c, e)}
                            onMouseEnter={(e) => { e.stopPropagation(); handleMouseLeave(); }}
                            title={allSavedCardIds.has(c.id) ? "Quitar de Favoritos" : "Guardar en Favoritos"}
                            className={`absolute bottom-4 left-1/2 -translate-x-1/2 w-12 h-12 rounded-full text-white flex items-center justify-center text-xl opacity-0 group-hover/card:opacity-100 hover:scale-110 transition-all duration-300 transform translate-y-3 group-hover/card:translate-y-0 z-30 ${allSavedCardIds.has(c.id) ? 'bg-red-600/90 hover:bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.8)] border border-red-400/60' : 'bg-gray-600/90 hover:bg-gray-500 shadow-[0_0_20px_rgba(156,163,175,0.8)] border border-gray-400/60'}`}
                          >
                            <i className="fa-solid fa-heart"></i>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )
    })}

    {fetchingSimilar && edhrecSections.length > 0 && (
      <div className="p-4 border-t border-gray-700/80 bg-black/50 w-full flex items-center justify-center gap-3 text-xs uppercase tracking-wider text-amber-400 font-mono font-bold">
        <i className="fa-solid fa-circle-notch fa-spin"></i>
        <span>Descargando cartas y secciones restantes en segundo plano...</span>
      </div>
    )}

    {fetchingSimilar && edhrecSections.length === 0 && (
      <div className="p-16 border-t border-gray-700/80 bg-black/30 w-full flex flex-col items-center justify-center animate-fade-in-up">
        <div className="relative mb-4">
          <div className="absolute inset-0 bg-amber-500 blur-[20px] opacity-40 rounded-full animate-pulse"></div>
          <i className="fa-solid fa-circle-notch fa-spin text-4xl text-amber-500 drop-shadow-lg relative z-10"></i>
        </div>
        <p className="text-gray-400 font-bold uppercase tracking-widest text-sm animate-pulse">Analizando Sinergias de EDHREC...</p>
      </div>
    )}
  </div>
)
}
