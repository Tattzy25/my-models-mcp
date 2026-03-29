// Script to get MCP server capabilities
import fetch from 'node-fetch'

async function getCapabilities() {
  try {
    const response = await fetch('http://localhost:4000/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'mcp.list_capabilities',
        params: {},
        id: '1',
      }),
    })

    if (response.headers.get('content-type').includes('text/event-stream')) {
      // Handle server-sent events
      for await (const chunk of response.body) {
        const text = new TextDecoder().decode(chunk)
        const lines = text.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.substring(6))
            console.log(JSON.stringify(data, null, 2))
          }
        }
      }
    } else {
      // Handle regular JSON response
      const result = await response.json()
      console.log(JSON.stringify(result, null, 2))
    }
  } catch (error) {
    console.error('Error:', error)
  }
}

getCapabilities()
