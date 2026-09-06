import React, { createContext, useContext, useState, useEffect } from 'react';

const SymbologyContext = createContext();

export function useSymbology() {
  return useContext(SymbologyContext);
}

export function SymbologyProvider({ children }) {
  const [symbology, setSymbology] = useState({});

  useEffect(() => {
    const fetchSymbology = async () => {
      try {
        const res = await fetch('https://api.scryfall.com/symbology');
        if (res.ok) {
          const data = await res.json();
          const symMap = {};
          data.data.forEach(sym => { symMap[sym.symbol] = sym.svg_uri });
          setSymbology(symMap);
        }
      } catch (e) {
        console.error("Error fetching symbology", e);
      }
    };
    fetchSymbology();
  }, []);

  return (
    <SymbologyContext.Provider value={symbology}>
      {children}
    </SymbologyContext.Provider>
  );
}
