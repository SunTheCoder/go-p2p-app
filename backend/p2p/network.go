package p2p

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"sync"
	"time"

	"github.com/libp2p/go-libp2p"
	pubsub "github.com/libp2p/go-libp2p-pubsub"
	"github.com/libp2p/go-libp2p/core/host"
	"github.com/libp2p/go-libp2p/core/network"
	"github.com/libp2p/go-libp2p/core/peer"
	"github.com/libp2p/go-libp2p/p2p/protocol/ping"
)

const (
	MessageTopic = "p2p-messages"
	FileProtocol = "/file/1.0.0" // Protocol ID for file transfers
)

type FileInfo struct {
	Name string
	Size int64
	From string
	Data []byte // Add this to store the actual file data
}

type Network struct {
	host     host.Host
	peers    map[peer.ID]peer.AddrInfo
	pubsub   *pubsub.PubSub
	topic    *pubsub.Topic
	sub      *pubsub.Subscription
	mutex    sync.RWMutex
	messages []Message
	files    map[string]FileInfo // Track received files
}

type Message struct {
	From    string `json:"from"`
	Content string `json:"content"`
}

func NewNetwork() *Network {
	// Create a new libp2p host
	h, err := libp2p.New()
	if err != nil {
		panic(err)
	}

	// Create pubsub
	ps, err := pubsub.NewGossipSub(context.Background(), h)
	if err != nil {
		panic(err)
	}

	// Join the message topic
	topic, err := ps.Join(MessageTopic)
	if err != nil {
		panic(err)
	}

	// Subscribe to the topic
	sub, err := topic.Subscribe()
	if err != nil {
		panic(err)
	}

	n := &Network{
		host:     h,
		peers:    make(map[peer.ID]peer.AddrInfo),
		pubsub:   ps,
		topic:    topic,
		sub:      sub,
		messages: make([]Message, 0),
		files:    make(map[string]FileInfo),
	}

	// Start message handler
	go n.handleMessages()

	// Start ping service
	ping.NewPingService(h)

	// Set up file transfer protocol
	n.host.SetStreamHandler(FileProtocol, n.handleFileStream)

	return n
}

func (n *Network) handleMessages() {
	for {
		msg, err := n.sub.Next(context.Background())
		if err != nil {
			continue
		}

		// Skip messages from ourselves
		if msg.ReceivedFrom == n.host.ID() {
			continue
		}

		var message Message
		if err := json.Unmarshal(msg.Data, &message); err != nil {
			continue
		}

		n.mutex.Lock()
		n.messages = append(n.messages, message)
		n.mutex.Unlock()
	}
}

func (n *Network) handleFileStream(stream network.Stream) {
	defer stream.Close()

	// Read file info
	var fileInfo FileInfo
	decoder := json.NewDecoder(stream)
	if err := decoder.Decode(&fileInfo); err != nil {
		return
	}

	// Create buffer to store file
	buf := new(bytes.Buffer)
	if _, err := io.Copy(buf, stream); err != nil {
		return
	}

	// Store file data in the FileInfo struct
	fileInfo.Data = buf.Bytes()

	// Store file info and data
	n.mutex.Lock()
	n.files[fileInfo.Name] = fileInfo
	n.mutex.Unlock()

	// Broadcast message about received file
	n.BroadcastMessage(fmt.Sprintf("Received file: %s from %s", fileInfo.Name, fileInfo.From))
}

func (n *Network) BroadcastMessage(content string) error {
	message := Message{
		From:    n.host.ID().String(),
		Content: content,
	}

	data, err := json.Marshal(message)
	if err != nil {
		return err
	}

	return n.topic.Publish(context.Background(), data)
}

func (n *Network) GetMessages() []Message {
	n.mutex.RLock()
	defer n.mutex.RUnlock()

	messages := make([]Message, len(n.messages))
	copy(messages, n.messages)
	return messages
}

func (n *Network) ConnectToPeer(addr string) error {
	// Parse the multiaddr
	peerInfo, err := peer.AddrInfoFromString(addr)
	if err != nil {
		log.Printf("Failed to parse address %s: %v", addr, err)
		return fmt.Errorf("invalid address format: %v", err)
	}

	// Check if we're trying to connect to ourselves
	if peerInfo.ID == n.host.ID() {
		return fmt.Errorf("cannot connect to self")
	}

	// Connect to the peer
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := n.host.Connect(ctx, *peerInfo); err != nil {
		log.Printf("Failed to connect to peer %s: %v", peerInfo.ID, err)
		return fmt.Errorf("connection failed: %v", err)
	}

	// Store the peer
	n.mutex.Lock()
	n.peers[peerInfo.ID] = *peerInfo
	n.mutex.Unlock()

	log.Printf("Successfully connected to peer %s", peerInfo.ID)
	return nil
}

func (n *Network) GetPeers() []peer.AddrInfo {
	n.mutex.RLock()
	defer n.mutex.RUnlock()

	peers := make([]peer.AddrInfo, 0, len(n.peers))
	for _, p := range n.peers {
		peers = append(peers, p)
	}
	return peers
}

func (n *Network) GetLocalAddr() string {
	addrs := n.host.Addrs()
	if len(addrs) > 0 {
		return fmt.Sprintf("%s/p2p/%s", addrs[0].String(), n.host.ID().String())
	}
	return ""
}

func (n *Network) SendFile(peerID string, fileName string, data []byte) error {
	// Find peer
	pid, err := peer.Decode(peerID)
	if err != nil {
		return fmt.Errorf("invalid peer ID format: %v", err)
	}

	peerInfo, ok := n.peers[pid]
	if !ok {
		return fmt.Errorf("peer not found")
	}

	// Open stream with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	stream, err := n.host.NewStream(ctx, peerInfo.ID, FileProtocol)
	if err != nil {
		return fmt.Errorf("failed to open stream: %v", err)
	}
	defer stream.Close()

	// Send file info
	fileInfo := FileInfo{
		Name: fileName,
		Size: int64(len(data)),
		From: n.host.ID().String(),
	}
	encoder := json.NewEncoder(stream)
	if err := encoder.Encode(fileInfo); err != nil {
		return fmt.Errorf("failed to send file info: %v", err)
	}

	// Send file data with timeout
	writeCtx, writeCancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer writeCancel()

	done := make(chan error, 1)
	go func() {
		_, err := io.Copy(stream, bytes.NewReader(data))
		done <- err
	}()

	select {
	case err := <-done:
		if err != nil {
			return fmt.Errorf("failed to send file data: %v", err)
		}
	case <-writeCtx.Done():
		return fmt.Errorf("file send timeout")
	}

	return nil
}

func (n *Network) GetFiles() []FileInfo {
	n.mutex.RLock()
	defer n.mutex.RUnlock()

	files := make([]FileInfo, 0, len(n.files))
	for _, f := range n.files {
		files = append(files, f)
	}
	return files
}
