import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import CardDetail from '../components/CardDetail'
import Loader from '../components/Loader'
import { useLanguage } from '../contexts/LanguageContext'

export default function CardView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useLanguage()
  const [card, setCard] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchCard = async () => {
      setLoading(true)
      try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
        let endpoint = `https://api.scryfall.com/cards/${id}`
        
        if (!isUuid) {
          const queryName = id.replace(/-/g, ' ')
          endpoint = `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(queryName)}`
        }

        let res = await fetch(endpoint)
        if (!res.ok && !isUuid) {
          res = await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(id.replace(/-/g, ' '))}`)
        }

        if (res.ok) {
          const data = await res.json()
          setCard(data)
          if (data && data.name) {
            const slug = data.name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-')
            if (slug && id !== slug) {
              window.history.replaceState(null, '', `/card/${slug}`)
            }
          }
        } else {
          setCard(null)
        }
      } catch (e) {
        console.error(e)
        setCard(null)
      } finally {
        setLoading(false)
      }
    }
    
    if (id) {
      fetchCard()
    }
  }, [id])

  return (
    <div className="min-h-screen flex flex-col bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] bg-[#0f1115]">
      <Header />
      
      <div className="w-full px-4 lg:px-8 xl:px-12 2xl:px-16 mx-auto flex-grow flex flex-col items-center mt-4 max-w-[2000px]">
        <main className="w-full max-w-[1400px] flex-grow flex flex-col gap-6 min-w-0">
          {loading ? (
            <Loader message={t('scrying')} />
          ) : !card ? (
            <div className="glass-panel rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[500px]">
               <i className="fa-solid fa-triangle-exclamation text-6xl text-red-500/80 mb-6 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]"></i>
               <h2 className="text-2xl text-white font-bold mb-2">{t('errorEmpty') || 'Carta no encontrada'}</h2>
            </div>
          ) : (
            <CardDetail baseCard={card} />
          )}
        </main>
      </div>
    </div>
  )
}
