package types

import "time"

type SalesOrdersOverview struct {
	NewOrderCount   int       `json:"newOrderCount"`
	ProcessingCount int       `json:"processingCount"`
	FinishedCount   int       `json:"finishedCount"`
	UpdatedAt       time.Time `json:"updatedAt"`
}
