// Package dedalus — machine provisioning + sleep/wake (Member 4).
//
// Distributed multi-VM topology per Contract 11:
//
//	control-plane — Redis, Postgres, Neo4j, Go orchestrator (4 vCPU, 8192 MiB, 20 GiB)
//	advocate      — OpenClaw running only the Defibrillator agent (2 vCPU, 4096 MiB, 10 GiB)
//	skeptic       — OpenClaw running only the Coroner agent     (2 vCPU, 4096 MiB, 10 GiB)
//
// Machine IDs are persisted to MACHINE_IDS.json so wake/sleep do not
// re-provision on every invocation.
//
// NOTE: The exact SDK method names below (Machines.Create, Machines.Update,
// Machines.Exec) match the implementation plan. Adjust to the real SDK
// surface if it differs when the dependency is pulled.
package dedalus

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"sync"

	dedalussdk "github.com/dedalus-labs/dedalus-sdk-go"
)

// MachineIDsPath is where provisioned machine IDs are persisted locally.
// Gitignored. Used by wake/sleep to avoid re-provisioning.
const MachineIDsPath = "MACHINE_IDS.json"

type MachineRecord struct {
	ControlPlaneID string `json:"control_plane_id"`
	ControlPlaneIP string `json:"control_plane_ip,omitempty"`
	AdvocateID     string `json:"advocate_id"`
	AdvocateIP     string `json:"advocate_ip,omitempty"`
	SkepticID      string `json:"skeptic_id"`
	SkepticIP      string `json:"skeptic_ip,omitempty"`
}

var recordMu sync.Mutex

// nodeSetupScript installs Node.js 22 via NodeSource with every mutable
// path redirected to /home/machine so nothing lands on the root FS (which
// is 60–70% OS-reserved on DCS machines).
const nodeSetupScript = `set -eu
export HOME=/home/machine
mkdir -p /home/machine/.npm-global /home/machine/.compile-cache /home/machine/.openclaw /home/machine/tmp
export PATH=/home/machine/.npm-global/bin:$PATH
export NPM_CONFIG_PREFIX=/home/machine/.npm-global
export NPM_CONFIG_CACHE=/home/machine/.npm-cache
export TMPDIR=/home/machine/tmp
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
npm install -g openclaw
`

// gatewayStartScript is written to /home/machine/start-gateway.sh on each
// agent machine. It re-exports every required env var and re-starts the
// gateway — called once at provision time and again on every wake.
func gatewayStartScript(agentID, controlPlaneIP string) string {
	return fmt.Sprintf(`cat > /home/machine/start-gateway.sh <<'EOF'
#!/usr/bin/env bash
set -eu
export HOME=/home/machine
export PATH=/home/machine/.npm-global/bin:$PATH
export OPENCLAW_STATE_DIR=/home/machine/.openclaw
export NODE_COMPILE_CACHE=/home/machine/.compile-cache
export OPENCLAW_NO_RESPAWN=1
export CONTROL_PLANE_IP=%s
export AGENT_ID=%s
cd /home/machine
setsid openclaw gateway </dev/null >/home/machine/gateway.log 2>&1 &
# Verify port bound + HTTP responds
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:18789/ >/dev/null 2>&1; then
    exit 0
  fi
  sleep 1
done
echo "gateway did not come up in time" >&2
exit 1
EOF
chmod +x /home/machine/start-gateway.sh
/home/machine/start-gateway.sh
`, controlPlaneIP, agentID)
}

// ProvisionControlPlane creates the Control Plane machine (Redis, Postgres,
// Neo4j, Go orchestrator container). Returns machine ID and public IP.
func (c *Client) ProvisionControlPlane(ctx context.Context) (string, string, error) {
	spec := &dedalussdk.MachinesCreateParams{
		OrgID:      c.OrgID,
		VCPU:       4,
		MemoryMiB:  8192,
		StorageGiB: 20,
		Label:      "lazarus-control-plane",
	}
	m, err := c.SDK.Machines.Create(ctx, spec)
	if err != nil {
		return "", "", fmt.Errorf("create control plane: %w", err)
	}

	_, err = c.SDK.Machines.Exec(ctx, m.ID, &dedalussdk.MachinesExecParams{
		Command: "apt-get update && apt-get install -y docker.io docker-compose-plugin curl",
	})
	if err != nil {
		return m.ID, m.PublicURL, fmt.Errorf("exec control plane deps: %w", err)
	}

	return m.ID, m.PublicURL, nil
}

// ProvisionAdvocateNode creates the Defibrillator agent machine. Writes a
// config that pins this node to the `defibrillator` agent only and points
// at the Control Plane IP for tool calls.
func (c *Client) ProvisionAdvocateNode(ctx context.Context, controlPlaneIP string) (string, string, error) {
	return c.provisionAgentNode(ctx, "lazarus-advocate", "defibrillator", controlPlaneIP)
}

// ProvisionSkepticNode creates the Coroner agent machine, pinned to the
// `coroner` agent only.
func (c *Client) ProvisionSkepticNode(ctx context.Context, controlPlaneIP string) (string, string, error) {
	return c.provisionAgentNode(ctx, "lazarus-skeptic", "coroner", controlPlaneIP)
}

