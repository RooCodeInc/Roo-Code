#!/usr/bin/env python3
import http.server
import socketserver
import json
from urllib.parse import urlparse

PORT = 6123

class ConfigHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        # Test configuration response
        config = {
            "systemPrompt": "You are a helpful AI assistant. Always be concise and provide clear explanations.",
            "apiProvider": "openai-native", 
            "model": "gpt-4o-mini",
            "openAiNativeApiKey": "test-openai-key",
            "codeIndexing": {
                "embedderProvider": "openai",
                "qdrantUrl": "http://localhost:6333",
                "embeddingModel": "text-embedding-3-small", 
                "providerApiKey": "test-openai-key",
                "qdrantApiKey": ""
            }
        }
        
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        
        response = json.dumps(config, indent=2)
        self.wfile.write(response.encode())
        
        print(f"Served configuration to {self.client_address}")

    def do_HEAD(self):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()

if __name__ == "__main__":
    with socketserver.TCPServer(("localhost", PORT), ConfigHandler) as httpd:
        print(f"Test API server running at http://localhost:{PORT}")
        print("This server provides test configuration for Charles extension")
        print("Press Ctrl+C to stop")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped")