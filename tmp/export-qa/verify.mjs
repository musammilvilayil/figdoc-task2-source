import { writeFile } from 'node:fs/promises'
const document = await fetch('http://localhost:5000/api/demo').then(r => r.json())
for (const format of ['docx', 'pdf']) {
  const response = await fetch(`http://localhost:5000/api/export/${format}`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({document})})
  if (!response.ok) throw new Error(await response.text())
  await writeFile(`tmp/export-qa/demo.${format}`, Buffer.from(await response.arrayBuffer()))
  console.log(format, response.status, response.headers.get('content-type'), response.headers.get('content-disposition'))
}