func (c *Client) provisionAgentNode(ctx context.Context, label, agentID, controlPlaneIP string) (string, string, error) {
	spec := &dedalussdk.MachinesCreateParams{
		OrgID:      c.OrgID,
		VCPU:       2,
		MemoryMiB:  4096,
		StorageGiB: 10,
		Label:      label,
	}
	m, err := c.SDK.Machines.Create(ctx, spec)
	if err != nil {
		return "", "", fmt.Errorf("create %s: %w", label, err)
	}

	if err := c.installNodeAndOpenClaw(ctx, m.ID); err != nil {
		return m.ID, m.PublicURL, err
	}

	_, err = c.SDK.Machines.Exec(ctx, m.ID, &dedalussdk.MachinesExecParams{
		Command: gatewayStartScript(agentID, controlPlaneIP),
	})
	if err != nil {
		return m.ID, m.PublicURL, fmt.Errorf("start gateway on %s: %w", label, err)
	}

	return m.ID, m.PublicURL, nil
}

func (c *Client) installNodeAndOpenClaw(ctx context.Context, machineID string) error {
	_, err := c.SDK.Machines.Exec(ctx, machineID, &dedalussdk.MachinesExecParams{
		Command: nodeSetupScript,
	})
	if err != nil {
		return fmt.Errorf("node install on %s: %w", machineID, err)
	}
	return nil
}

// WakeMachines resumes all three machines. Because the root filesystem on
// DCS agent machines resets every wake (only /home/machine persists),
// Node.js is gone — so the wake sequence must SSH in, re-install Node.js,
// and re-run the gateway startup script on each agent machine. Simply
// setting state=running is not sufficient (per Contract 11).
func (c *Client) WakeMachines(ctx context.Context, rec MachineRecord) error {
	if err := c.setState(ctx, rec.ControlPlaneID, "running"); err != nil {
		return fmt.Errorf("wake control plane: %w", err)
	}
	if err := c.setState(ctx, rec.AdvocateID, "running"); err != nil {
		return fmt.Errorf("wake advocate: %w", err)
	}
	if err := c.setState(ctx, rec.SkepticID, "running"); err != nil {
		return fmt.Errorf("wake skeptic: %w", err)
	}

	// Control plane's state lives in Docker volumes, which do persist —
	// just restart the compose stack.
	if _, err := c.SDK.Machines.Exec(ctx, rec.ControlPlaneID, &dedalussdk.MachinesExecParams{
		Command: "cd /home/machine/lazarus && docker compose up -d",
	}); err != nil {
		return fmt.Errorf("restart control plane stack: %w", err)
	}

	// Agent nodes: re-install Node.js and re-start the gateway.
	if err := c.reviveAgentNode(ctx, rec.AdvocateID, "defibrillator", rec.ControlPlaneIP); err != nil {
		return fmt.Errorf("revive advocate: %w", err)
	}
	if err := c.reviveAgentNode(ctx, rec.SkepticID, "coroner", rec.ControlPlaneIP); err != nil {
		return fmt.Errorf("revive skeptic: %w", err)
	}

	return nil
}

func (c *Client) reviveAgentNode(ctx context.Context, machineID, agentID, controlPlaneIP string) error {
	if machineID == "" {
		return fmt.Errorf("empty machine ID")
	}
	if err := c.installNodeAndOpenClaw(ctx, machineID); err != nil {
		return err
	}
	_, err := c.SDK.Machines.Exec(ctx, machineID, &dedalussdk.MachinesExecParams{
		Command: gatewayStartScript(agentID, controlPlaneIP),
	})
	return err
}

// SleepMachines puts all three machines to sleep. /home/machine persists;
// compute billing stops.
func (c *Client) SleepMachines(ctx context.Context, rec MachineRecord) error {
	if err := c.setState(ctx, rec.ControlPlaneID, "sleeping"); err != nil {
		return fmt.Errorf("sleep control plane: %w", err)
	}
	if err := c.setState(ctx, rec.AdvocateID, "sleeping"); err != nil {
		return fmt.Errorf("sleep advocate: %w", err)
	}
	if err := c.setState(ctx, rec.SkepticID, "sleeping"); err != nil {
		return fmt.Errorf("sleep skeptic: %w", err)
	}
	return nil
}

func (c *Client) setState(ctx context.Context, machineID, desired string) error {
	if machineID == "" {
		return fmt.Errorf("empty machine ID")
	}
	_, err := c.SDK.Machines.Update(ctx, machineID, &dedalussdk.MachinesUpdateParams{
		OrgID:        c.OrgID,
		DesiredState: desired,
	})
	return err
}

// SaveMachines persists the provisioning record to MACHINE_IDS.json.
func SaveMachines(rec MachineRecord) error {
	recordMu.Lock()
	defer recordMu.Unlock()
	raw, err := json.MarshalIndent(rec, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(MachineIDsPath, raw, 0o600)
}

// LoadMachines reads the persisted provisioning record. Returns an error
// if the file does not exist — call Provision* first in that case.
func LoadMachines() (MachineRecord, error) {
	recordMu.Lock()
	defer recordMu.Unlock()
	var rec MachineRecord
	raw, err := os.ReadFile(MachineIDsPath)
	if err != nil {
		return rec, err
	}
	if err := json.Unmarshal(raw, &rec); err != nil {
		return rec, err
	}
	return rec, nil
}
