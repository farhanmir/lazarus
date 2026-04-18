// Package tools — /tools/replay endpoint (Member 4).
//
// When called, this handler reads data/swarm_logs.json and asynchronously
// broadcasts each event to the WebSocket hub with a ~2.4s delay between
// events, simulating a full swarm run without any LLM or external API
// calls. This is the nuclear fallback for a total network outage.
//
// Wire up in internal/tools/server.go (Member 1) with:
//
//	mux.HandleFunc("POST /tools/replay", ReplayHandler(deps))
package tools

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/lazarus/internal/websocket"
)

// replayDeps is the minimal dependency surface Replay needs.
// Kept as an interface so this file compiles independently of Member 1's
// full Deps struct. Member 1's Deps struct should satisfy this interface.
type replayDeps interface {
	Broadcaster() websocket.HubBroadcaster
	SwarmLogsPath() string // e.g. "data/swarm_logs.json"
}

// ReplayHandler returns a net/http handler for POST /tools/replay.
// Pass any type that satisfies replayDeps (Member 1's Deps struct will).
func ReplayHandler(deps replayDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		path := deps.SwarmLogsPath()
		if path == "" {
			path = filepath.Join("data", "swarm_logs.json")
		}

		events, err := loadSwarmLogs(path)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"error": fmt.Sprintf("failed to read %s: %v", path, err),
			})
			return
		}

		hub := deps.Broadcaster()
		if hub == nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"error": "websocket hub not initialized",
			})
			return
		}

		go replayStream(hub, events)

		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"status": "replay_started",
			"events": len(events),
		})
	}
}

func loadSwarmLogs(path string) ([]websocket.LogEvent, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var events []websocket.LogEvent
	if err := json.Unmarshal(raw, &events); err != nil {
		return nil, err
	}
	return events, nil
}

func replayStream(hub websocket.HubBroadcaster, events []websocket.LogEvent) {
	const interval = 2400 * time.Millisecond
	for i, ev := range events {
		if ev.Timestamp == "" {
			ev.Timestamp = time.Now().UTC().Format(time.RFC3339)
		}
		hub.Broadcast(ev)
		if i < len(events)-1 {
			time.Sleep(interval)
		}
	}
}
