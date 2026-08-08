// RRB NTPC (Graduate level) syllabus — the exam's own topic list, plus the
// concept ontology that covers it.
//
// Two distinct things live here on purpose:
//   1. SYLLABUS_LINES — the topics exactly as the board publishes them. This
//      changes only when the notification changes. Never edit it to make a
//      concept fit; edit the concepts instead.
//   2. CONCEPTS / PREREQUISITES / CONTRASTS — our study-level ontology. Every
//      concept declares which syllabus line(s) it serves, so coverage is
//      provable rather than assumed (see syllabus.test.ts — it fails if any
//      published line has no concept behind it).
//
// scripts/seed-ontology.ts writes this into the `concept` / `concept_edge`
// tables; scripts/seed.ts reads EXAM_PATTERN for `exam_config`. The DB stores
// no syllabus reference — the mapping is a build-time guarantee only, so no
// schema change was needed.

export type Subject = "math" | "reasoning" | "ga";
export type ExamStage = "cbt1" | "cbt2";

export interface SyllabusLine {
  readonly id: string;
  readonly subject: Subject;
  readonly title: string;
}

// Verbatim topic lines from the RRB NTPC Graduate-level CEN (CBT 1 and CBT 2
// share one syllabus; only the question counts differ — see EXAM_PATTERN).
export const SYLLABUS_LINES = [
  // ── Mathematics ─────────────────────────────────────────────────────────
  { id: "math.number-system", subject: "math", title: "Number System" },
  { id: "math.decimals", subject: "math", title: "Decimals" },
  { id: "math.fractions", subject: "math", title: "Fractions" },
  { id: "math.lcm-hcf", subject: "math", title: "LCM and HCF" },
  { id: "math.ratio-proportion", subject: "math", title: "Ratio and Proportions" },
  { id: "math.percentage", subject: "math", title: "Percentage" },
  { id: "math.mensuration", subject: "math", title: "Mensuration" },
  { id: "math.time-and-work", subject: "math", title: "Time and Work" },
  { id: "math.time-and-distance", subject: "math", title: "Time and Distance" },
  { id: "math.interest", subject: "math", title: "Simple and Compound Interest" },
  { id: "math.profit-and-loss", subject: "math", title: "Profit and Loss" },
  { id: "math.elementary-algebra", subject: "math", title: "Elementary Algebra" },
  { id: "math.geometry-trigonometry", subject: "math", title: "Geometry and Trigonometry" },
  { id: "math.elementary-statistics", subject: "math", title: "Elementary Statistics" },

  // ── General Intelligence & Reasoning ────────────────────────────────────
  { id: "reasoning.analogies", subject: "reasoning", title: "Analogies" },
  { id: "reasoning.series", subject: "reasoning", title: "Completion of Number and Alphabetical Series" },
  { id: "reasoning.coding-decoding", subject: "reasoning", title: "Coding and Decoding" },
  { id: "reasoning.mathematical-operations", subject: "reasoning", title: "Mathematical Operations" },
  { id: "reasoning.similarities-differences", subject: "reasoning", title: "Similarities and Differences" },
  { id: "reasoning.relationships", subject: "reasoning", title: "Relationships" },
  { id: "reasoning.analytical-reasoning", subject: "reasoning", title: "Analytical Reasoning" },
  { id: "reasoning.syllogism", subject: "reasoning", title: "Syllogism" },
  { id: "reasoning.jumbling", subject: "reasoning", title: "Jumbling" },
  { id: "reasoning.venn-diagrams", subject: "reasoning", title: "Venn Diagrams" },
  { id: "reasoning.puzzle", subject: "reasoning", title: "Puzzle" },
  { id: "reasoning.data-sufficiency", subject: "reasoning", title: "Data Sufficiency" },
  {
    id: "reasoning.statement-conclusion",
    subject: "reasoning",
    title: "Statement — Conclusion, Statement — Courses of Action",
  },
  { id: "reasoning.decision-making", subject: "reasoning", title: "Decision Making" },
  { id: "reasoning.maps", subject: "reasoning", title: "Maps" },
  { id: "reasoning.graph-interpretation", subject: "reasoning", title: "Interpretation of Graphs" },

  // ── General Awareness ───────────────────────────────────────────────────
  {
    id: "ga.current-events",
    subject: "ga",
    title: "Current Events of National and International Importance",
  },
  { id: "ga.games-sports", subject: "ga", title: "Games and Sports" },
  { id: "ga.art-culture", subject: "ga", title: "Art and Culture of India" },
  { id: "ga.indian-literature", subject: "ga", title: "Indian Literature" },
  { id: "ga.monuments", subject: "ga", title: "Monuments and Places of India" },
  {
    id: "ga.general-science",
    subject: "ga",
    title: "General Science and Life Science (up to 10th CBSE)",
  },
  { id: "ga.history", subject: "ga", title: "History of India and Freedom Struggle" },
  {
    id: "ga.geography",
    subject: "ga",
    title: "Physical, Social and Economic Geography of India and the World",
  },
  {
    id: "ga.polity",
    subject: "ga",
    title: "Indian Polity and Governance — Constitution and Political System",
  },
  {
    id: "ga.sci-tech",
    subject: "ga",
    title: "General Scientific and Technological Developments including Space and Nuclear Programme of India",
  },
  { id: "ga.world-organisations", subject: "ga", title: "UN and Other Important World Organisations" },
  {
    id: "ga.environment",
    subject: "ga",
    title: "Environmental Issues Concerning India and the World at Large",
  },
  { id: "ga.computers", subject: "ga", title: "Basics of Computers and Computer Applications" },
  { id: "ga.abbreviations", subject: "ga", title: "Common Abbreviations" },
  { id: "ga.transport", subject: "ga", title: "Transport Systems in India" },
  { id: "ga.economy", subject: "ga", title: "Indian Economy" },
  { id: "ga.personalities", subject: "ga", title: "Famous Personalities of India and the World" },
  { id: "ga.flagship-programmes", subject: "ga", title: "Flagship Government Programmes" },
  { id: "ga.flora-fauna", subject: "ga", title: "Flora and Fauna of India" },
  {
    id: "ga.psu-organisations",
    subject: "ga",
    title: "Important Government and Public Sector Organisations of India",
  },
] as const satisfies readonly SyllabusLine[];

