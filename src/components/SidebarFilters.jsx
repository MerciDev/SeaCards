import { useState, useEffect } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { useSymbology } from '../contexts/SymbologyContext'
import { supabase } from '../lib/supabase'

export default function SidebarFilters({ 
  onActionClick, 
  actionIcon = 'fa-bolt', 
  actionText = 'Ejecutar', 
  actionLoading = false,
  onFilterChange,
  showAction = true,
  bufferCount = null,
  hideActionOnMobile = false
}) {
  const { t } = useLanguage()
  const symbology = useSymbology()
  
  const [query, setQuery] = useState('')
  const [scopes, setScopes] = useState({ name: true, type: true, text: true })
  const [imgLang, setImgLang] = useState('en')
  const [isCommander, setIsCommander] = useState(false)
  const [colors, setColors] = useState([])
  const [types, setTypes] = useState([])
  const [rarities, setRarities] = useState([])
  const [formatFilters, setFormatFilters] = useState({}) // { format: 'legal' | 'not_legal' }
  const [cmcMin, setCmcMin] = useState('')
  const [cmcMax, setCmcMax] = useState('')
  const [tags, setTags] = useState([])
  const [availableTags, setAvailableTags] = useState([])

  const [sets, setSets] = useState([])
  const [selectedSet, setSelectedSet] = useState('')
  const [setSearch, setSetSearch] = useState('')
  const [isSetDropdownOpen, setIsSetDropdownOpen] = useState(false)
  
  const [isCollapsed, setIsCollapsed] = useState(window.innerWidth < 1024)

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsCollapsed(true)
      } else {
        setIsCollapsed(false)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    const fetchUserTags = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      const { data, error } = await supabase
        .from('liked_cards')
        .select('tags')
        .eq('user_id', user.id)
        .not('tags', 'is', null)
        
      if (data && !error) {
        const uniqueTags = new Set()
        data.forEach(row => {
          if (Array.isArray(row.tags)) {
            row.tags.forEach(t => uniqueTags.add(t))
          }
        })
        setAvailableTags(Array.from(uniqueTags).sort())
      }
    }
    fetchUserTags()
  }, [])



  useEffect(() => {
    const fetchSets = async () => {
      try {
        const res = await fetch('https://api.scryfall.com/sets')
        const data = await res.json()
        const allowedTypes = ['core', 'expansion', 'masters', 'draft_innovation', 'commander', 'starter']
        const validSets = data.data.filter(s => allowedTypes.includes(s.set_type))
        setSets(validSets)
      } catch (e) {
        console.error("Error fetching sets", e)
      }
    }
    fetchSets()
  }, [])

  useEffect(() => {
    if (onFilterChange) {
      onFilterChange({
        query, scopes, imgLang, isCommander, colors, types, rarities, formatFilters, cmcMin, cmcMax, set: selectedSet, tags
      })
    }
  }, [query, scopes, imgLang, isCommander, colors, types, rarities, formatFilters, cmcMin, cmcMax, selectedSet, tags])

  const toggleArrayItem = (setter, item) => {
    setter(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item])
  }

  const resetFilters = () => {
    setQuery('')
    setScopes({ name: true, type: true, text: true })
    setImgLang('en')
    setIsCommander(false)
    setColors([])
    setTypes([])
    setRarities([])
    setFormatFilters({})
    setCmcMin('')
    setCmcMax('')
    setSelectedSet('')
    setTags([])
  }

  const renderActionButton = (floating = false) => (
    <div className={`${hideActionOnMobile ? 'hidden lg:block' : ''} ${floating ? "fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-[360px] animate-fade-in-up" : "mb-6 w-full"}`}>
      <button 
        onClick={onActionClick}
        disabled={actionLoading}
        className={`w-full bg-gradient-to-b from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 flex items-center justify-center group border border-orange-400/50 text-lg disabled:opacity-50 ${floating ? 'shadow-[0_15px_40px_rgba(245,158,11,0.7)] scale-105 hover:scale-110' : 'shadow-[0_0_20px_rgba(245,158,11,0.3)]'}`}
      >
        <i className={`fa-solid ${actionLoading ? 'fa-spinner fa-spin' : actionIcon} mr-3`}></i>
        <span className="tracking-wide">{actionLoading ? t('processing') : actionText}</span>
      </button>
      
      {bufferCount !== null && !floating && (
        <div className="flex gap-1.5 justify-center mt-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className={`w-2 h-2 rounded-full transition-all duration-500 ${i < bufferCount ? 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]' : 'bg-gray-700'}`}></div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <>
    {/* Backdrop for mobile drawer */}
    {!isCollapsed && (
      <div 
        className="lg:hidden fixed top-[4.2rem] inset-x-0 bottom-0 bg-black/70 backdrop-blur-sm z-40 transition-opacity duration-300" 
        onClick={() => setIsCollapsed(true)}
      />
    )}
    
    {/* Mobile FAB to open sidebar (only visible when collapsed) */}
    {isCollapsed && (
      <button 
        onClick={() => setIsCollapsed(false)} 
        className="lg:hidden fixed top-[4.2rem] left-2 z-40 w-12 h-12 rounded-full bg-gray-900 border border-gray-600 shadow-[0_5px_15px_rgba(0,0,0,0.8)] flex items-center justify-center text-amber-500 hover:text-white transition-colors"
        title="Filtros de Búsqueda"
      >
        <i className="fa-solid fa-magnifying-glass text-lg"></i>
      </button>
    )}

    <aside className={`shrink-0 transition-transform duration-300 overflow-y-auto overflow-x-hidden flex flex-col z-50 glass-panel ${isCollapsed ? 'fixed lg:static top-[4.2rem] left-0 w-[85%] sm:w-[360px] h-[calc(100dvh-4.2rem)] lg:w-[80px] lg:h-[calc(100vh-100px)] p-6 lg:p-4 rounded-r-3xl lg:rounded-2xl -translate-x-full lg:translate-x-0' : 'fixed lg:static top-[4.2rem] left-0 w-[85%] sm:w-[360px] h-[calc(100dvh-4.2rem)] lg:h-[calc(100vh-100px)] lg:w-[320px] xl:w-[360px] p-6 rounded-r-3xl lg:rounded-2xl shadow-[15px_0_50px_rgba(0,0,0,0.8)] lg:shadow-none translate-x-0'}`}>
      
      {showAction && !isCollapsed && renderActionButton(false)}

      <div className={`flex items-center ${isCollapsed ? 'justify-center w-full mb-0 lg:mb-6' : 'justify-between w-full mb-6 border-b border-gray-700/60 pb-4'}`}>
        {!isCollapsed && (
          <h2 className="text-xl font-bold text-amber-500 flex items-center">
            <i className="fa-solid fa-sliders mr-3"></i> {t('searchParams')}
          </h2>
        )}
        <div className={`flex gap-2 ${isCollapsed ? 'flex-col items-center w-full h-full' : ''}`}>
          {!isCollapsed && (
            <button onClick={resetFilters} className="text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition-colors border border-gray-700 flex items-center" title={t('reset')}>
              <i className="fa-solid fa-rotate-right mr-1"></i>
            </button>
          )}
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)} 
            className={`text-sm text-gray-400 hover:text-white hover:bg-gray-700 transition-colors flex items-center justify-center shrink-0 ${isCollapsed ? 'hidden lg:flex lg:w-10 lg:h-10 text-xl lg:text-sm text-amber-500 lg:rounded-lg' : 'w-10 h-10 bg-gray-800 border-gray-700 rounded-lg ml-auto'}`}
            title={isCollapsed ? "Filtros de Búsqueda" : "Contraer"}
          >
            {isCollapsed ? (
              <i className="fa-solid fa-magnifying-glass"></i>
            ) : (
              <>
                <i className="fa-solid fa-xmark lg:hidden"></i>
                <i className="fa-solid fa-chevron-left hidden lg:inline-block"></i>
              </>
            )}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="flex flex-col w-full animate-fade-in-up">

      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('searchString')}</label>
        </div>
        <div className="relative group mb-2.5">
          <input 
            type="text" 
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full bg-gray-900/80 text-white rounded-xl p-3 pl-10 border border-gray-700 focus:border-amber-500 outline-none text-sm placeholder-gray-600 shadow-inner group-hover:border-gray-500"
          />
          <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-3.5 text-gray-500 group-hover:text-amber-500 transition-colors"></i>
        </div>
        <div className="flex gap-2">
          {[
            { id: 'name', label: t('scopeName') },
            { id: 'type', label: t('scopeType') },
            { id: 'text', label: t('scopeText') }
          ].map(scope => (
            <button 
              key={scope.id}
              onClick={() => setScopes(s => ({ ...s, [scope.id]: !s[scope.id] }))}
              className={`flex-1 py-1.5 px-1 rounded-lg text-[10px] sm:text-xs font-medium border transition-all ${scopes[scope.id] ? 'border-amber-500 bg-amber-500/10 text-amber-400' : 'bg-gray-900 border-gray-700 text-gray-400 hover:bg-gray-800'}`}
            >
              {scope.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6 bg-black/20 p-4 rounded-xl border border-gray-800 shadow-inner">
        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5">{t('imgLang')}</label>
        <select 
          value={imgLang} 
          onChange={e => setImgLang(e.target.value)}
          className="w-full bg-gray-900 text-gray-200 rounded-lg p-2 text-sm border border-gray-700 focus:border-amber-500 outline-none"
        >
          <option value="en">English</option>
          <option value="es">Español</option>
          <option value="ja">日本語</option>
          <option value="ph">Phyrexian</option>
        </select>
      </div>

      <div className="mb-6">
        <button 
          onClick={() => setIsCommander(!isCommander)}
          className={`w-full border rounded-xl p-3.5 transition-all flex justify-between items-center ${isCommander ? 'border-amber-500 bg-amber-500/10' : 'bg-gray-900/60 border-gray-700 hover:border-amber-500/50'}`}
        >
          <span className={`text-sm font-bold ${isCommander ? 'text-amber-400' : 'text-gray-400'}`}>{t('commander')}</span>
          <i className={`fa-solid fa-crown text-lg drop-shadow-md ${isCommander ? 'text-amber-500' : 'text-gray-600'}`}></i>
        </button>
      </div>

      <div className="mb-6">
        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Mis Etiquetas</label>
        {availableTags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {availableTags.map(tag => {
              const isSelected = tags.includes(tag)
              return (
                <button
                  key={tag}
                  onClick={() => toggleArrayItem(setTags, tag)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${isSelected ? 'bg-amber-600/30 text-amber-400 border-amber-500/50 shadow-inner' : 'bg-gray-800/80 text-gray-400 border-gray-700/50 hover:bg-gray-700'}`}
                >
                  <i className={`fa-solid fa-tag mr-1.5 ${isSelected ? 'text-amber-500' : 'text-gray-500'}`}></i> {tag}
                </button>
              )
            })}
          </div>
        ) : (
          <p className="text-gray-600 text-xs italic bg-black/20 p-3 rounded-lg border border-gray-800">
            Aún no has creado ninguna etiqueta. Añade etiquetas a tus cartas favoritas desde la vista de detalle.
          </p>
        )}
      </div>

      <div className="mb-6">
        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">{t('colorId')}</label>
        <div className="flex gap-2 justify-between">
          {['W', 'U', 'B', 'R', 'G', 'C'].map(c => {
            const sym = `{${c}}`
            const svg = symbology[sym]
            const isSelected = colors.includes(c.toLowerCase())
            return (
              <button 
                key={c}
                onClick={() => toggleArrayItem(setColors, c.toLowerCase())}
                className={`w-10 h-10 bg-gray-900 border rounded-full flex items-center justify-center transition-all ${isSelected ? 'border-amber-500 bg-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.3)]' : 'border-gray-700 hover:border-gray-400'}`}
              >
                {svg ? <img src={svg} alt={c} className="w-6 h-6 drop-shadow-lg" /> : <span className="text-gray-400 font-bold">{c}</span>}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">{t('mainType')}</label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { id: 'creature', label: t('creature'), color: 'amber' },
            { id: 'instant', label: t('instant'), color: 'blue' },
            { id: 'sorcery', label: t('sorcery'), color: 'red' },
            { id: 'artifact', label: t('artifact'), color: 'gray' },
            { id: 'enchantment', label: t('enchantment'), color: 'emerald' },
            { id: 'planeswalker', label: t('planeswalker'), color: 'purple' }
          ].map(t => {
            const isSelected = types.includes(t.id)
            const colorClasses = {
              amber: isSelected ? 'border-amber-500 bg-amber-500/10 text-amber-400' : 'bg-gray-900 border-gray-700 text-gray-400 hover:bg-gray-800',
              blue: isSelected ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'bg-gray-900 border-gray-700 text-gray-400 hover:bg-gray-800',
              red: isSelected ? 'border-red-500 bg-red-500/10 text-red-400' : 'bg-gray-900 border-gray-700 text-gray-400 hover:bg-gray-800',
              gray: isSelected ? 'border-gray-300 bg-gray-300/10 text-gray-200' : 'bg-gray-900 border-gray-700 text-gray-400 hover:bg-gray-800',
              emerald: isSelected ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : 'bg-gray-900 border-gray-700 text-gray-400 hover:bg-gray-800',
              purple: isSelected ? 'border-purple-500 bg-purple-500/10 text-purple-400' : 'bg-gray-900 border-gray-700 text-gray-400 hover:bg-gray-800',
            }
            return (
              <button 
                key={t.id}
                onClick={() => toggleArrayItem(setTypes, t.id)}
                className={`py-2 px-1 rounded-lg text-sm font-medium border transition-all ${colorClasses[t.color]}`}
              >
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mb-6 relative">
        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">{t('setFilter')}</label>
        <div className="relative">
          <button 
            onClick={() => setIsSetDropdownOpen(!isSetDropdownOpen)}
            className="w-full bg-gray-900/80 text-white rounded-xl p-3 border border-gray-700 flex justify-between items-center hover:border-amber-500 transition-colors shadow-inner"
          >
            <span className="truncate text-sm">
              {selectedSet 
                ? sets.find(s => s.code === selectedSet)?.name + ` (${selectedSet.toUpperCase()})` 
                : t('allSets')}
            </span>
            <i className={`fa-solid fa-chevron-down text-gray-500 transition-transform ${isSetDropdownOpen ? 'rotate-180' : ''}`}></i>
          </button>
          
          {isSetDropdownOpen && (
            <div className="absolute z-50 w-full mt-2 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden animate-fade-in-down origin-top">
              <div className="p-2 border-b border-gray-800">
                <div className="relative group">
                  <i className="fa-solid fa-search absolute left-3 top-3 text-gray-500 group-focus-within:text-amber-500"></i>
                  <input 
                    type="text" 
                    placeholder={t('searchSet')}
                    className="w-full bg-gray-800 text-white text-sm rounded-lg py-2 pl-9 pr-3 outline-none focus:border-amber-500 border border-transparent"
                    value={setSearch}
                    onChange={(e) => setSetSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="max-h-60 overflow-y-auto custom-scrollbar p-2">
                <button 
                  onClick={() => { setSelectedSet(''); setIsSetDropdownOpen(false) }}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors text-sm ${!selectedSet ? 'bg-amber-500/20 text-amber-500' : 'text-gray-300 hover:bg-gray-800'}`}
                >
                  {t('allSets')}
                </button>
                {sets
                  .filter(s => s.name.toLowerCase().includes(setSearch.toLowerCase()) || s.code.toLowerCase().includes(setSearch.toLowerCase()))
                  .map(s => (
                  <button 
                    key={s.id}
                    onClick={() => { setSelectedSet(s.code); setIsSetDropdownOpen(false); setSetSearch('') }}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors text-sm truncate mt-1 ${selectedSet === s.code ? 'bg-amber-500/20 text-amber-500' : 'text-gray-300 hover:bg-gray-800'}`}
                  >
                    {s.name} <span className="text-gray-500 text-[10px] ml-1">({s.code.toUpperCase()})</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5 mb-6">
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">{t('rarity')}</label>
          <div className="flex flex-col gap-2">
            {[
              { id: 'common', label: t('common'), color: 'gray' },
              { id: 'uncommon', label: t('uncommon'), color: 'blue' },
              { id: 'rare', label: t('rare'), color: 'amber' },
              { id: 'mythic', label: t('mythic'), color: 'orange' }
            ].map(r => {
              const isSelected = rarities.includes(r.id)
              const colorClasses = {
                gray: isSelected ? 'border-gray-400 bg-gray-400/20 text-white' : 'bg-gray-900 border-gray-700 text-gray-400 hover:bg-gray-800',
                blue: isSelected ? 'border-blue-400 bg-blue-400/20 text-blue-300' : 'bg-gray-900 border-gray-700 text-gray-400 hover:bg-gray-800',
                amber: isSelected ? 'border-amber-400 bg-amber-400/20 text-amber-300' : 'bg-gray-900 border-gray-700 text-gray-400 hover:bg-gray-800',
                orange: isSelected ? 'border-orange-500 bg-orange-500/20 text-orange-400' : 'bg-gray-900 border-gray-700 text-gray-400 hover:bg-gray-800',
              }
              return (
                <button 
                  key={r.id}
                  onClick={() => toggleArrayItem(setRarities, r.id)}
                  className={`py-1.5 px-2 rounded-lg text-xs border transition-all ${colorClasses[r.color]}`}
                >
                  {r.label}
                </button>
              )
            })}
          </div>
        </div>
        
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{t('manaCmc')}</label>
          <div className="flex gap-2 items-center">
            <input 
              type="number" 
              value={cmcMin} 
              onChange={e => setCmcMin(e.target.value)} 
              placeholder={t('min')} min="0" 
              className="w-1/2 bg-gray-900 rounded-lg p-2 text-center text-sm border border-gray-700 outline-none focus:border-amber-500 text-white placeholder-gray-600"
            />
            <span className="text-gray-500">-</span>
            <input 
              type="number" 
              value={cmcMax} 
              onChange={e => setCmcMax(e.target.value)} 
              placeholder={t('max')} min="0" 
              className="w-1/2 bg-gray-900 rounded-lg p-2 text-center text-sm border border-gray-700 outline-none focus:border-amber-500 text-white placeholder-gray-600"
            />
          </div>
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{t('format')}</label>
        <div className="flex flex-wrap gap-2">
          {['standard', 'pioneer', 'modern', 'legacy', 'vintage', 'commander', 'pauper'].map(f => {
                const state = formatFilters[f]
                return (
                  <button 
                    key={f}
                    onClick={() => {
                      setFormatFilters(prev => {
                        const current = prev[f]
                        if (!current) return { ...prev, [f]: 'legal' }
                        if (current === 'legal') return { ...prev, [f]: 'not_legal' }
                        const next = { ...prev }
                        delete next[f]
                        return next
                      })
                    }}
                    className={`py-1.5 px-2.5 rounded-md text-[10px] sm:text-xs uppercase font-bold border transition-all flex items-center justify-center gap-1.5 flex-1 min-w-[30%] ${
                      !state ? 'bg-gray-900 border-gray-700 text-gray-500 hover:bg-gray-800' :
                      state === 'legal' ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.3)]' :
                      'border-red-500 bg-red-500/20 text-red-400 shadow-[0_0_8px_rgba(239,68,68,0.3)]'
                    }`}
                  >
                    <span className="truncate">{f}</span>
                    {state === 'legal' && <i className="fa-solid fa-check text-[10px] shrink-0"></i>}
                    {state === 'not_legal' && <i className="fa-solid fa-ban text-[10px] shrink-0"></i>}
                  </button>
                )
              })}
        </div>
      </div>
      </div>
      )}
    </aside>
    {showAction && isCollapsed && renderActionButton(true)}
    </>
  )
}
