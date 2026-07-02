export type ViolationType =
  | "Trash Bin Visible"
  | "Tall Grass"
  | "Debris"
  | "Dead Landscaping"
  | null;

export type PropertyStatus =
  | "Good Standing"
  | "Needs Review"
  | "Violation Sent"
  | "Resolved";

export type ViolationStatus = "pending" | "approved" | "dismissed";

export interface Property {
  id: string;
  address: string;
  image: string;
  status: PropertyStatus;
  lastInspection: string;
  neighborhood: string;
  /** GPS + vision address match confidence (0–100) */
  addressConfidence?: number;
  needsAddressReview?: boolean;
  addressMatchReason?: string;
  /** Matched a home from a prior saved inspection */
  previouslyInspected?: boolean;
  priorInspectionDate?: string;
  priorInspectionId?: string;
}

export interface Violation {
  id: string;
  propertyId: string;
  type: ViolationType;
  confidence: number;
  recommendation: string;
  rule: string;
  reasoning: string;
  evidenceImages: string[];
  status: ViolationStatus;
  inspectionId: string;
  detectedAt: string;
}

export interface InspectionResult {
  propertyId: string;
  violation: Violation | null;
}

export interface Inspection {
  id: string;
  name: string;
  date: string;
  status: "completed" | "processing" | "pending";
  videoName: string;
  neighborhood: string;
  propertiesScanned: number;
  violationsFound: number;
  results: InspectionResult[];
}

export interface ActivityItem {
  id: string;
  type: "inspection" | "violation" | "report" | "resolved";
  message: string;
  time: string;
}

const houseImages = [
  "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1605276374101-dee0a782ed10?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1583608205776-bdfd35f0c9ab?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1568605114967-8130f3a36993?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1598228723793-52759bba202c?w=600&h=400&fit=crop",
];

const evidenceImages = [
  "https://images.unsplash.com/photo-1621451537827-9a072b0222b9?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1595428774223-ef52624120b2?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&h=300&fit=crop",
];

const streets = [
  "123 Main St",
  "456 Oak Drive",
  "789 Pine Lane",
  "101 Maple Court",
  "234 Cedar Way",
  "567 Birch Blvd",
  "890 Willow Path",
  "321 Elm Street",
  "654 Aspen Circle",
  "987 Spruce Avenue",
  "147 Cherry Lane",
  "258 Walnut Drive",
  "369 Hickory Road",
  "741 Sycamore Place",
  "852 Magnolia Dr",
  "963 Dogwood Ct",
  "174 Redwood Way",
  "285 Cypress Lane",
  "396 Juniper Street",
  "507 Poplar Avenue",
];

const violationTypes: ViolationType[] = [
  "Trash Bin Visible",
  "Tall Grass",
  "Debris",
  "Dead Landscaping",
  null,
  null,
];

const rules: Record<string, string> = {
  "Trash Bin Visible": "CC&R Section 4.2 — Trash containers must not be visible from the street on non-collection days.",
  "Tall Grass": "CC&R Section 6.1 — Lawn grass must not exceed 4 inches in height.",
  Debris: "CC&R Section 5.3 — Yards must be free of debris, junk, and unsightly materials.",
  "Dead Landscaping": "CC&R Section 6.4 — All landscaping must be maintained in a healthy, living condition.",
};

const recommendations: Record<string, string> = {
  "Trash Bin Visible": "Issue Warning",
  "Tall Grass": "Manager Review",
  Debris: "Issue Warning",
  "Dead Landscaping": "Manager Review",
};

const reasoning: Record<string, string> = {
  "Trash Bin Visible":
    "AI detected a visible trash receptacle near the front curb on a non-collection day. The container appears to be a standard 96-gallon bin positioned in the driveway approach, clearly visible from the street view.",
  "Tall Grass":
    "Grass height analysis indicates vegetation exceeding the 4-inch HOA limit in the front yard area. Estimated height: 8-10 inches based on visual reference markers.",
  Debris:
    "Multiple items identified in the front yard including what appears to be construction materials and miscellaneous items not stored in an approved enclosure.",
  "Dead Landscaping":
    "Front yard shrubbery and ornamental plants show signs of browning and die-off. Approximately 40% of visible landscaping appears non-viable.",
};

function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

const rand = seededRandom(42);

function pickViolationType(): ViolationType {
  return violationTypes[Math.floor(rand() * violationTypes.length)];
}

function pickStatus(type: ViolationType, index: number): PropertyStatus {
  if (!type) return "Good Standing";
  const r = rand();
  if (r < 0.4) return "Needs Review";
  if (r < 0.7) return "Violation Sent";
  if (r < 0.85) return "Resolved";
  return index % 3 === 0 ? "Good Standing" : "Needs Review";
}

const propertyViolationTypes: ViolationType[] = streets.map((_, i) => {
  if (i === 0) return "Trash Bin Visible";
  if (i === 1) return null;
  if (i === 2) return "Tall Grass";
  return pickViolationType();
});

