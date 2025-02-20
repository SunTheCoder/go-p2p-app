package main

import (
	"log"
	"net/http"
	"os"
	"p2p-network/handlers"
	"p2p-network/p2p"

	"github.com/gorilla/mux"
	"github.com/rs/cors"
)

func main() {
	// Get port from environment variable or use default
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	router := mux.NewRouter()

	// Initialize P2P network
	network := p2p.NewNetwork()
	handlers.InitHandlers(network)

	// API routes
	router.HandleFunc("/api/peers", handlers.GetPeers).Methods("GET")
	router.HandleFunc("/api/local", handlers.GetLocalAddr).Methods("GET")
	router.HandleFunc("/api/connect", handlers.ConnectPeer).Methods("POST")
	router.HandleFunc("/api/broadcast", handlers.BroadcastMessage).Methods("POST")
	router.HandleFunc("/api/messages", handlers.GetMessages).Methods("GET")
	router.HandleFunc("/api/sendfile", handlers.SendFile).Methods("POST")
	router.HandleFunc("/api/files", handlers.GetFiles).Methods("GET")
	router.HandleFunc("/api/download", handlers.DownloadFile).Methods("GET")

	// Setup CORS
	c := cors.New(cors.Options{
		AllowedOrigins: []string{
			"http://localhost:3000",
			"http://192.168.1.155:3000", // Add your local IP
			"http://127.0.0.1:3000",
		},
		AllowedMethods: []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders: []string{"Content-Type", "Accept"},
		ExposedHeaders: []string{"Content-Length"},
		Debug:          true, // Enable for debugging CORS issues
	})

	handler := c.Handler(router)

	log.Printf("Server starting on :%s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, handler))
}
