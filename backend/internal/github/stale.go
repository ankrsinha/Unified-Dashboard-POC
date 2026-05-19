package github

import "time"

// StaleActivityDays is how long without an update before an open item is considered stale.
const StaleActivityDays = 30

func isStaleAt(t time.Time, now time.Time) bool {
	return now.Sub(t.UTC()) >= StaleActivityDays*24*time.Hour
}

func isStaleISO(iso string, now time.Time) bool {
	if iso == "" {
		return false
	}
	t, err := time.Parse(time.RFC3339, iso)
	if err != nil {
		return false
	}
	return isStaleAt(t, now)
}
