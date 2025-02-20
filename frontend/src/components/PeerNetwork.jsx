'use client'
import { useState, useEffect } from 'react'

export default function PeerNetwork() {
  const [backendUrl, setBackendUrl] = useState('http://localhost:8080')

  const [peers, setPeers] = useState([])
  const [newPeerAddr, setNewPeerAddr] = useState('')
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState([])
  const [error, setError] = useState('')
  const [localAddr, setLocalAddr] = useState('')
  const [files, setFiles] = useState([])
  const [selectedFile, setSelectedFile] = useState(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const port = params.get('port') || '8080'
    const cleanPort = port.split(' ')[0]
    setBackendUrl(`http://localhost:${cleanPort}`)
  }, [])

  const fetchPeers = async (url) => {
    try {
      const baseUrl = url.split(' ')[0]
      const response = await fetch(`${baseUrl}/api/peers`)
      const data = await response.json()
      setPeers(data)
      setError('')
    } catch (error) {
      console.error('Error fetching peers:', error)
      setError('Failed to connect to backend server')
    }
  }

  const connectToPeer = async (url) => {
    try {
      const baseUrl = url.split(' ')[0]
      await fetch(`${baseUrl}/api/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ addr: newPeerAddr }),
      })
      setNewPeerAddr('')
      fetchPeers(baseUrl)
    } catch (error) {
      console.error('Error connecting to peer:', error)
    }
  }

  const broadcastMessage = async (url) => {
    try {
      const baseUrl = url.split(' ')[0]
      await fetch(`${baseUrl}/api/broadcast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      })
      setMessage('')
      fetchMessages(baseUrl)
    } catch (error) {
      console.error('Error broadcasting message:', error)
    }
  }

  const fetchMessages = async (url) => {
    try {
      const baseUrl = url.split(' ')[0]
      const response = await fetch(`${baseUrl}/api/messages`)
      const data = await response.json()
      setMessages(data)
      setError('')
    } catch (error) {
      console.error('Error fetching messages:', error)
      setError('Failed to connect to backend server')
    }
  }

  const fetchLocalAddr = async (url) => {
    try {
      const baseUrl = url.split(' ')[0]
      const response = await fetch(`${baseUrl}/api/local`)
      const data = await response.json()
      setLocalAddr(data.addr)
    } catch (error) {
      console.error('Error fetching local address:', error)
    }
  }

  const fetchFiles = async (url) => {
    try {
      const baseUrl = url.split(' ')[0]
      const response = await fetch(`${baseUrl}/api/files`)
      const data = await response.json()
      setFiles(data)
    } catch (error) {
      console.error('Error fetching files:', error)
    }
  }

  const sendFile = async (peerId, file) => {
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('peerId', peerId)
      
      const response = await fetch(`${backendUrl}/api/sendfile`, {
        method: 'POST',
        body: formData,
      })
      if (!response.ok) {
        const error = await response.text()
        throw new Error(error)
      }
      // Refresh files list after successful send
      fetchFiles(backendUrl)
    } catch (error) {
      console.error('Error sending file:', error)
      setError(`Failed to send file: ${error.message}`)
    }
  }

  useEffect(() => {
    if (backendUrl) {
      fetchPeers(backendUrl)
      fetchMessages(backendUrl)
      fetchLocalAddr(backendUrl)
      fetchFiles(backendUrl)
    }
    const interval = setInterval(() => {
      if (backendUrl) {
        fetchPeers(backendUrl)
        fetchMessages(backendUrl)
        fetchFiles(backendUrl)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [backendUrl])

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Connected Peers</h2>
        {peers.length === 0 ? (
          <p className="text-sm text-gray-500">No peers connected yet</p>
        ) : (
          <ul className="space-y-2">
            {peers.map((peer, index) => (
              <li key={`${peer.ID || peer.id || index}`} className="text-sm bg-gray-50 p-3 rounded">
                <div className="font-semibold">Peer ID:</div>
                <div className="font-mono break-all">{peer.ID || peer.id}</div>
                <div className="font-semibold mt-2">Address:</div>
                <div className="font-mono text-xs break-all">
                  {peer.Addrs && peer.Addrs[0]}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Connect to Peer</h2>
        <p className="text-sm text-gray-600 mb-2">
          Paste another user's Node Address here to connect to them
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={newPeerAddr}
            onChange={(e) => setNewPeerAddr(e.target.value)}
            placeholder="Paste peer address here..."
            className="flex-1 px-3 py-2 border rounded"
          />
          <button
            onClick={() => connectToPeer(backendUrl)}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Connect
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Messages</h2>
        <ul className="space-y-2">
          {messages.map((msg, index) => (
            <li key={`${msg.from}-${index}`} className="text-sm">
              <span className="font-semibold">{msg.from}:</span> {msg.content}
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Broadcast Message</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter message"
            className="flex-1 px-3 py-2 border rounded"
          />
          <button
            onClick={() => broadcastMessage(backendUrl)}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Send
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Your Node Address</h2>
        <p className="text-sm text-gray-600 mb-2">
          Share this address with others so they can connect to you
        </p>
        <div className="flex gap-2">
          <div className="text-sm font-mono break-all bg-gray-50 p-3 rounded flex-1">
            {localAddr || 'Loading...'}
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(localAddr);
            }}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
          >
            Copy
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Send File</h2>
        {peers.map((peer) => (
          <div key={peer.ID || peer.id} className="mb-4">
            <div className="font-mono text-sm mb-2">{peer.ID || peer.id}</div>
            <div className="flex gap-2">
              <input
                type="file"
                onChange={(e) => setSelectedFile(e.target.files?.[0])}
                className="flex-1 text-sm text-gray-500"
              />
              <button
                onClick={() => {
                  if (selectedFile) {
                    sendFile(peer.ID || peer.id, selectedFile)
                    setSelectedFile(null)
                  }
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                disabled={!selectedFile}
              >
                Send File
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Received Files</h2>
        <ul className="space-y-2">
          {files.map((file, index) => (
            <li key={index} className="text-sm flex items-center justify-between">
              <div>
                <span className="font-semibold">{file.Name}</span>
                <span className="text-gray-500"> from </span>
                <span className="font-mono">{file.From}</span>
                <span className="text-gray-500"> ({(file.Size / 1024).toFixed(2)} KB)</span>
              </div>
              <a
                href={`${backendUrl}/api/download?name=${encodeURIComponent(file.Name)}`}
                download={file.Name}
                className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
              >
                Download
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
} 