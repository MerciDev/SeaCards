(async () => {
  const slug = "human-torch";
  const res = await fetch(`https://json.edhrec.com/pages/cards/${slug}.json`);
  const data = await res.json();
  
  const listsFromEdhrec = [];
  if (data.similar?.length > 0) {
    listsFromEdhrec.push({ header: 'Cartas Similares', names: data.similar.slice(0, 12) });
  }
  const rawLists = data.container?.json_dict?.cardlists || [];
  for (const list of rawLists) {
    if (list.cardviews?.length > 0) {
       listsFromEdhrec.push({
         header: list.header,
         names: list.cardviews.slice(0, 12).map(c => c.name)
       });
    }
  }

  const allNames = new Set();
  listsFromEdhrec.forEach(l => l.names.forEach(n => allNames.add(n)));
  const uniqueNames = Array.from(allNames);
  console.log("Unique names count:", uniqueNames.length);

  const scryfallCards = {};
  for (let i = 0; i < uniqueNames.length; i += 75) {
    const chunk = uniqueNames.slice(i, i + 75).map(name => ({ name }));
    const scryRes = await fetch('https://api.scryfall.com/cards/collection', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ identifiers: chunk })
    });
    if (!scryRes.ok) {
       console.log("Scryfall ERROR:", scryRes.status, await scryRes.text());
    } else {
       const chunkData = await scryRes.json();
       chunkData.data.forEach(c => {
         scryfallCards[c.name] = c;
       });
       if (chunkData.not_found && chunkData.not_found.length > 0) {
           console.log("Not found in Scryfall:", chunkData.not_found);
       }
    }
  }

  const finalSections = listsFromEdhrec.map(l => {
     return {
       title: l.header,
       data: l.names.map(n => scryfallCards[n]).filter(Boolean),
     };
  }).filter(l => l.data.length > 0);

  console.log("Final sections count:", finalSections.length);
  finalSections.forEach(s => console.log(s.title, s.data.length));
})();
