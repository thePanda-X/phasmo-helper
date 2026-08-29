package ghosts

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"unicode"

	"golang.org/x/text/unicode/norm"
)

//go:embed data/ghosts.json
var catalogData []byte

type SpeedProfile struct {
	Label     string  `json:"label"`
	BaseMPS   float64 `json:"baseMPS"`
	Condition string  `json:"condition"`
}

type Ghost struct {
	ID             string         `json:"id"`
	Name           string         `json:"name"`
	Aliases        []string       `json:"aliases"`
	LocalizedNames []string       `json:"localizedNames,omitempty"`
	Evidence       []string       `json:"evidence"`
	SpeedProfiles  []SpeedProfile `json:"speedProfiles"`
	Tells          []string       `json:"tells"`
}

type Catalog struct {
	Version string  `json:"version"`
	Source  string  `json:"source"`
	Ghosts  []Ghost `json:"ghosts"`
}

type CatalogInfo struct {
	Version string `json:"version"`
	Source  string `json:"source"`
	Count   int    `json:"count"`
}

type SpeedMatch struct {
	Ghost            Ghost          `json:"ghost"`
	MatchingProfiles []SpeedProfile `json:"matchingProfiles"`
	ClosestDistance  float64        `json:"closestDistance"`
}

var standardEvidence = map[string][]string{
	"aswang":      {"freezing", "ghostWriting", "dots"},
	"banshee":     {"dots", "ultraviolet", "ghostOrbs"},
	"dayan":       {"emf5", "ghostOrbs", "spiritBox"},
	"deildegast":  {"emf5", "ghostWriting", "dots"},
	"demon":       {"freezing", "ultraviolet", "ghostWriting"},
	"deogen":      {"dots", "spiritBox", "ghostWriting"},
	"gallu":       {"emf5", "ultraviolet", "spiritBox"},
	"goryo":       {"emf5", "ultraviolet", "dots"},
	"hantu":       {"freezing", "ultraviolet", "ghostOrbs"},
	"jinn":        {"emf5", "freezing", "ultraviolet"},
	"kormos":      {"ghostOrbs", "spiritBox", "ultraviolet"},
	"mare":        {"spiritBox", "ghostOrbs", "ghostWriting"},
	"moroi":       {"freezing", "spiritBox", "ghostWriting"},
	"myling":      {"emf5", "ultraviolet", "ghostWriting"},
	"obake":       {"emf5", "ultraviolet", "ghostOrbs"},
	"obambo":      {"ghostWriting", "ultraviolet", "dots"},
	"oni":         {"emf5", "freezing", "dots"},
	"onryo":       {"freezing", "spiritBox", "ghostOrbs"},
	"phantom":     {"spiritBox", "ultraviolet", "dots"},
	"poltergeist": {"spiritBox", "ultraviolet", "ghostWriting"},
	"raiju":       {"emf5", "dots", "ghostOrbs"},
	"revenant":    {"freezing", "ghostOrbs", "ghostWriting"},
	"shade":       {"emf5", "freezing", "ghostWriting"},
	"spirit":      {"emf5", "spiritBox", "ghostWriting"},
	"thaye":       {"dots", "ghostOrbs", "ghostWriting"},
	"the-mimic":   {"freezing", "spiritBox", "ultraviolet", "ghostOrbs"},
	"the-twins":   {"emf5", "freezing", "spiritBox"},
	"wraith":      {"emf5", "spiritBox", "dots"},
	"yokai":       {"spiritBox", "ghostOrbs", "dots"},
	"yurei":       {"freezing", "ghostOrbs", "dots"},
}

func Load() (Catalog, error) {
	var catalog Catalog
	if err := json.Unmarshal(catalogData, &catalog); err != nil {
		return Catalog{}, fmt.Errorf("decode ghost catalog: %w", err)
	}
	if catalog.Version == "" || len(catalog.Ghosts) == 0 {
		return Catalog{}, fmt.Errorf("ghost catalog is empty or missing a version")
	}
	for index := range catalog.Ghosts {
		if evidence, ok := standardEvidence[catalog.Ghosts[index].ID]; ok {
			catalog.Ghosts[index].Evidence = append([]string(nil), evidence...)
		}
	}
	return catalog, nil
}

