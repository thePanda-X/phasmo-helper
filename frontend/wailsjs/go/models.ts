export namespace bpm {
	
	export class Snapshot {
	    bpm: number;
	    baseSpeedMPS: number;
	    actualSpeedMPS: number;
	    speedModifier: number;
	    tapCount: number;
	    intervalCount: number;
	    lastIntervalMS: number;
	    medianIntervalMS: number;
	    jitterMS: number;
	    recentIntervalsMS: number[];
	    confidence: string;
	    ready: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Snapshot(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.bpm = source["bpm"];
	        this.baseSpeedMPS = source["baseSpeedMPS"];
	        this.actualSpeedMPS = source["actualSpeedMPS"];
	        this.speedModifier = source["speedModifier"];
	        this.tapCount = source["tapCount"];
	        this.intervalCount = source["intervalCount"];
	        this.lastIntervalMS = source["lastIntervalMS"];
	        this.medianIntervalMS = source["medianIntervalMS"];
	        this.jitterMS = source["jitterMS"];
	        this.recentIntervalsMS = source["recentIntervalsMS"];
	        this.confidence = source["confidence"];
	        this.ready = source["ready"];
	    }
	}

}

export namespace ghosts {
	
	export class CatalogInfo {
	    version: string;
	    source: string;
	    count: number;
	
	    static createFrom(source: any = {}) {
	        return new CatalogInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.version = source["version"];
	        this.source = source["source"];
	        this.count = source["count"];
	    }
	}
	export class SpeedProfile {
	    label: string;
	    baseMPS: number;
	    condition: string;
	
	    static createFrom(source: any = {}) {
	        return new SpeedProfile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.label = source["label"];
	        this.baseMPS = source["baseMPS"];
	        this.condition = source["condition"];
	    }
	}
	export class Ghost {
	    id: string;
	    name: string;
	    aliases: string[];
	    localizedNames?: string[];
	    evidence: string[];
	    speedProfiles: SpeedProfile[];
	    tells: string[];
	
	    static createFrom(source: any = {}) {
	        return new Ghost(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.aliases = source["aliases"];
	        this.localizedNames = source["localizedNames"];
	        this.evidence = source["evidence"];
	        this.speedProfiles = this.convertValues(source["speedProfiles"], SpeedProfile);
	        this.tells = source["tells"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SpeedMatch {
	    ghost: Ghost;
	    matchingProfiles: SpeedProfile[];
	    closestDistance: number;
	
	    static createFrom(source: any = {}) {
	        return new SpeedMatch(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ghost = this.convertValues(source["ghost"], Ghost);
	        this.matchingProfiles = this.convertValues(source["matchingProfiles"], SpeedProfile);
	        this.closestDistance = source["closestDistance"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace main {
	
	export class KeybindSettings {
	    tap: string;
	    reset: string;
	    fullReset: string;
	    toggleOverlay: string;
	    openSettings: string;
	    startHunt: string;
	    endHunt: string;
	
	    static createFrom(source: any = {}) {
	        return new KeybindSettings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.tap = source["tap"];
	        this.reset = source["reset"];
	        this.fullReset = source["fullReset"];
	        this.toggleOverlay = source["toggleOverlay"];
	        this.openSettings = source["openSettings"];
	        this.startHunt = source["startHunt"];
	        this.endHunt = source["endHunt"];
	    }
	}
	export class ModuleLayout {
	    x: number;
	    y: number;
	    width: number;
	    height: number;
	    pinned: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ModuleLayout(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.x = source["x"];
	        this.y = source["y"];
	        this.width = source["width"];
	        this.height = source["height"];
	        this.pinned = source["pinned"];
	    }
	}
	export class OverlayLayout {
	    modules: Record<string, ModuleLayout>;
	
	    static createFrom(source: any = {}) {
	        return new OverlayLayout(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.modules = this.convertValues(source["modules"], ModuleLayout, true);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class TrackerView {
	    snapshot: bpm.Snapshot;
	    matches: ghosts.SpeedMatch[];
	    ranked: ghosts.SpeedMatch[];
	
	    static createFrom(source: any = {}) {
	        return new TrackerView(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.snapshot = this.convertValues(source["snapshot"], bpm.Snapshot);
	        this.matches = this.convertValues(source["matches"], ghosts.SpeedMatch);
	        this.ranked = this.convertValues(source["ranked"], ghosts.SpeedMatch);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