export type SyllabusLineId = (typeof SYLLABUS_LINES)[number]["id"];

export interface ExamSection {
  readonly subject: Subject;
  readonly name: string;
  readonly questions: number;
  readonly marks: number;
}

export interface StagePattern {
  readonly stage: ExamStage;
  readonly sections: readonly ExamSection[];
  readonly duration_s: number;
  readonly negative_mark_ratio: number;
}

// Graduate-level pattern. Duration is whole-paper (no per-section timing), so
// section time_s stays 0 when this is written into exam_config.
export const EXAM_PATTERN: Record<ExamStage, StagePattern> = {
  cbt1: {
    stage: "cbt1",
    sections: [
      { subject: "math", name: "Mathematics", questions: 30, marks: 30 },
      { subject: "reasoning", name: "General Intelligence & Reasoning", questions: 30, marks: 30 },
      { subject: "ga", name: "General Awareness", questions: 40, marks: 40 },
    ],
    duration_s: 90 * 60,
    negative_mark_ratio: 1 / 3,
  },
  cbt2: {
    stage: "cbt2",
    sections: [
      { subject: "math", name: "Mathematics", questions: 35, marks: 35 },
      { subject: "reasoning", name: "General Intelligence & Reasoning", questions: 35, marks: 35 },
      { subject: "ga", name: "General Awareness", questions: 50, marks: 50 },
    ],
    duration_s: 90 * 60,
    negative_mark_ratio: 1 / 3,
  },
};

export interface ConceptSeed {
  readonly name: string;
  readonly subject: Subject;
  readonly topic: string;
  readonly subtopic?: string;
  readonly description?: string;
  // Which published syllabus line(s) this concept exists to cover.
  readonly syllabus: readonly SyllabusLineId[];
}

