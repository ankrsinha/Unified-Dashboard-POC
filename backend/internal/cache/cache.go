package cache

import (
	"encoding/json"
	"sync"
	"time"
)

type Cache struct {
	ttl   time.Duration
	mu    sync.RWMutex
	items map[string]entry
}

type entry struct {
	data   []byte
	expiry time.Time
}

func New(ttl time.Duration) *Cache {
	return &Cache{
		ttl:   ttl,
		items: make(map[string]entry),
	}
}

func (c *Cache) TTL() time.Duration {
	return c.ttl
}

func (c *Cache) Delete(key string) {
	c.mu.Lock()
	delete(c.items, key)
	c.mu.Unlock()
}

// GetOrFetch returns cached JSON or calls fetch and stores the result until TTL expires.
func GetOrFetch[T any](c *Cache, key string, fetch func() (T, error)) (v T, hit bool, err error) {
	if raw, ok := c.getBytes(key); ok {
		var decoded T
		if json.Unmarshal(raw, &decoded) == nil {
			return decoded, true, nil
		}
		c.Delete(key)
	}

	v, err = fetch()
	if err != nil {
		return v, false, err
	}
	c.set(key, v)
	return v, false, nil
}

// Get returns a cached value if present and not expired.
func Get[T any](c *Cache, key string) (T, bool) {
	var zero T
	raw, ok := c.getBytes(key)
	if !ok {
		return zero, false
	}
	if err := json.Unmarshal(raw, &zero); err != nil {
		c.Delete(key)
		return zero, false
	}
	return zero, true
}

func (c *Cache) getBytes(key string) ([]byte, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	e, ok := c.items[key]
	if !ok || time.Now().After(e.expiry) {
		return nil, false
	}
	return e.data, true
}

func (c *Cache) set(key string, v any) {
	data, err := json.Marshal(v)
	if err != nil {
		return
	}
	c.mu.Lock()
	c.items[key] = entry{data: data, expiry: time.Now().Add(c.ttl)}
	c.mu.Unlock()
}

func (c *Cache) Stats() (entries int, expired int) {
	now := time.Now()
	c.mu.RLock()
	defer c.mu.RUnlock()
	for _, e := range c.items {
		entries++
		if now.After(e.expiry) {
			expired++
		}
	}
	return entries, expired
}
