package ghosts

import "testing"

func TestCatalogLoadsAllCurrentGhostEntries(t *testing.T) {
	catalog, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if len(catalog.Ghosts) != 30 {
		t.Fatalf("ghost count = %d, want 30", len(catalog.Ghosts))
	}
	for _, ghost := range catalog.Ghosts {
		if len(ghost.Evidence) < 3 {
			t.Fatalf("%s has incomplete evidence: %#v", ghost.Name, ghost.Evidence)
		}
	}
}

func TestSearchMatchesNameAndAlias(t *testing.T) {
	catalog := MustLoad()

	results := catalog.Search("mimic")
	if len(results) != 1 || results[0].Name != "The Mimic" {
		t.Fatalf("mimic search returned %#v", results)
	}

	results = catalog.Search("raiju")
	if len(results) != 1 || results[0].Name != "Raiju" {
		t.Fatalf("raiju search returned %#v", results)
	}

	results = catalog.Search("deildegast")
	if len(results) != 1 || results[0].Name != "Deildegast" {
		t.Fatalf("deildegast search returned %#v", results)
	}
}

func TestSearchMatchesSpanishNames(t *testing.T) {
	catalog := MustLoad()
	tests := []struct {
		query string
		name  string
	}{
		{query: "espiritu", name: "Spirit"},
		{query: "espectro", name: "Wraith"},
		{query: "ente", name: "Phantom"},
		{query: "pesadilla", name: "Mare"},
		{query: "sombra", name: "Shade"},
		{query: "demonio", name: "Demon"},
		{query: "mimico", name: "The Mimic"},
		{query: "gemelos", name: "The Twins"},
	}

	for _, test := range tests {
		results := catalog.Search(test.query)
		if len(results) != 1 || results[0].Name != test.name {
			t.Errorf("%q search returned %#v, want %s", test.query, results, test.name)
		}
	}
}

func TestMatchSpeedIncludesConditionalProfiles(t *testing.T) {
	catalog := MustLoad()
	results := catalog.MatchSpeed(3.0, 0.175)
	foundRevenant := false
	foundDeogen := false
	for _, result := range results {
		switch result.Ghost.Name {
		case "Revenant":
			foundRevenant = true
		case "Deogen":
			foundDeogen = true
		}
	}
	if !foundRevenant || !foundDeogen {
		t.Fatalf("3.0 m/s matches missing expected ghosts: %#v", results)
	}
}

func TestRankSpeedOrdersClosestProfiles(t *testing.T) {
	catalog := MustLoad()
	results := catalog.RankSpeed(1.7, 3)
	if len(results) != 3 {
		t.Fatalf("ranked result count = %d, want 3", len(results))
	}
	for index := 1; index < len(results); index++ {
		if results[index].ClosestDistance < results[index-1].ClosestDistance {
			t.Fatalf("ranking is not sorted: %#v", results)
		}
	}
}
