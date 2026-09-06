const lines = `
1x Darkbore Pathway // Slitherbore Pathway (khm) 254 [87a4e5fe-161f-42da-9ca2-67c8e8970e94]
1x Stensian Sanguinist // Exsanguinate (soc) 29 [909a52bc-53f6-4654-9db7-e8f48333d765]
1x Lightning Bolt [abcdef]
2x Mountain (unh) 123
`

const regex = /^(\d+)[xX]?\s+(.+?)(?:\s+\([^)]+\)\s+\S+)?(?:\s+\[([a-f0-9-]+)\])?$/

for (const line of lines.split('\n')) {
  if (!line.trim()) continue
  const match = line.trim().match(regex)
  console.log(line)
  if (match) {
    console.log("QTY:", match[1])
    console.log("NAME:", match[2].trim())
    console.log("ID:", match[3])
  } else {
    console.log("NO MATCH")
  }
}
