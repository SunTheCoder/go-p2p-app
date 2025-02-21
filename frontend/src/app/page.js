import PeerNetwork from '@/components/PeerNetwork'

export default function Home() {
  return (
    <main className="min-h-screen bg-[#111111]">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">P2P Network Demo</h1>
        <PeerNetwork />
      </div>
    </main>
  )
}
