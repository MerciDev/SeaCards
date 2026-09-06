import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Home from './pages/Home'
import SavedCards from './pages/SavedCards'
import Search from './pages/Search'
import CardView from './pages/CardView'
import Decks from './pages/Decks'
import DeckView from './pages/DeckView'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#0f1115] text-white">Cargando...</div>
  }

  return (
    <Routes>
      <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
      <Route path="/" element={session ? <Home /> : <Navigate to="/login" />} />
      <Route path="/search" element={session ? <Search /> : <Navigate to="/login" />} />
      <Route path="/saved" element={session ? <SavedCards /> : <Navigate to="/login" />} />
      <Route path="/decks" element={session ? <Decks /> : <Navigate to="/login" />} />
      <Route path="/decks/:id" element={<DeckView />} />
      <Route path="/card/:id" element={session ? <CardView /> : <Navigate to="/login" />} />
    </Routes>
  )
}

export default App
