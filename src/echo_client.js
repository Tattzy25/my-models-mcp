// Simple MCP client to call the echo tool
import fetch from 'node-fetch'

async function callEchoTool() {
  const response = await fetch('http://localhost:4000/mcp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'echo',
        arguments: {
          message: 'how are you today',
        },
      },
      id: '1',
    }),
  })

  const contentType = response.headers.get('content-type')
  if (contentType && contentType.includes('text/event-stream')) {
    const text = await response.text()
    const match = text.match(/data: (.*)/)
    if (match && match[1]) {
      const result = JSON.parse(match[1])
      console.log(JSON.stringify(result, null, 2))
    } else {
      console.log('No JSON data found in SSE response:', text)
    }
  } else {
    const result = await response.json()
    console.log(JSON.stringify(result, null, 2))
  }
}

callEchoTool().catch(console.error)
