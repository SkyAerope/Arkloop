//go:build !desktop

package pipeline

import (
	"context"
	"fmt"
	"time"

	"arkloop/services/worker/internal/data"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type compactAdvisoryPool interface {
	Acquire(context.Context) (*pgxpool.Conn, error)
}

func CompactThreadCompactionLock(ctx context.Context, db data.DB, threadID uuid.UUID) (data.DB, func(), error) {
	if threadID == uuid.Nil {
		return db, func() {}, nil
	}
	pool, ok := db.(compactAdvisoryPool)
	if !ok {
		return db, func() {}, nil
	}
	conn, err := pool.Acquire(ctx)
	if err != nil {
		return nil, nil, err
	}
	released := false
	cleanup := func() {
		if released {
			return
		}
		released = true
		unlockCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		var unlocked bool
		if err := conn.QueryRow(unlockCtx, `SELECT pg_advisory_unlock(hashtext($1::text)::bigint)`, threadID.String()).Scan(&unlocked); err != nil || !unlocked {
			_ = conn.Conn().Close(unlockCtx)
		}
		conn.Release()
	}
	if _, err := conn.Exec(ctx, `SELECT pg_advisory_lock(hashtext($1::text)::bigint)`, threadID.String()); err != nil {
		cleanup()
		return nil, nil, fmt.Errorf("acquire compact advisory lock: %w", err)
	}
	return conn, cleanup, nil
}