export const CONCEPTS: readonly ConceptSeed[] = [
  // ── Mathematics ─────────────────────────────────────────────────────────
  { name: "Number System", subject: "math", topic: "Arithmetic", description: "Integers, factors, divisibility, place value.", syllabus: ["math.number-system"] },
  { name: "Square Roots and Cube Roots", subject: "math", topic: "Arithmetic", syllabus: ["math.number-system"] },
  { name: "HCF and LCM", subject: "math", topic: "Arithmetic", syllabus: ["math.lcm-hcf"] },
  { name: "Decimals and Fractions", subject: "math", topic: "Arithmetic", syllabus: ["math.decimals", "math.fractions"] },
  { name: "Simplification (BODMAS)", subject: "math", topic: "Arithmetic", syllabus: ["math.number-system"] },
  { name: "Percentages", subject: "math", topic: "Arithmetic", syllabus: ["math.percentage"] },
  { name: "Ratio and Proportion", subject: "math", topic: "Arithmetic", syllabus: ["math.ratio-proportion"] },
  { name: "Average", subject: "math", topic: "Arithmetic", syllabus: ["math.elementary-statistics"] },
  { name: "Mixture and Alligation", subject: "math", topic: "Arithmetic", syllabus: ["math.ratio-proportion"] },
  { name: "Partnership", subject: "math", topic: "Arithmetic", syllabus: ["math.ratio-proportion"] },
  { name: "Problems on Ages", subject: "math", topic: "Arithmetic", syllabus: ["math.ratio-proportion"] },
  { name: "Profit and Loss", subject: "math", topic: "Commercial Math", syllabus: ["math.profit-and-loss"] },
  { name: "Discount", subject: "math", topic: "Commercial Math", syllabus: ["math.profit-and-loss"] },
  { name: "Simple Interest", subject: "math", topic: "Commercial Math", subtopic: "Interest", syllabus: ["math.interest"] },
  { name: "Compound Interest", subject: "math", topic: "Commercial Math", subtopic: "Interest", syllabus: ["math.interest"] },
  { name: "Time and Work", subject: "math", topic: "Applied Arithmetic", syllabus: ["math.time-and-work"] },
  { name: "Pipes and Cisterns", subject: "math", topic: "Applied Arithmetic", syllabus: ["math.time-and-work"] },
  { name: "Time, Speed and Distance", subject: "math", topic: "Applied Arithmetic", syllabus: ["math.time-and-distance"] },
  { name: "Problems on Trains", subject: "math", topic: "Applied Arithmetic", syllabus: ["math.time-and-distance"] },
  { name: "Boats and Streams", subject: "math", topic: "Applied Arithmetic", syllabus: ["math.time-and-distance"] },
  { name: "Elementary Algebra", subject: "math", topic: "Algebra", syllabus: ["math.elementary-algebra"] },
  { name: "Linear Equations", subject: "math", topic: "Algebra", syllabus: ["math.elementary-algebra"] },
  { name: "Geometry", subject: "math", topic: "Geometry and Mensuration", syllabus: ["math.geometry-trigonometry"] },
  { name: "Mensuration", subject: "math", topic: "Geometry and Mensuration", syllabus: ["math.mensuration"] },
  { name: "Trigonometry", subject: "math", topic: "Geometry and Mensuration", syllabus: ["math.geometry-trigonometry"] },
  { name: "Mean, Median and Mode", subject: "math", topic: "Statistics", syllabus: ["math.elementary-statistics"] },
  { name: "Data Interpretation", subject: "math", topic: "Statistics", description: "Reading tables, bar/line/pie charts.", syllabus: ["math.elementary-statistics"] },
  { name: "Probability", subject: "math", topic: "Statistics", syllabus: ["math.elementary-statistics"] },

  // ── General Intelligence & Reasoning ────────────────────────────────────
  { name: "Number Series", subject: "reasoning", topic: "Series", syllabus: ["reasoning.series"] },
  { name: "Letter and Alphabet Series", subject: "reasoning", topic: "Series", syllabus: ["reasoning.series"] },
  { name: "Analogies", subject: "reasoning", topic: "Analogy and Classification", syllabus: ["reasoning.analogies"] },
  { name: "Odd One Out", subject: "reasoning", topic: "Analogy and Classification", syllabus: ["reasoning.similarities-differences"] },
  { name: "Similarities and Differences", subject: "reasoning", topic: "Analogy and Classification", description: "Grouping by shared property vs. spotting the distinguishing one.", syllabus: ["reasoning.similarities-differences"] },
  { name: "Coding-Decoding", subject: "reasoning", topic: "Coding", syllabus: ["reasoning.coding-decoding"] },
  { name: "Mathematical Operations", subject: "reasoning", topic: "Operations", syllabus: ["reasoning.mathematical-operations"] },
  { name: "Syllogism", subject: "reasoning", topic: "Logical Reasoning", syllabus: ["reasoning.syllogism"] },
  { name: "Venn Diagrams", subject: "reasoning", topic: "Logical Reasoning", syllabus: ["reasoning.venn-diagrams"] },
  { name: "Statement and Conclusion", subject: "reasoning", topic: "Logical Reasoning", syllabus: ["reasoning.statement-conclusion"] },
  { name: "Statement and Assumption", subject: "reasoning", topic: "Logical Reasoning", syllabus: ["reasoning.statement-conclusion"] },
  { name: "Statement and Courses of Action", subject: "reasoning", topic: "Logical Reasoning", syllabus: ["reasoning.statement-conclusion"] },
  { name: "Decision Making", subject: "reasoning", topic: "Logical Reasoning", description: "Applying stated eligibility criteria to candidate cases.", syllabus: ["reasoning.decision-making"] },
  { name: "Blood Relations", subject: "reasoning", topic: "Arrangement", syllabus: ["reasoning.relationships"] },
  { name: "Direction Sense", subject: "reasoning", topic: "Arrangement", syllabus: ["reasoning.maps"] },
  { name: "Seating Arrangement", subject: "reasoning", topic: "Arrangement", syllabus: ["reasoning.puzzle"] },
  { name: "Ranking and Ordering", subject: "reasoning", topic: "Arrangement", syllabus: ["reasoning.puzzle"] },
  { name: "Jumbling", subject: "reasoning", topic: "Arrangement", description: "Rearranging jumbled letters, words or sentences into a meaningful order.", syllabus: ["reasoning.jumbling"] },
  { name: "Calendar", subject: "reasoning", topic: "Date and Time", syllabus: ["reasoning.analytical-reasoning"] },
  { name: "Clock", subject: "reasoning", topic: "Date and Time", syllabus: ["reasoning.analytical-reasoning"] },
  { name: "Data Sufficiency", subject: "reasoning", topic: "Analytical Reasoning", syllabus: ["reasoning.data-sufficiency"] },
  { name: "Puzzles", subject: "reasoning", topic: "Analytical Reasoning", description: "Multi-constraint grids: floors, boxes, schedules, categories.", syllabus: ["reasoning.puzzle", "reasoning.analytical-reasoning"] },
  { name: "Cubes and Dice", subject: "reasoning", topic: "Spatial Reasoning", syllabus: ["reasoning.analytical-reasoning"] },
  { name: "Mirror and Water Images", subject: "reasoning", topic: "Spatial Reasoning", syllabus: ["reasoning.similarities-differences"] },
  { name: "Paper Folding and Cutting", subject: "reasoning", topic: "Spatial Reasoning", syllabus: ["reasoning.analytical-reasoning"] },
  { name: "Maps and Route Interpretation", subject: "reasoning", topic: "Spatial Reasoning", syllabus: ["reasoning.maps"] },
  { name: "Interpretation of Graphs", subject: "reasoning", topic: "Data and Graphs", description: "Drawing conclusions from bar, line and pie representations.", syllabus: ["reasoning.graph-interpretation"] },

  // ── General Awareness ───────────────────────────────────────────────────
  // Polity and governance
  { name: "Indian Constitution", subject: "ga", topic: "Indian Polity", description: "Making, sources, salient features, schedules.", syllabus: ["ga.polity"] },
  { name: "Preamble", subject: "ga", topic: "Indian Polity", syllabus: ["ga.polity"] },
  { name: "Fundamental Rights", subject: "ga", topic: "Indian Polity", subtopic: "Rights and Duties", syllabus: ["ga.polity"] },
  { name: "Directive Principles of State Policy", subject: "ga", topic: "Indian Polity", subtopic: "Rights and Duties", syllabus: ["ga.polity"] },
  { name: "President of India", subject: "ga", topic: "Indian Polity", subtopic: "Executive", syllabus: ["ga.polity"] },
  { name: "Governor", subject: "ga", topic: "Indian Polity", subtopic: "Executive", syllabus: ["ga.polity"] },
  { name: "Prime Minister and Council of Ministers", subject: "ga", topic: "Indian Polity", subtopic: "Executive", syllabus: ["ga.polity"] },
  { name: "Lok Sabha", subject: "ga", topic: "Indian Polity", subtopic: "Parliament", syllabus: ["ga.polity"] },
  { name: "Rajya Sabha", subject: "ga", topic: "Indian Polity", subtopic: "Parliament", syllabus: ["ga.polity"] },
  { name: "Supreme Court", subject: "ga", topic: "Indian Polity", subtopic: "Judiciary", syllabus: ["ga.polity"] },
  { name: "Panchayati Raj", subject: "ga", topic: "Indian Polity", subtopic: "Local Government", syllabus: ["ga.polity"] },
  { name: "Election Commission and Elections", subject: "ga", topic: "Indian Polity", subtopic: "Governance", syllabus: ["ga.polity"] },
  { name: "Constitutional and Statutory Bodies", subject: "ga", topic: "Indian Polity", subtopic: "Governance", description: "UPSC, CAG, Finance Commission, NHRC, CVC and the like.", syllabus: ["ga.polity", "ga.psu-organisations"] },
  { name: "Flagship Government Schemes", subject: "ga", topic: "Indian Polity", subtopic: "Governance", syllabus: ["ga.flagship-programmes"] },
  // History
  { name: "Indus Valley Civilization", subject: "ga", topic: "History", subtopic: "Ancient", syllabus: ["ga.history"] },
  { name: "Vedic Period", subject: "ga", topic: "History", subtopic: "Ancient", syllabus: ["ga.history"] },
  { name: "Mauryan Empire", subject: "ga", topic: "History", subtopic: "Ancient", syllabus: ["ga.history"] },
  { name: "Gupta Empire", subject: "ga", topic: "History", subtopic: "Ancient", syllabus: ["ga.history"] },
  { name: "Delhi Sultanate", subject: "ga", topic: "History", subtopic: "Medieval", syllabus: ["ga.history"] },
  { name: "Mughal Empire", subject: "ga", topic: "History", subtopic: "Medieval", syllabus: ["ga.history"] },
  { name: "Indian Freedom Struggle", subject: "ga", topic: "History", subtopic: "Modern", syllabus: ["ga.history"] },
  { name: "Indian National Congress", subject: "ga", topic: "History", subtopic: "Modern", syllabus: ["ga.history"] },
  // Geography
  { name: "Physical Geography of India", subject: "ga", topic: "Geography", subtopic: "India", syllabus: ["ga.geography"] },
  { name: "Indian Rivers", subject: "ga", topic: "Geography", subtopic: "India", syllabus: ["ga.geography"] },
  { name: "Climate of India", subject: "ga", topic: "Geography", subtopic: "India", syllabus: ["ga.geography"] },
  { name: "Indian Agriculture", subject: "ga", topic: "Geography", subtopic: "India", syllabus: ["ga.geography"] },
  { name: "Minerals and Industries of India", subject: "ga", topic: "Geography", subtopic: "India", syllabus: ["ga.geography"] },
  { name: "Population and Census of India", subject: "ga", topic: "Geography", subtopic: "India", syllabus: ["ga.geography"] },
  { name: "Indian States and Union Territories", subject: "ga", topic: "Geography", subtopic: "India", syllabus: ["ga.geography"] },
  { name: "Solar System", subject: "ga", topic: "Geography", subtopic: "World", syllabus: ["ga.geography"] },
  { name: "Continents and Oceans", subject: "ga", topic: "Geography", subtopic: "World", syllabus: ["ga.geography"] },
  { name: "World Physical Geography", subject: "ga", topic: "Geography", subtopic: "World", syllabus: ["ga.geography"] },
  // Economy
  { name: "Indian Economy Basics", subject: "ga", topic: "Economics", syllabus: ["ga.economy"] },
  { name: "Banking and RBI", subject: "ga", topic: "Economics", syllabus: ["ga.economy"] },
  { name: "Union Budget and Taxation", subject: "ga", topic: "Economics", syllabus: ["ga.economy"] },
  { name: "Public Sector Undertakings (PSUs)", subject: "ga", topic: "Economics", description: "Maharatna/Navratna classification and major PSUs.", syllabus: ["ga.psu-organisations"] },
  { name: "Important Government Organisations of India", subject: "ga", topic: "Economics", description: "NITI Aayog, SEBI, TRAI, ISRO, DRDO and peers — remit and headquarters.", syllabus: ["ga.psu-organisations"] },
  // Science
  { name: "Units and Measurement", subject: "ga", topic: "General Science", subtopic: "Physics", syllabus: ["ga.general-science"] },
  { name: "Motion and Force", subject: "ga", topic: "General Science", subtopic: "Physics", syllabus: ["ga.general-science"] },
  { name: "Work, Energy and Power", subject: "ga", topic: "General Science", subtopic: "Physics", syllabus: ["ga.general-science"] },
  { name: "Atomic Structure", subject: "ga", topic: "General Science", subtopic: "Chemistry", syllabus: ["ga.general-science"] },
  { name: "Periodic Table", subject: "ga", topic: "General Science", subtopic: "Chemistry", syllabus: ["ga.general-science"] },
  { name: "Acids, Bases and Salts", subject: "ga", topic: "General Science", subtopic: "Chemistry", syllabus: ["ga.general-science"] },
  { name: "Cell Biology", subject: "ga", topic: "General Science", subtopic: "Biology", syllabus: ["ga.general-science"] },
  { name: "Human Body Systems", subject: "ga", topic: "General Science", subtopic: "Biology", syllabus: ["ga.general-science"] },
  { name: "Nutrition and Diseases", subject: "ga", topic: "General Science", subtopic: "Biology", syllabus: ["ga.general-science"] },
  // Science and technology developments
  { name: "Indian Space Programme (ISRO)", subject: "ga", topic: "Science and Technology", syllabus: ["ga.sci-tech"] },
  { name: "Nuclear Programme of India", subject: "ga", topic: "Science and Technology", syllabus: ["ga.sci-tech"] },
  { name: "Defence Technology of India", subject: "ga", topic: "Science and Technology", syllabus: ["ga.sci-tech"] },
  { name: "Recent Scientific and Technological Developments", subject: "ga", topic: "Science and Technology", syllabus: ["ga.sci-tech"] },
  // Art, culture and literature
  { name: "Art and Culture of India", subject: "ga", topic: "Art and Culture", syllabus: ["ga.art-culture"] },
  { name: "Indian Classical Dance and Music", subject: "ga", topic: "Art and Culture", syllabus: ["ga.art-culture"] },
  { name: "Festivals and Fairs of India", subject: "ga", topic: "Art and Culture", syllabus: ["ga.art-culture"] },
  { name: "Monuments and Places of India", subject: "ga", topic: "Art and Culture", syllabus: ["ga.monuments"] },
  { name: "UNESCO World Heritage Sites in India", subject: "ga", topic: "Art and Culture", syllabus: ["ga.monuments"] },
  { name: "Indian Literature", subject: "ga", topic: "Art and Culture", syllabus: ["ga.indian-literature"] },
  // International organisations
  { name: "United Nations and its Agencies", subject: "ga", topic: "International Organisations", syllabus: ["ga.world-organisations"] },
  { name: "World Bank, IMF and WTO", subject: "ga", topic: "International Organisations", syllabus: ["ga.world-organisations"] },
  { name: "SAARC, BRICS, G20 and Other Groupings", subject: "ga", topic: "International Organisations", syllabus: ["ga.world-organisations"] },
  // Environment
  { name: "Environmental Pollution and Issues", subject: "ga", topic: "Environment", syllabus: ["ga.environment"] },
  { name: "Climate Change and Global Agreements", subject: "ga", topic: "Environment", syllabus: ["ga.environment"] },
  { name: "Biodiversity and Conservation", subject: "ga", topic: "Environment", syllabus: ["ga.environment", "ga.flora-fauna"] },
  { name: "Flora and Fauna of India", subject: "ga", topic: "Environment", syllabus: ["ga.flora-fauna"] },
  { name: "National Parks and Wildlife Sanctuaries", subject: "ga", topic: "Environment", syllabus: ["ga.flora-fauna"] },
  // Computer awareness
  { name: "Computer Fundamentals", subject: "ga", topic: "Computer Awareness", syllabus: ["ga.computers"] },
  { name: "Computer Hardware and Software", subject: "ga", topic: "Computer Awareness", syllabus: ["ga.computers"] },
  { name: "Operating Systems and MS Office", subject: "ga", topic: "Computer Awareness", syllabus: ["ga.computers"] },
  { name: "Internet, Email and Networking", subject: "ga", topic: "Computer Awareness", syllabus: ["ga.computers"] },
  { name: "Computer Security and Cyber Threats", subject: "ga", topic: "Computer Awareness", syllabus: ["ga.computers"] },
  { name: "Computer Abbreviations and Shortcuts", subject: "ga", topic: "Computer Awareness", syllabus: ["ga.computers", "ga.abbreviations"] },
  // Transport
  { name: "Indian Railways: History and Organisation", subject: "ga", topic: "Transport Systems", syllabus: ["ga.transport"] },
  { name: "Railway Zones and Divisions", subject: "ga", topic: "Transport Systems", syllabus: ["ga.transport"] },
  { name: "Road, Air and Water Transport in India", subject: "ga", topic: "Transport Systems", syllabus: ["ga.transport"] },
  // Current affairs
  { name: "Current Events of National Importance", subject: "ga", topic: "Current Affairs", syllabus: ["ga.current-events"] },
  { name: "Current Events of International Importance", subject: "ga", topic: "Current Affairs", syllabus: ["ga.current-events"] },
  { name: "Persons in News", subject: "ga", topic: "Current Affairs", syllabus: ["ga.personalities"] },
  // Static GK
  { name: "Important Days and Dates", subject: "ga", topic: "Static GK", syllabus: ["ga.current-events"] },
  { name: "Books and Authors", subject: "ga", topic: "Static GK", syllabus: ["ga.indian-literature"] },
  { name: "Awards and Honours", subject: "ga", topic: "Static GK", syllabus: ["ga.current-events"] },
  { name: "Sports and Games", subject: "ga", topic: "Static GK", syllabus: ["ga.games-sports"] },
  { name: "Common Abbreviations", subject: "ga", topic: "Static GK", syllabus: ["ga.abbreviations"] },
  { name: "Famous Personalities of India and the World", subject: "ga", topic: "Static GK", syllabus: ["ga.personalities"] },
];

