'use client'
import { useState, useEffect } from 'react'

const Notification = ({ message, type = 'success' }) => (
  <div className={`
    fixed bottom-4 right-4 px-4 py-2 rounded-lg shadow-lg
    transition-opacity duration-500
    ${type === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-blue-500/10 text-blue-500'}
  `}>
    {message}
  </div>
)

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
  const [notification, setNotification] = useState(null)
  const [fileProgress, setFileProgress] = useState({})
  const [sendProgress, setSendProgress] = useState({})
  const [activeTransfers, setActiveTransfers] = useState({})

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 3000)
  }

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
      showNotification('Successfully connected to peer')
    } catch (error) {
      console.error('Error connecting to peer:', error)
      setError('Failed to connect to peer')
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
      showNotification('Message sent')
    } catch (error) {
      console.error('Error broadcasting message:', error)
      setError('Failed to send message')
    }
  }

  const fetchMessages = async (url) => {
    try {
      const baseUrl = url.split(' ')[0]
      const response = await fetch(`${baseUrl}/api/messages`)
      const data = await response.json()
      const transfers = {}
      const regularMessages = []
      
      data.forEach(msg => {
        if (msg.content.startsWith('FILE_PROGRESS:')) {
          const [_, fileName, progress] = msg.content.split(':')
          transfers[fileName] = {
            progress: parseFloat(progress),
            from: msg.from
          }
        } else {
          regularMessages.push(msg)
        }
      })
      
      setActiveTransfers(transfers)
      setMessages(regularMessages)
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
    // Check file size (10MB limit)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > MAX_FILE_SIZE) {
      setError(`File too large. Maximum size is ${(MAX_FILE_SIZE / (1024 * 1024)).toFixed(0)}MB`)
      return
    }

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('peerId', peerId)
      
      const xhr = new XMLHttpRequest()
      xhr.open('POST', `${backendUrl}/api/sendfile`)
      
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = (event.loaded / event.total) * 100
          setSendProgress(prev => ({
            ...prev,
            [peerId]: progress
          }))
        }
      }
      
      xhr.onload = () => {
        if (xhr.status === 200) {
          showNotification(`File "${file.name}" sent successfully`)
          setTimeout(() => {
            setSendProgress(prev => {
              const newProgress = { ...prev }
              delete newProgress[peerId]
              return newProgress
            })
          }, 1000)
          setSelectedFile(null)
          fetchFiles(backendUrl)
        } else {
          setError(xhr.responseText || 'Failed to send file')
          setSendProgress(prev => {
            const newProgress = { ...prev }
            delete newProgress[peerId]
            return newProgress
          })
        }
      }
      
      xhr.onerror = () => {
        setError('Network error occurred')
        setSendProgress(prev => {
          const newProgress = { ...prev }
          delete newProgress[peerId]
          return newProgress
        })
      }
      
      xhr.send(formData)
    } catch (error) {
      console.error('Error sending file:', error)
      setError(`Failed to send file: ${error.message}`)
      setSendProgress(prev => {
        const newProgress = { ...prev }
        delete newProgress[peerId]
        return newProgress
      })
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
    }, 500)
    return () => clearInterval(interval)
  }, [backendUrl])

  // Helper function to shorten peer IDs
  const shortenPeerId = (peerId) => {
    return peerId.slice(0, 6) + '...' + peerId.slice(-4)
  }

  return (
    <div className="space-y-6">
      {notification && (
        <Notification message={notification.message} type={notification.type} />
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-3 rounded relative">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      <div className="bg-[var(--card-background)] p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Connected Peers</h2>
        {peers.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">No peers connected yet</p>
        ) : (
          <ul className="space-y-2">
            {peers.map((peer, index) => (
              <li key={`${peer.ID || peer.id || index}`} className="text-sm bg-[var(--background)] p-3 rounded">
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

      <div className="bg-[var(--card-background)] p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Connect to Peer</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-2">
          Paste another user's Node Address here to connect to them
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={newPeerAddr}
            onChange={(e) => setNewPeerAddr(e.target.value)}
            placeholder="Paste peer address here..."
            className="flex-1 px-3 py-2 border border-gray-600 rounded bg-[var(--input-background)] text-[var(--text-primary)]"
          />
          <button
            onClick={() => connectToPeer(backendUrl)}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Connect
          </button>
        </div>
      </div>

      <div className="bg-[var(--card-background)] p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Messages</h2>
        <div className="h-96 overflow-y-auto mb-4 border rounded bg-[var(--background)]">
          <ul className="space-y-4 p-4">
            {Object.entries(activeTransfers).map(([fileName, { progress, from }]) => (
              <li key={`transfer-${fileName}`} className="flex justify-center">
                <div className="bg-[var(--message-received)] rounded-lg p-4 w-3/4">
                  <div className="text-xs text-[var(--text-secondary)] mb-2">
                    {from === localAddr ? 'Sending:' : 'Receiving:'} {fileName}
                  </div>
                  <div className="h-2 bg-[var(--background)] rounded-full overflow-hidden border border-blue-500/20">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-300 rounded-full shadow-lg"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] mt-2 text-right">
                    {progress.toFixed(1)}%
                  </div>
                </div>
              </li>
            ))}

            {messages.map((msg, index) => (
              <li 
                key={`${msg.from}-${index}`}
                className={`flex ${msg.from === localAddr ? 'justify-end' : 'justify-start'}`}
              >
                <div 
                  className={`
                    max-w-[70%] rounded-lg px-4 py-2 text-sm
                    ${msg.from === localAddr 
                      ? 'bg-[var(--message-sent)] text-white rounded-br-none' 
                      : 'bg-[var(--message-received)] text-[var(--text-primary)] rounded-bl-none shadow'
                    }
                  `}
                >
                  <div className={`font-semibold mb-1 text-xs ${msg.from === localAddr ? 'text-white/75' : 'text-[var(--text-secondary)]'}`}>
                    {msg.from === localAddr ? 'You' : shortenPeerId(msg.from)}
                  </div>
                  <div>{msg.content}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && message.trim() && broadcastMessage(backendUrl)}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-[var(--background)] text-[var(--text-primary)]"
          />
          <button
            onClick={() => broadcastMessage(backendUrl)}
            disabled={!message.trim()}
            className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>

      <div className="bg-[var(--card-background)] p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Your Node Address</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-2">
          Share this address with others so they can connect to you
        </p>
        <div className="flex gap-2">
          <div className="text-sm font-mono break-all bg-[var(--background)] text-[var(--text-primary)] p-3 rounded flex-1">
            {localAddr || 'Loading...'}
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(localAddr)
              showNotification('Address copied to clipboard', 'info')
            }}
            className="px-4 py-2 bg-[var(--background)] text-[var(--text-primary)] rounded hover:bg-[var(--message-received)]"
          >
            Copy
          </button>
        </div>
      </div>

      <div className="bg-[var(--card-background)] p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Send File</h2>
        {peers.map((peer) => (
          <div key={peer.ID || peer.id} className="mb-4">
            <div className="font-mono text-sm mb-2">{peer.ID || peer.id}</div>
            <div className="flex gap-2">
              <div className="flex-1">
                <input
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files?.[0])}
                  className="w-full text-sm text-[var(--text-secondary)] mb-1"
                />
                <div className="text-xs text-[var(--text-secondary)]">
                  Maximum file size: 10MB
                </div>
                {sendProgress[peer.ID || peer.id] !== undefined && (
                  <div className="mt-2">
                    <div className="h-2 bg-[var(--background)] rounded-full overflow-hidden border border-blue-500/20">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-300 rounded-full shadow-lg"
                        style={{ width: `${sendProgress[peer.ID || peer.id]}%` }}
                      />
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] mt-2 flex justify-between">
                      <span>{sendProgress[peer.ID || peer.id] === 100 ? 'Complete' : 'Uploading file...'}</span>
                      Sending: {sendProgress[peer.ID || peer.id].toFixed(1)}%
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={() => sendFile(peer.ID || peer.id, selectedFile)}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                disabled={!selectedFile || (sendProgress[peer.ID || peer.id] !== undefined && sendProgress[peer.ID || peer.id] !== 100)}
              >
                Send File
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-[var(--card-background)] p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Received Files</h2>
        <ul className="space-y-2">
          {files.map((file, index) => (
            <li key={index} className="text-sm flex items-center justify-between">
              <div className="flex-1">
                <div>
                  <span className="font-semibold">{file.Name}</span>
                  <span className="text-[var(--text-secondary)]"> from </span>
                  <span className="font-mono">{file.From}</span>
                  <span className="text-[var(--text-secondary)]"> ({(file.Size / 1024).toFixed(2)} KB)</span>
                </div>
                {fileProgress[file.Name] !== undefined && fileProgress[file.Name] < 100 && (
                  <div className="mt-2">
                    <div className="h-2 bg-[var(--background)] rounded-full overflow-hidden border border-blue-500/20">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-300 rounded-full shadow-lg"
                        style={{ width: `${fileProgress[file.Name]}%` }}
                      />
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] mt-2 flex justify-between">
                      <span>{fileProgress[file.Name] === 100 ? 'Complete' : 'Downloading file...'}</span>
                      Receiving: {fileProgress[file.Name].toFixed(1)}%
                    </div>
                  </div>
                )}
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