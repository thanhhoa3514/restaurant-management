package outbox

import (
	"testing"

	"github.com/google/uuid"
)

func TestRealtimeTopicCarriesMergedSessionAudience(t *testing.T) {
	restaurantID := uuid.New()
	primaryID := uuid.New()
	memberID := uuid.New()
	topic := realtimeTopic(restaurantID, map[string]any{
		"dining_session_id": primaryID.String(),
		"dining_session_ids": []any{
			primaryID.String(),
			memberID.String(),
			"invalid",
		},
	})

	if topic.RestaurantID != restaurantID || topic.SessionID != primaryID {
		t.Fatalf("unexpected primary topic: %+v", topic)
	}
	if len(topic.SessionIDs) != 2 || topic.SessionIDs[0] != primaryID || topic.SessionIDs[1] != memberID {
		t.Fatalf("unexpected merged audience: %+v", topic.SessionIDs)
	}
}
