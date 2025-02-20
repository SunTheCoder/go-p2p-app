import PeerNetwork from '../components/PeerNetwork'

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-3xl font-bold mb-8">P2P Network Demo</h1>
      <PeerNetwork />
    </div>
  )
}
