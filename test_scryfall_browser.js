import fetch from 'node-fetch';

(async () => {
  const scryRes = await fetch('https://api.scryfall.com/cards/collection', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' },
     body: JSON.stringify({ identifiers: [{ name: "Human Torch" }] })
  });
  const data = await scryRes.json();
  console.log(data);
})();