export const properties: Property[] = streets.map((address, i) => {
  const type = propertyViolationTypes[i];
  let status: PropertyStatus = pickStatus(type, i);
  if (i === 0) status = "Needs Review";
  if (i === 1) status = "Good Standing";
  if (i === 2) status = "Needs Review";
  return {
    id: `prop-${i + 1}`,
    address,
    image: houseImages[i % houseImages.length],
    status,
    lastInspection: "2026-06-25",
    neighborhood: "Willow Creek Estates",
  };
});

export const violations: Violation[] = properties.flatMap((prop, i) => {
  const type = propertyViolationTypes[i];
  if (!type) return [];
  const statuses: ViolationStatus[] = ["pending", "approved", "dismissed"];
  const confidence =
    i === 0 ? 97 : i === 2 ? 84 : Math.floor(75 + rand() * 24);
  const recommendation =
    i === 0 ? "Issue Warning" : i === 2 ? "Manager Review" : recommendations[type];
  const status: ViolationStatus =
    i === 0 || i === 2 ? "pending" : statuses[Math.floor(rand() * statuses.length)];
  return [
    {
      id: `viol-${i + 1}`,
      propertyId: prop.id,
      type,
      confidence,
      recommendation,
      rule: rules[type],
      reasoning: reasoning[type],
      evidenceImages: [
        evidenceImages[i % evidenceImages.length],
        evidenceImages[(i + 1) % evidenceImages.length],
      ],
      status,
      inspectionId: "insp-1",
      detectedAt: "2026-06-25T14:32:00",
    },
  ];
});

export const inspections: Inspection[] = [
  {
    id: "insp-1",
    name: "Willow Creek — June Drive-Through",
    date: "2026-06-25",
    status: "completed",
    videoName: "willow_creek_june25.mp4",
    neighborhood: "Willow Creek Estates",
    propertiesScanned: 20,
    violationsFound: violations.length,
    results: properties.map((prop) => {
      const viol = violations.find((v) => v.propertyId === prop.id);
      return { propertyId: prop.id, violation: viol ?? null };
    }),
  },
  {
    id: "insp-2",
    name: "Willow Creek — May Drive-Through",
    date: "2026-05-18",
    status: "completed",
    videoName: "willow_creek_may18.mp4",
    neighborhood: "Willow Creek Estates",
    propertiesScanned: 20,
    violationsFound: 8,
    results: [],
  },
  {
    id: "insp-3",
    name: "Oak Ridge — April Inspection",
    date: "2026-04-12",
    status: "completed",
    videoName: "oak_ridge_apr12.mov",
    neighborhood: "Oak Ridge Village",
    propertiesScanned: 15,
    violationsFound: 5,
    results: [],
  },
];

export const activityFeed: ActivityItem[] = [
  {
    id: "act-1",
    type: "inspection",
    message: "Completed drive-through inspection — Willow Creek Estates",
    time: "2 hours ago",
  },
  {
    id: "act-2",
    type: "violation",
    message: "Trash bin violation detected at 123 Main St",
    time: "2 hours ago",
  },
  {
    id: "act-3",
    type: "report",
    message: "Good property report generated for 456 Oak Drive",
    time: "3 hours ago",
  },
  {
    id: "act-4",
    type: "violation",
    message: "Tall grass flagged at 789 Pine Lane — pending review",
    time: "3 hours ago",
  },
  {
    id: "act-5",
    type: "resolved",
    message: "Violation resolved at 101 Maple Court",
    time: "Yesterday",
  },
  {
    id: "act-6",
    type: "inspection",
    message: "May inspection uploaded and processed",
    time: "Yesterday",
  },
  {
    id: "act-7",
    type: "violation",
    message: "Debris violation approved at 234 Cedar Way",
    time: "2 days ago",
  },
  {
    id: "act-8",
    type: "report",
    message: "Monthly compliance report exported",
    time: "3 days ago",
  },
];

export const dashboardStats = {
  neighborhoodsInspected: 3,
  videosProcessed: 12,
  potentialViolations: violations.filter((v) => v.status === "pending").length,
  timeSavedHours: 47,
};

export const aiInsights = {
  mostCommonViolation: "Trash Bin Visible",
  avgInspectionTime: "18 min",
  complianceScore: 87,
  repeatOffenders: [
    { address: "123 Main St", count: 3 },
    { address: "789 Pine Lane", count: 2 },
    { address: "567 Birch Blvd", count: 2 },
  ],
};

export function getProperty(id: string): Property | undefined {
  return properties.find((p) => p.id === id);
}

export function getViolation(id: string): Violation | undefined {
  return violations.find((v) => v.id === id);
}

export function getInspection(id: string): Inspection | undefined {
  return inspections.find((i) => i.id === id);
}

export function getPropertyViolations(propertyId: string): Violation[] {
  return violations.filter((v) => v.propertyId === propertyId);
}

export function getPropertyInspections(propertyId: string): Inspection[] {
  return inspections.filter((i) =>
    i.results.some((r) => r.propertyId === propertyId)
  );
}