// prerequisite: [dependent, foundation] — edge is stored source=dependent,
// target=foundation, matching the planner's learnability gate (a concept is
// learnable only once every foundation's p_known ≥ 0.70).
export type PrereqPair = readonly [dependent: string, foundation: string];

// contrasts_with: [a, b] — the pair a learner tends to confuse. Seeded in BOTH
// directions so the tutor surfaces the partner whichever side is weak.
export type ContrastPair = readonly [string, string];

export const PREREQUISITES: readonly PrereqPair[] = [
  // Arithmetic spine
  ["Percentages", "Number System"],
  ["Ratio and Proportion", "Number System"],
  ["Average", "Number System"],
  ["Square Roots and Cube Roots", "Number System"],
  ["Profit and Loss", "Percentages"],
  ["Discount", "Percentages"],
  ["Simple Interest", "Percentages"],
  ["Compound Interest", "Simple Interest"],
  ["Time and Work", "Ratio and Proportion"],
  ["Pipes and Cisterns", "Time and Work"],
  ["Time, Speed and Distance", "Ratio and Proportion"],
  ["Problems on Trains", "Time, Speed and Distance"],
  ["Boats and Streams", "Time, Speed and Distance"],
  ["Mixture and Alligation", "Ratio and Proportion"],
  ["Partnership", "Ratio and Proportion"],
  ["Problems on Ages", "Ratio and Proportion"],
  ["Data Interpretation", "Percentages"],
  ["Data Interpretation", "Average"],
  ["Probability", "Ratio and Proportion"],
  ["Linear Equations", "Elementary Algebra"],
  ["Mensuration", "Geometry"],
  ["Trigonometry", "Geometry"],
  // Reasoning
  ["Seating Arrangement", "Direction Sense"],
  ["Puzzles", "Seating Arrangement"],
  ["Maps and Route Interpretation", "Direction Sense"],
  ["Statement and Courses of Action", "Statement and Conclusion"],
  ["Decision Making", "Statement and Courses of Action"],
  ["Interpretation of Graphs", "Data Interpretation"],
  // Polity
  ["Preamble", "Indian Constitution"],
  ["Fundamental Rights", "Indian Constitution"],
  ["Directive Principles of State Policy", "Indian Constitution"],
  ["President of India", "Indian Constitution"],
  ["Governor", "Indian Constitution"],
  ["Prime Minister and Council of Ministers", "Indian Constitution"],
  ["Lok Sabha", "Indian Constitution"],
  ["Rajya Sabha", "Indian Constitution"],
  ["Supreme Court", "Indian Constitution"],
  ["Panchayati Raj", "Indian Constitution"],
  ["Election Commission and Elections", "Indian Constitution"],
  ["Constitutional and Statutory Bodies", "Indian Constitution"],
  // History chronology
  ["Indian National Congress", "Indian Freedom Struggle"],
  ["Mughal Empire", "Delhi Sultanate"],
  // Geography
  ["Minerals and Industries of India", "Physical Geography of India"],
  ["Population and Census of India", "Physical Geography of India"],
  ["Indian States and Union Territories", "Physical Geography of India"],
  // Economy
  ["Banking and RBI", "Indian Economy Basics"],
  ["Union Budget and Taxation", "Indian Economy Basics"],
  ["Public Sector Undertakings (PSUs)", "Indian Economy Basics"],
  ["Flagship Government Schemes", "Indian Economy Basics"],
  // Science
  ["Work, Energy and Power", "Motion and Force"],
  ["Motion and Force", "Units and Measurement"],
  ["Periodic Table", "Atomic Structure"],
  ["Human Body Systems", "Cell Biology"],
  // Art and culture
  ["Indian Classical Dance and Music", "Art and Culture of India"],
  ["Festivals and Fairs of India", "Art and Culture of India"],
  ["UNESCO World Heritage Sites in India", "Monuments and Places of India"],
  // Environment
  ["Climate Change and Global Agreements", "Environmental Pollution and Issues"],
  ["Biodiversity and Conservation", "Flora and Fauna of India"],
  ["National Parks and Wildlife Sanctuaries", "Flora and Fauna of India"],
  // Computers
  ["Computer Hardware and Software", "Computer Fundamentals"],
  ["Operating Systems and MS Office", "Computer Hardware and Software"],
  ["Internet, Email and Networking", "Computer Fundamentals"],
  ["Computer Security and Cyber Threats", "Internet, Email and Networking"],
  ["Computer Abbreviations and Shortcuts", "Computer Fundamentals"],
  // Transport
  ["Railway Zones and Divisions", "Indian Railways: History and Organisation"],
];