func MustLoad() Catalog {
	catalog, err := Load()
	if err != nil {
		panic(err)
	}
	return catalog
}

func (c Catalog) Info() CatalogInfo {
	return CatalogInfo{Version: c.Version, Source: c.Source, Count: len(c.Ghosts)}
}

// Search matches names, aliases, and localized names. An empty query returns the full catalog.
func (c Catalog) Search(query string) []Ghost {
	query = normalize(query)
	results := make([]Ghost, 0, len(c.Ghosts))
	for _, ghost := range c.Ghosts {
		if query == "" || containsNormalized(ghost.Name, query) || anyAliasMatches(ghost.Aliases, query) || anyAliasMatches(ghost.LocalizedNames, query) {
			results = append(results, ghost)
		}
	}
	return results
}

func (c Catalog) ByID(id string) (Ghost, bool) {
	id = normalize(id)
	for _, ghost := range c.Ghosts {
		if normalize(ghost.ID) == id || normalize(ghost.Name) == id {
			return ghost, true
		}
	}
	return Ghost{}, false
}

// MatchSpeed returns profiles close to an observed base speed. It is a
// ranking aid, not a hard identification rule: conditional ghost speeds and
// imperfect tapping mean the user should confirm exclusions manually.
func (c Catalog) MatchSpeed(baseSpeed, tolerance float64) []SpeedMatch {
	if baseSpeed <= 0 || tolerance < 0 {
		return nil
	}
	results := make([]SpeedMatch, 0)
	for _, ghost := range c.Ghosts {
		var matches []SpeedProfile
		closest := 0.0
		for _, profile := range ghost.SpeedProfiles {
			distance := abs(profile.BaseMPS - baseSpeed)
			if len(matches) == 0 || distance < closest {
				closest = distance
			}
			if distance <= tolerance {
				matches = append(matches, profile)
			}
		}
		if len(matches) > 0 {
			results = append(results, SpeedMatch{
				Ghost:            ghost,
				MatchingProfiles: matches,
				ClosestDistance:  closest,
			})
		}
	}
	sort.SliceStable(results, func(i, j int) bool {
		return results[i].ClosestDistance < results[j].ClosestDistance
	})
	return results
}

// RankSpeed returns every ghost ordered by its closest speed profile. A limit
// of zero returns the complete ranking.
func (c Catalog) RankSpeed(baseSpeed float64, limit int) []SpeedMatch {
	if baseSpeed <= 0 {
		return nil
	}
	results := make([]SpeedMatch, 0, len(c.Ghosts))
	for _, ghost := range c.Ghosts {
		closest := -1.0
		var closestProfiles []SpeedProfile
		for _, profile := range ghost.SpeedProfiles {
			distance := abs(profile.BaseMPS - baseSpeed)
			if closest < 0 || distance < closest {
				closest = distance
				closestProfiles = []SpeedProfile{profile}
				continue
			}
			if distance == closest {
				closestProfiles = append(closestProfiles, profile)
			}
		}
		if closest >= 0 {
			results = append(results, SpeedMatch{
				Ghost:            ghost,
				MatchingProfiles: closestProfiles,
				ClosestDistance:  closest,
			})
		}
	}
	sort.SliceStable(results, func(i, j int) bool {
		return results[i].ClosestDistance < results[j].ClosestDistance
	})
	if limit > 0 && len(results) > limit {
		return results[:limit]
	}
	return results
}

func normalize(value string) string {
	value = norm.NFD.String(strings.ToLower(value))
	var normalized strings.Builder
	for _, character := range value {
		if unicode.Is(unicode.Mn, character) {
			continue
		}
		normalized.WriteRune(character)
	}
	return strings.Join(strings.Fields(normalized.String()), " ")
}

func containsNormalized(value, query string) bool {
	return strings.Contains(normalize(value), query)
}

func anyAliasMatches(aliases []string, query string) bool {
	for _, alias := range aliases {
		if containsNormalized(alias, query) {
			return true
		}
	}
	return false
}

func abs(value float64) float64 {
	if value < 0 {
		return -value
	}
	return value
}
