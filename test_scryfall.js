const fetch = require('node-fetch');
(async () => {
  const names = ["Mister Fantastic", "The Fantastic Four"];
  const identifiers = names.map(name => ({ name }));
  const scryRes = await fetch('https://api.scryfall.com/cards/collection', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ identifiers })
  });
  const data = await scryRes.json();
  console.log(JSON.stringify(data, null, 2));
})();