export const CONTRASTS: readonly ContrastPair[] = [
  ["Simple Interest", "Compound Interest"],
  ["Profit and Loss", "Discount"],
  ["Mixture and Alligation", "Average"],
  ["President of India", "Governor"],
  ["Lok Sabha", "Rajya Sabha"],
  ["Fundamental Rights", "Directive Principles of State Policy"],
  ["Time and Work", "Pipes and Cisterns"],
  ["Statement and Conclusion", "Statement and Assumption"],
  ["Statement and Conclusion", "Statement and Courses of Action"],
  ["Analogies", "Odd One Out"],
  ["Analogies", "Similarities and Differences"],
  ["Calendar", "Clock"],
  ["Mauryan Empire", "Gupta Empire"],
  ["United Nations and its Agencies", "World Bank, IMF and WTO"],
  ["Current Events of National Importance", "Current Events of International Importance"],
  ["Constitutional and Statutory Bodies", "Public Sector Undertakings (PSUs)"],
];

/** Published syllabus lines that no concept claims to cover. Empty = full coverage. */
export function uncoveredSyllabusLines(
  concepts: readonly ConceptSeed[] = CONCEPTS
): SyllabusLine[] {
  const covered = new Set<string>(concepts.flatMap((c) => c.syllabus));
  return SYLLABUS_LINES.filter((line) => !covered.has(line.id));
}

/** The concepts that cover a given published syllabus line. */
export function conceptsForLine(
  lineId: SyllabusLineId,
  concepts: readonly ConceptSeed[] = CONCEPTS
): ConceptSeed[] {
  return concepts.filter((c) => (c.syllabus as readonly string[]).includes(lineId));
}
