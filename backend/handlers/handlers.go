package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"p2p-network/p2p"
)

var network *p2p.Network

func InitHandlers(n *p2p.Network) {
	network = n
}

func GetPeers(w http.ResponseWriter, r *http.Request) {
	peers := network.GetPeers()
	json.NewEncoder(w).Encode(peers)
}

func ConnectPeer(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Addr string `json:"addr"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("Failed to decode request: %v", err)
		http.Error(w, "Invalid request format", http.StatusBadRequest)
		return
	}

	log.Printf("Attempting to connect to: %s", req.Addr)

	if err := network.ConnectToPeer(req.Addr); err != nil {
		log.Printf("Connection failed: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func BroadcastMessage(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Message string `json:"message"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := network.BroadcastMessage(req.Message); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func GetMessages(w http.ResponseWriter, r *http.Request) {
	messages := network.GetMessages()
	json.NewEncoder(w).Encode(messages)
}

func GetLocalAddr(w http.ResponseWriter, r *http.Request) {
	addr := network.GetLocalAddr()
	json.NewEncoder(w).Encode(map[string]string{"addr": addr})
}

func SendFile(w http.ResponseWriter, r *http.Request) {
	// Parse multipart form
	if err := r.ParseMultipartForm(10 << 20); err != nil { // 10 MB max
		log.Printf("Error parsing form: %v", err)
		http.Error(w, "Failed to parse form data", http.StatusBadRequest)
		return
	}

	// Get peer ID and file
	peerID := r.FormValue("peerId")
	if peerID == "" {
		log.Printf("No peer ID provided")
		http.Error(w, "Peer ID is required", http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		log.Printf("Error getting file: %v", err)
		http.Error(w, "Failed to get file from request", http.StatusBadRequest)
		return
	}
	defer file.Close()

	if header.Size > 10<<20 { // 10 MB limit
		log.Printf("File too large: %d bytes", header.Size)
		http.Error(w, "File too large (max 10MB)", http.StatusBadRequest)
		return
	}

	// Read file data
	data, err := io.ReadAll(file)
	if err != nil {
		log.Printf("Error reading file data: %v", err)
		http.Error(w, "Failed to read file data", http.StatusInternalServerError)
		return
	}

	// Send file
	if err := network.SendFile(peerID, header.Filename, data); err != nil {
		log.Printf("Error sending file through network: %v", err)
		http.Error(w, fmt.Sprintf("Failed to send file: %v", err), http.StatusInternalServerError)
		return
	}

	log.Printf("Successfully sent file %s to peer %s", header.Filename, peerID)
	w.WriteHeader(http.StatusOK)
}

func GetFiles(w http.ResponseWriter, r *http.Request) {
	files := network.GetFiles()
	json.NewEncoder(w).Encode(files)
}

func DownloadFile(w http.ResponseWriter, r *http.Request) {
	fileName := r.URL.Query().Get("name")
	if fileName == "" {
		http.Error(w, "File name is required", http.StatusBadRequest)
		return
	}

	files := network.GetFiles()
	for _, file := range files {
		if file.Name == fileName {
			w.Header().Set("Content-Type", "application/octet-stream")
			w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s", file.Name))
			w.Header().Set("Content-Length", fmt.Sprintf("%d", file.Size))
			w.Write(file.Data)
			return
		}
	}

	http.Error(w, "File not found", http.StatusNotFound)
}
