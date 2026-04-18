// Package dedalus — machine provisioning + sleep/wake (Member 4).
//
// Two DCS machines power the demo:
//
//	app  — runs Go orchestrator, OpenClaw, and the Photon sidecar.
//	data — runs Redis, Postgres, Neo4j.
//
// IDs are persisted to the file at MachineIDsPath so subsequent `wake` and
// `sleep` invocations reuse the same machines (no re-provisioning).
//
// NOTE: The exact SDK method names below (Machines.Create, Machines.Update,
// Machines.Exec) match the implementation plan. Adjust to the real SDK
// surface if it differs when you pull the dependency.
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
	AppMachineID  string `json:"app_machine_id"`
	DataMachineID string `json:"data_machine_id"`
	AppPublicURL  string `json:"app_public_url,omitempty"`
	DataPublicURL string `json:"data_public_url,omitempty"`
}

var recordMu sync.Mutex

// ProvisionAppMachine creates the app-tier DCS machine (Go + OpenClaw +
// Photon service). Returns machine ID and its public URL.
func (c *Client) ProvisionAppMachine(ctx context.Context) (string, string, error) {
	spec := &dedalussdk.MachinesCreateParams{
		OrgID:      c.OrgID,
		VCPU:       4,
		MemoryMiB:  8192,
		StorageGiB: 20,
		Label:      "lazarus-app",
	}
	m, err := c.SDK.Machines.Create(ctx, spec)
	if err != nil {
		return "", "", fmt.Errorf("create app machine: %w", err)
	}

	// Install dependencies on the freshly provisioned host.
	_, err = c.SDK.Machines.Exec(ctx, m.ID, &dedalussdk.MachinesExecParams{
		Command: "apt-get update && apt-get install -y docker.io docker-compose-plugin nodejs npm",
	})
	if err != nil {
		return m.ID, m.PublicURL, fmt.Errorf("exec app deps install: %w", err)
	}

	return m.ID, m.PublicURL, nil
}

// ProvisionDataMachine creates the data-tier DCS machine (Redis + Postgres
// + Neo4j). Returns machine ID and its public URL.
func (c *Client) ProvisionDataMachine(ctx context.Context) (string, string, error) {
	spec := &dedalussdk.MachinesCreateParams{
		OrgID:      c.OrgID,
		VCPU:       2,
		MemoryMiB:  4096,
		StorageGiB: 20,
		Label:      "lazarus-data",
	}
	m, err := c.SDK.Machines.Create(ctx, spec)
	if err != nil {
		return "", "", fmt.Errorf("create data machine: %w", err)
	}

	_, err = c.SDK.Machines.Exec(ctx, m.ID, &dedalussdk.MachinesExecParams{
		Command: "apt-get update && apt-get install -y docker.io docker-compose-plugin",
	})
	if err != nil {
		return m.ID, m.PublicURL, fmt.Errorf("exec data deps install: %w", err)
	}

	return m.ID, m.PublicURL, nil
}

// WakeMachines resumes both machines (sub-second from sleep, per Dedalus docs).
func (c *Client) WakeMachines(ctx context.Context, rec MachineRecord) error {
	if err := c.setState(ctx, rec.AppMachineID, "running"); err != nil {
		return fmt.Errorf("wake app: %w", err)
	}
	if err := c.setState(ctx, rec.DataMachineID, "running"); err != nil {
		return fmt.Errorf("wake data: %w", err)
	}
	return nil
}

// SleepMachines puts both machines to sleep to stop compute billing.
// Storage (S3-backed /home/machine) persists.
func (c *Client) SleepMachines(ctx context.Context, rec MachineRecord) error {
	if err := c.setState(ctx, rec.AppMachineID, "sleeping"); err != nil {
		return fmt.Errorf("sleep app: %w", err)
	}
	if err := c.setState(ctx, rec.DataMachineID, "sleeping"); err != nil {
		return fmt.Errorf("sleep data: %w", err)
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
