export default function Loader({ message = "Cargando..." }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 w-full h-full min-h-[300px] glass-panel rounded-2xl">
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-amber-500 blur-[40px] opacity-30 rounded-full animate-pulse"></div>
        <div className="relative z-10 w-24 h-24 rounded-full border-4 border-amber-500/20 border-t-amber-500 animate-spin flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.3)]">
          <i className="fa-solid fa-hat-wizard text-3xl text-amber-500 animate-pulse"></i>
        </div>
      </div>
      <p className="text-xl text-white mtg-font tracking-widest font-bold text-center drop-shadow-md">
        {message}
      </p>
      <div className="w-48 h-1.5 bg-gray-800 rounded-full mt-6 overflow-hidden shadow-inner">
        <div className="h-full bg-gradient-to-r from-amber-400 to-orange-600 rounded-full animate-[slide_1.5s_ease-in-out_infinite_alternate] w-1/3 relative shadow-[0_0_10px_rgba(245,158,11,0.8)]"></div>
      </div>
    </div>
  )
}
