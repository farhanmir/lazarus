// Package dedalus — Dedalus Go SDK wrapper (Member 4).
//
// Exposes a singleton client used by the rest of the package to provision
// and control DCS (Dedalus Compute Substrate) machines.
//
// NOTE: The Dedalus Go SDK import path below is the one documented in the
// implementation plan (`github.com/dedalus-labs/dedalus-sdk-go`). If the
// real SDK exports different constructors, adjust NewClient accordingly
// before merging.
package dedalus

import (
	"context"
	"fmt"
	"os"
	"sync"

	dedalussdk "github.com/dedalus-labs/dedalus-sdk-go"
)

// Client wraps the Dedalus SDK plus the org ID used in all DCS calls.
type Client struct {
	SDK   *dedalussdk.Client
	OrgID string
}

var (
	singleton *Client
	once      sync.Once
	initErr   error
)

// Init creates the singleton Client using DEDALUS_API_KEY and DEDALUS_ORG_ID
// from the environment. Safe to call multiple times.
func Init() (*Client, error) {
	once.Do(func() {
		apiKey := os.Getenv("DEDALUS_API_KEY")
		orgID := os.Getenv("DEDALUS_ORG_ID")
		if apiKey == "" {
			initErr = fmt.Errorf("DEDALUS_API_KEY not set")
			return
		}
		if orgID == "" {
			initErr = fmt.Errorf("DEDALUS_ORG_ID not set")
			return
		}
		sdk := dedalussdk.NewClient(apiKey)
		singleton = &Client{SDK: sdk, OrgID: orgID}
	})
	return singleton, initErr
}

// Get returns the initialized singleton or an error if Init was never called
// or failed.
func Get() (*Client, error) {
	if singleton != nil {
		return singleton, nil
	}
	return Init()
}

// HealthCheck makes a trivial API call to verify credentials work.
// Returns nil on success.
func (c *Client) HealthCheck(ctx context.Context) error {
	if c == nil || c.SDK == nil {
		return fmt.Errorf("dedalus client not initialized")
	}
	// A cheap, read-only call. Listing machines should always succeed if
	// credentials are valid. If the SDK exposes a dedicated ping/health
	// endpoint, switch to that.
	_, err := c.SDK.Machines.List(ctx, &dedalussdk.MachinesListParams{
		OrgID: c.OrgID,
	})
	return err
}
